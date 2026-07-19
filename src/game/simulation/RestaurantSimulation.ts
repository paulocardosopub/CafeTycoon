import { BALANCE } from '../../config/balance';
import { RECIPE_BY_ID, RECIPES } from '../../content/recipes/recipes';
import type {
  ActorKind, ChairRuntime, CustomerState, Direction, GameState, GridPoint, HelpRole, IngredientId, OperationSaveState,
  RecipeId, StationRuntime, TableRuntime, TaskKind,
} from '../../core/types';
import { stableRuntimeId } from '../../core/id';
import { gameEvents } from '../../core/events';
import {
  canConsumeRecipe, consumeReservation, releaseReservation, reserveRecipe,
} from '../inventory/InventoryService';
import {
  createInitialGrid, createStations, createTables, CUSTOMER_QUEUE, ENTRANCE, PICKUP_KITCHEN_POINT,
  PICKUP_SERVICE_POINT, STREET_ENTRY_POINTS, STREET_EXIT_ZONE,
} from '../map/initialMap';
import { findPath } from '../navigation/AStar';
import { advanceTileMover, directionBetween, type MovementResult } from '../navigation/TileMovement';
import { awardPlayerTaskXp, updateRestaurantLevel } from '../progression/progression';
import { TaskManager, type RestaurantTask } from '../tasks/TaskManager';
import { tickProduction, readyDishCapacity, readyDishUsed } from '../cooking/ProductionService';

interface Mover {
  id: string;
  position: GridPoint;
  visual: GridPoint;
  path: GridPoint[];
  moveProgress: number;
  direction: Direction;
  lastMovementAt: number;
  blockedSeconds: number;
  retryCount: number;
  pathStatus: 'idle' | 'moving' | 'blocked' | 'no_path' | 'arrived';
}

export interface WorkerActor extends Mover {
  kind: ActorKind;
  name: string;
  assetId: string;
  activity: string;
  idleReason: string;
  taskId?: string;
  taskRemaining: number;
  preferredTaskId?: string;
  carrying?: 'dish' | 'ingredients';
  carryingOrderId?: string;
}

export interface CustomerRuntime extends Mover {
  state: CustomerState;
  stateEnteredAt: number;
  partyId: string;
  partySize: number;
  partyIndex: number;
  patience: number;
  maxPatience: number;
  tableId?: string;
  seatId?: string;
  chairIds: string[];
  orderId?: string;
  eatRemaining: number;
  variant: number;
  exitId?: string;
  cleanupCompleted: boolean;
  paymentCompleted: boolean;
  outcomeApplied: boolean;
}

export type OrderState = 'requested' | 'awaiting_ingredients' | 'awaiting_station' | 'preparing' | 'awaiting_pickup' | 'transporting' | 'delivered' | 'consumed' | 'cancelled';

export interface OrderRuntime {
  id: string;
  customerId: string;
  tableId: string;
  seatId: string;
  chairId: string;
  recipeId: RecipeId;
  quantity: number;
  state: OrderState;
  createdAt: number;
  priority: number;
  stepIndex: number;
  plateId: string;
  assignedActorId?: string;
  ingredientReservation: Partial<Record<IngredientId, number>>;
  ingredientsState: 'none' | 'reserved' | 'consumed' | 'released';
  counterSlotId?: string;
  paymentCompleted: boolean;
}

export interface CounterSlotRuntime {
  id: string;
  state: 'free' | 'reserved' | 'occupied';
  orderId?: string;
  reservedBy?: string;
}

const TASK_LABELS: Record<TaskKind, string> = {
  take_order: 'Anotando pedido', cook_step: 'Preparando prato', deliver: 'Servindo lugar',
  payment: 'Recebendo pagamento', clean: 'Limpando lugar', stock_support: 'Repondo pedido',
};

const CUSTOMER_LABELS: Record<CustomerState, string> = {
  arriving: 'Chegando', entering: 'Entrando', seeking_table: 'Procurando lugar', queueing: 'Aguardando mesa',
  walking_to_seat: 'Indo ao lugar', sitting: 'Sentando', waiting_order: 'Aguardando atendimento',
  waiting_food: 'Aguardando pedido', eating: 'Saboreando', paying: 'Pagando', standing: 'Levantando',
  leaving: 'Saindo', gone: 'Foi embora', gave_up: 'Desistindo',
};

const ACTIVE_SEAT_STATES = new Set<ChairRuntime['state']>(['reserved', 'approaching', 'occupied', 'waiting_order', 'waiting_food', 'eating', 'waiting_payment']);
const PATIENCE_STATES = new Set<CustomerState>(['seeking_table', 'queueing', 'waiting_order', 'waiting_food', 'paying']);
const TERMINAL_ORDER_STATES = new Set<OrderState>(['consumed', 'cancelled']);

export class RestaurantSimulation {
  readonly tables: TableRuntime[];
  readonly stations: StationRuntime[];
  readonly grid;
  readonly tasks = new TaskManager();
  readonly actors: WorkerActor[];
  readonly customers: CustomerRuntime[] = [];
  readonly orders: OrderRuntime[] = [];
  readonly counterSlots: CounterSlotRuntime[] = [0, 1, 2].map((index) => ({ id: `pickup-slot-${index + 1}`, state: 'free' }));
  private spawnCountdown = 2;
  private customerSequence = 0;
  private simulationTime = 0;
  private visualClock = 0;
  private speed: 0 | 1 | 2 | 4 = 1;
  private blockedTaskRetry = 0;
  private autoSpawn = true;

  constructor(public readonly state: GameState) {
    this.tables = createTables();
    this.stations = createStations();
    this.grid = createInitialGrid(this.tables);
    this.actors = this.createDefaultActors();
    if (state.operation?.dataVersion === 1) this.restoreOperation(state.operation);
    this.rebuildOccupancy();
    this.reconcileOperation();
  }

  private createDefaultActors(): WorkerActor[] {
    return [
      this.makeActor('employee-cook-001', 'cook', 'Nina', 'cook-0', { x: 5, y: 5 }),
      this.makeActor('employee-waiter-001', 'waiter', 'Caio', 'waiter-0', { x: 8, y: 9 }),
      this.makeActor('employee-cleaner-001', 'cleaner', 'Iara', 'cleaner-0', { x: 2, y: 9 }),
      this.makeActor('employee-stocker-001', 'stocker', 'Davi', 'stocker-0', { x: 3, y: 6 }),
      this.makeActor(this.state.playerId, 'player', this.state.profile?.name ?? 'Você', playerRenderedStyle(this.state.profile?.appearance.hairStyle), { x: 9, y: 14 }),
    ];
  }

  private makeActor(id: string, kind: ActorKind, name: string, assetId: string, position: GridPoint): WorkerActor {
    return {
      id, kind, name, assetId, position: { ...position }, visual: { ...position }, path: [], moveProgress: 0, direction: 'se',
      activity: 'Disponível', idleReason: 'Aguardando tarefa do setor', taskRemaining: 0, lastMovementAt: 0,
      blockedSeconds: 0, retryCount: 0, pathStatus: 'idle',
    };
  }

  update(realDeltaSeconds: number): void {
    const realDelta = Math.max(0, Math.min(.25, realDeltaSeconds));
    this.visualClock += realDelta * Math.min(this.speed, 2) * 1000;
    if (this.speed === 0) { gameEvents.emit('simulation:update', undefined); return; }
    let remaining = realDelta * this.speed;
    while (remaining > 0.00001) {
      const step = Math.min(.05, remaining);
      this.tick(step);
      remaining -= step;
    }
    gameEvents.emit('simulation:update', undefined);
  }

  private tick(delta: number): void {
    this.simulationTime += delta;
    this.tasks.tick(delta);
    this.pruneGoneCustomers();
    const production = tickProduction(this.state, delta);
    if (Object.keys(production.produced).length) gameEvents.emit('toast', { message: 'Produção programada concluída!', tone: 'success' });
    this.spawnCountdown -= delta;
    if (this.autoSpawn && this.spawnCountdown <= 0 && this.activeCustomerCount() < 20) {
      const nextPartySize = this.customerSequence > 0 && this.customerSequence % 9 === 0 ? 4 : this.customerSequence > 0 && this.customerSequence % 5 === 0 ? 2 : 1;
      this.spawnParty(nextPartySize);
      this.spawnCountdown = BALANCE.customerSpawnSeconds + (this.customerSequence % 4);
    }
    this.assignWaitingParties();
    this.retryBlockedOrders();
    this.retryCounterOrders();
    this.blockedTaskRetry -= delta;
    if (this.blockedTaskRetry <= 0) { this.tasks.retryBlocked(); this.blockedTaskRetry = BALANCE.movementRecovery.retrySeconds; }
    this.updateCustomers(delta);
    this.updateActors(delta);
    updateRestaurantLevel(this.state);
  }

  private spawnParty(size: number): CustomerRuntime[] {
    const partySize = Math.max(1, Math.min(4, Math.floor(size)));
    const spawnCells = this.availableStreetCells(partySize);
    if (spawnCells.length < partySize) return [];
    const partyId = stableRuntimeId('party');
    const members: CustomerRuntime[] = [];
    for (let index = 0; index < partySize; index += 1) {
      this.customerSequence += 1;
      const streetSpawn = spawnCells[index];
      const customer: CustomerRuntime = {
        id: stableRuntimeId('customer'), state: 'entering', stateEnteredAt: this.simulationTime, partyId, partySize, partyIndex: index,
        patience: BALANCE.customerBasePatienceSeconds, maxPatience: BALANCE.customerBasePatienceSeconds,
        position: { ...streetSpawn }, visual: { ...streetSpawn }, path: [], moveProgress: 0, chairIds: [], eatRemaining: 0,
        variant: this.customerSequence % 8, direction: 'nw', lastMovementAt: this.simulationTime, blockedSeconds: 0,
        retryCount: 0, pathStatus: 'idle', cleanupCompleted: false, paymentCompleted: false, outcomeApplied: false,
      };
      this.customers.push(customer);
      this.grid.occupy(customer.position, customer.id);
      this.routeCustomer(customer, ENTRANCE);
      members.push(customer);
    }
    return members;
  }

  private availableStreetCells(count: number): GridPoint[] {
    const candidates = [
      ...STREET_ENTRY_POINTS,
      ...Array.from({ length: 14 }, (_, index) => ({ x: 2 + index, y: 21 })),
      ...Array.from({ length: 8 }, (_, index) => ({ x: 5 + index, y: 20 })),
    ];
    const unique = candidates.filter((point, index) => candidates.findIndex((item) => this.samePoint(item, point)) === index);
    return unique.filter((point) => this.grid.isWalkable(point)).slice(0, count);
  }

  private assignWaitingParties(): void {
    const partyIds = [...new Set(this.customers.filter((customer) => ['seeking_table', 'queueing'].includes(customer.state)).map((customer) => customer.partyId))];
    for (const partyId of partyIds) {
      const members = this.partyMembers(partyId).filter((customer) => customer.state !== 'gone');
      if (!members.length || members.some((customer) => !['seeking_table', 'queueing'].includes(customer.state) || customer.path.length > 0)) continue;
      if (!this.assignSeats(members)) this.sendPartyToQueue(members);
    }
  }

  private assignSeats(members: CustomerRuntime[]): boolean {
    let table: TableRuntime | undefined; let seats: ChairRuntime[] = []; let plannedPaths: GridPoint[][] = [];
    for (const candidate of this.tables) {
      if (!candidate.accessible) continue;
      const available = candidate.chairs.filter((chair) => this.seatUsable(chair) && chair.state === 'free');
      if (available.length < members.length) continue;
      const remaining = [...available]; const candidateSeats: ChairRuntime[] = []; const candidatePaths: GridPoint[][] = [];
      for (const member of members) {
        const seatIndex = remaining.findIndex((seat) => {
          const path = findPath(this.grid, member.position, seat.approach, member.id);
          if (!path.length && !this.samePoint(member.position, seat.approach)) return false;
          candidatePaths.push(path); return true;
        });
        if (seatIndex < 0) break;
        candidateSeats.push(remaining.splice(seatIndex, 1)[0]);
      }
      if (candidateSeats.length !== members.length) continue;
      table = candidate; seats = candidateSeats; plannedPaths = candidatePaths; break;
    }
    if (!table) return false;
    seats.forEach((seat, index) => {
      const customer = members[index];
      seat.state = 'reserved'; seat.customerId = customer.id; seat.reservationId = customer.partyId;
      customer.tableId = table.id; customer.seatId = seat.seatId; customer.chairIds = [seat.id];
      this.setCustomerState(customer, 'walking_to_seat');
      customer.path = plannedPaths[index]; customer.pathStatus = customer.path.length ? 'moving' : 'arrived';
      seat.state = customer.path.length ? 'approaching' : 'reserved';
      if (!customer.path.length) this.onCustomerArrived(customer);
    });
    this.refreshTableState(table);
    return true;
  }

  private sendPartyToQueue(members: CustomerRuntime[]): void {
    const queued = this.customers.filter((entry) => entry.state === 'queueing' && !members.includes(entry));
    members.forEach((customer, index) => {
      if (customer.state !== 'queueing') this.setCustomerState(customer, 'queueing');
      const queuePoint = CUSTOMER_QUEUE[Math.min(CUSTOMER_QUEUE.length - 1, (queued.length + index) % CUSTOMER_QUEUE.length)];
      if (!this.samePoint(customer.position, queuePoint) && !customer.path.length) this.routeCustomer(customer, queuePoint);
    });
  }

  private updateCustomers(delta: number): void {
    for (const customer of [...this.customers]) {
      if (customer.state === 'gone') continue;
      if ((customer.state === 'leaving' || customer.state === 'gave_up') && !customer.path.length) {
        customer.blockedSeconds += delta; customer.pathStatus = 'no_path';
        if (customer.blockedSeconds >= BALANCE.movementRecovery.retrySeconds) {
          customer.blockedSeconds = 0; customer.retryCount += 1;
          this.routeCustomerToExit(customer, customer.retryCount > 1);
          if (!customer.path.length && customer.retryCount >= BALANCE.movementRecovery.maxExitRetries) this.safeRemoveCustomer(customer, 'saída permaneceu sem rota');
        }
      }
      else if (customer.state === 'entering' && !customer.path.length) {
        if (this.samePoint(customer.position, ENTRANCE)) this.onCustomerArrived(customer); else this.routeCustomer(customer, ENTRANCE);
      } else if (customer.state === 'walking_to_seat' && !customer.path.length) this.routeCustomerToSeat(customer);

      if (customer.path.length) {
        const result = this.advanceMover(customer, delta, 2.1 * BALANCE.movementSpeedMultiplier);
        this.handleCustomerMovement(customer, result, delta);
        if (result.completedTile && !customer.path.length) this.onCustomerArrived(customer);
      }
      if (PATIENCE_STATES.has(customer.state)) {
        customer.patience = Math.max(0, customer.patience - delta);
        if (customer.patience <= 0) this.customerGivesUp(customer);
      }
      if (customer.state === 'eating') {
        customer.eatRemaining -= delta;
        if (customer.eatRemaining <= 0) this.requestPayment(customer);
      }
    }
  }

  private handleCustomerMovement(customer: CustomerRuntime, result: MovementResult, delta: number): void {
    if (result.moved) {
      customer.lastMovementAt = this.simulationTime; customer.blockedSeconds = 0; customer.retryCount = 0; customer.pathStatus = customer.path.length ? 'moving' : 'arrived';
      return;
    }
    if (!result.blocked) return;
    customer.blockedSeconds += delta; customer.pathStatus = 'blocked';
    if (customer.blockedSeconds < BALANCE.movementRecovery.retrySeconds) return;
    customer.blockedSeconds = 0; customer.retryCount += 1; this.grid.releaseReservations(customer.id);
    if (customer.state === 'leaving' || customer.state === 'gave_up') {
      this.routeCustomerToExit(customer, true);
      if (!customer.path.length && customer.retryCount >= BALANCE.movementRecovery.maxExitRetries) this.safeRemoveCustomer(customer, 'saída sem rota após novas tentativas');
    } else if (customer.state === 'walking_to_seat') {
      this.routeCustomerToSeat(customer);
      if (!customer.path.length && customer.retryCount >= BALANCE.movementRecovery.maxTaskRetries) this.releaseCustomerSeat(customer, false);
    } else if (customer.state === 'entering') this.routeCustomer(customer, ENTRANCE);
  }

  private onCustomerArrived(customer: CustomerRuntime): void {
    if (customer.state === 'entering') {
      this.setCustomerState(customer, 'seeking_table');
      customer.pathStatus = 'arrived';
      this.sendPartyToQueue([customer]);
    } else if (customer.state === 'walking_to_seat') {
      const seat = this.seatFor(customer.seatId); const table = this.tableFor(customer.tableId);
      if (!seat || !table || seat.customerId !== customer.id) { this.releaseCustomerSeat(customer, false); return; }
      this.setCustomerState(customer, 'sitting');
      customer.direction = seat.orientation;
      seat.state = 'waiting_order';
      this.setCustomerState(customer, 'waiting_order');
      this.tasks.add({
        key: `order:${customer.id}`, kind: 'take_order', role: 'service', target: seat.servicePoint,
        duration: BALANCE.actionSeconds.takeOrder, priority: 70, payload: { customerId: customer.id, tableId: table.id, seatId: seat.seatId },
        reservations: [{ type: 'seat', id: seat.seatId }],
      }, this.simulationTime);
      this.refreshTableState(table);
    } else if (customer.state === 'leaving' || customer.state === 'gave_up') this.completeCustomerDeparture(customer);
  }

  private routeCustomerToSeat(customer: CustomerRuntime): void {
    const seat = this.seatFor(customer.seatId);
    if (!seat || seat.customerId !== customer.id) { this.releaseCustomerSeat(customer, false); return; }
    this.routeCustomer(customer, seat.approach);
  }

  private routeCustomer(customer: CustomerRuntime, target: GridPoint): void {
    if (this.samePoint(customer.position, target)) { customer.path = []; customer.pathStatus = 'arrived'; return; }
    customer.path = findPath(this.grid, customer.position, target, customer.id);
    customer.pathStatus = customer.path.length ? 'moving' : 'no_path';
  }

  private routeCustomerToExit(customer: CustomerRuntime, chooseAnother = false): void {
    if (STREET_EXIT_ZONE.some((point) => this.samePoint(customer.position, point))) { this.completeCustomerDeparture(customer); return; }
    const candidates = [...STREET_EXIT_ZONE]
      .filter((point) => chooseAnother ? `${point.x},${point.y}` !== customer.exitId : true)
      .sort((a, b) => this.distance(customer.position, a) - this.distance(customer.position, b));
    for (const point of candidates) {
      const path = findPath(this.grid, customer.position, point, customer.id);
      if (!path.length) continue;
      customer.exitId = `${point.x},${point.y}`; customer.path = path; customer.pathStatus = 'moving'; return;
    }
    customer.path = []; customer.pathStatus = 'no_path';
  }

  private completeCustomerDeparture(customer: CustomerRuntime): void {
    customer.state = 'gone'; customer.stateEnteredAt = this.simulationTime; customer.path = []; customer.pathStatus = 'arrived';
    this.grid.vacate(customer.id);
  }

  private safeRemoveCustomer(customer: CustomerRuntime, reason: string): void {
    this.cleanupCustomerReferences(customer);
    this.completeCustomerDeparture(customer);
    if (this.developmentMode()) console.warn(`[recuperação 0.0.3] ${customer.id} removido com segurança: ${reason}`);
  }

  private pruneGoneCustomers(): void {
    for (let index = this.customers.length - 1; index >= 0; index -= 1) if (this.customers[index].state === 'gone') this.customers.splice(index, 1);
  }

  private customerGivesUp(customer: CustomerRuntime): void {
    if (['gone', 'leaving', 'gave_up'].includes(customer.state)) return;
    if (!customer.outcomeApplied) {
      customer.outcomeApplied = true;
      this.state.reputation = Math.max(0, this.state.reputation - 2);
      this.state.stats.customersLost += 1;
    }
    this.cancelCustomerOrder(customer);
    this.beginDeparture(customer, true);
    gameEvents.emit('toast', { message: 'Um cliente perdeu a paciência. Reputação −2.', tone: 'danger' });
  }

  private requestPayment(customer: CustomerRuntime): void {
    if (customer.paymentCompleted || customer.state !== 'eating') return;
    const table = this.tableFor(customer.tableId); const seat = this.seatFor(customer.seatId);
    if (!table || !seat) { this.beginDeparture(customer, false); return; }
    this.setCustomerState(customer, 'paying'); seat.state = 'waiting_payment'; this.refreshTableState(table);
    this.tasks.add({
      key: `payment:${customer.id}`, kind: 'payment', role: 'service', target: seat.servicePoint,
      duration: BALANCE.actionSeconds.payment, priority: 95, payload: { customerId: customer.id, tableId: table.id, seatId: seat.seatId },
      reservations: [{ type: 'seat', id: seat.seatId }],
    }, this.simulationTime);
  }

  private beginDeparture(customer: CustomerRuntime, gaveUp: boolean): void {
    if (!customer.cleanupCompleted) this.cleanupCustomerReferences(customer);
    this.setCustomerState(customer, gaveUp ? 'gave_up' : 'standing');
    this.setCustomerState(customer, gaveUp ? 'gave_up' : 'leaving');
    customer.retryCount = 0; customer.path = [];
    this.routeCustomerToExit(customer);
  }

  private cleanupCustomerReferences(customer: CustomerRuntime): void {
    if (customer.cleanupCompleted) return;
    const table = this.tableFor(customer.tableId); const seat = this.seatFor(customer.seatId);
    this.cancelTasksForCustomer(customer.id);
    if (seat && seat.customerId === customer.id) {
      seat.customerId = undefined; seat.reservationId = undefined; seat.state = 'dirty';
      const tableId = seat.tableId;
      this.tasks.add({
        key: `clean:${seat.seatId}`, kind: 'clean', role: 'cleaning', target: seat.approach,
        duration: BALANCE.actionSeconds.clean, priority: 82, payload: { tableId, seatId: seat.seatId, customerId: customer.id },
        reservations: [{ type: 'seat', id: seat.seatId }],
      }, this.simulationTime);
    }
    if (table) this.refreshTableState(table);
    customer.tableId = undefined; customer.seatId = undefined; customer.chairIds = []; customer.cleanupCompleted = true;
    this.grid.releaseReservations(customer.id);
  }

  private cancelTasksForCustomer(customerId: string): void {
    const cancelled = this.tasks.cancelWhere((task) => task.payload.customerId === customerId, 'Cliente não está mais disponível.');
    for (const task of cancelled) {
      for (const actor of this.actors.filter((entry) => entry.taskId === task.id)) this.clearActorTask(actor);
      this.releaseTaskStation(task);
    }
  }

  private cancelCustomerOrder(customer: CustomerRuntime): void {
    const order = this.orders.find((item) => item.id === customer.orderId);
    if (!order || TERMINAL_ORDER_STATES.has(order.state)) return;
    if (order.ingredientsState === 'reserved') {
      releaseReservation(this.state, order.ingredientReservation); order.ingredientsState = 'released';
    }
    const slot = this.slotForOrder(order.id);
    if (slot?.state === 'occupied' || order.state === 'transporting') this.storeFinishedDish(order);
    if (slot) this.clearCounterSlot(slot);
    order.state = 'cancelled';
  }

  private updateActors(delta: number): void {
    for (const actor of this.actors) {
      if (!actor.taskId) this.claimTask(actor);
      if (!actor.taskId) { actor.activity = 'Sem tarefa'; actor.idleReason = `Nenhuma tarefa de ${this.roleLabel(this.primaryRole(actor))}`; continue; }
      const task = this.tasks.get(actor.taskId);
      if (!task || ['completed', 'cancelled'].includes(task.status)) { this.clearActorTask(actor); continue; }
      if (actor.path.length) {
        actor.activity = `A caminho · ${TASK_LABELS[task.kind]}`;
        const result = this.advanceMover(actor, delta, this.workerSpeed(actor));
        this.handleActorMovement(actor, task, result, delta);
      }
      if (!actor.path.length && ['reserved', 'moving'].includes(task.status)) this.activateTask(actor, task);
      if (task.status === 'executing') {
        actor.taskRemaining -= delta;
        const station = this.stationFromTask(task);
        if (station) station.remaining = Math.max(0, actor.taskRemaining);
        if (actor.taskRemaining <= 0) this.completeTask(actor, task);
      }
    }
  }

  private claimTask(actor: WorkerActor): void {
    const roles = this.rolesForActor(actor);
    const task = this.tasks.claim(actor.id, roles, actor.preferredTaskId, (candidate) => {
      const station = this.stationFromTask(candidate);
      return !station || station.state === 'free' || station.queue[0] === candidate.payload.orderId;
    });
    actor.preferredTaskId = undefined;
    if (!task) return;
    const path = findPath(this.grid, actor.position, task.target, actor.id);
    if (!path.length && !this.samePoint(actor.position, task.target)) {
      this.tasks.release(task.id, actor.id, 'Ponto de interação temporariamente bloqueado.');
      actor.activity = 'Caminho bloqueado'; actor.idleReason = 'Aguardando nova rota'; actor.retryCount += 1;
      return;
    }
    actor.taskId = task.id; actor.path = path; actor.pathStatus = path.length ? 'moving' : 'arrived';
    if (path.length) this.tasks.markMoving(task.id, actor.id);
    if (task.kind === 'deliver' && task.payload.deliveryStage === 'serve') { actor.carrying = 'dish'; actor.carryingOrderId = String(task.payload.orderId); }
    if (task.kind === 'stock_support') actor.carrying = 'ingredients';
    const station = this.stationFromTask(task);
    if (station) { station.state = 'reserved'; station.workerId = actor.id; }
  }

  private activateTask(actor: WorkerActor, task: RestaurantTask): void {
    if (!this.tasks.activate(task.id, actor.id)) return;
    if (task.kind === 'cook_step') {
      const order = this.orderFor(task.payload.orderId);
      if (!order || order.state === 'cancelled') { this.tasks.cancel(task.id); this.clearActorTask(actor); return; }
      if (order.ingredientsState === 'reserved' && !consumeReservation(this.state, order.ingredientReservation)) {
        releaseReservation(this.state, order.ingredientReservation); order.ingredientsState = 'released'; order.state = 'awaiting_ingredients';
        this.tasks.cancel(task.id, 'Reserva de ingredientes ficou inválida.'); this.clearActorTask(actor); return;
      }
      if (order.ingredientsState === 'reserved') order.ingredientsState = 'consumed';
      order.state = 'preparing'; order.assignedActorId = actor.id;
    }
    actor.taskRemaining = this.taskDuration(actor, task); actor.activity = TASK_LABELS[task.kind]; actor.idleReason = '';
    const station = this.stationFromTask(task);
    if (station) {
      station.state = 'in_use'; station.workerId = actor.id; station.remaining = actor.taskRemaining;
      actor.direction = directionBetween(actor.position, station.position, actor.direction);
    }
  }

  private handleActorMovement(actor: WorkerActor, task: RestaurantTask, result: MovementResult, delta: number): void {
    if (result.moved) { actor.lastMovementAt = this.simulationTime; actor.blockedSeconds = 0; actor.retryCount = 0; actor.pathStatus = actor.path.length ? 'moving' : 'arrived'; return; }
    if (!result.blocked) return;
    actor.blockedSeconds += delta; actor.pathStatus = 'blocked';
    if (actor.blockedSeconds < BALANCE.movementRecovery.retrySeconds) return;
    actor.blockedSeconds = 0; actor.retryCount += 1; this.grid.releaseReservations(actor.id);
    const path = findPath(this.grid, actor.position, task.target, actor.id);
    if (path.length || this.samePoint(actor.position, task.target)) { actor.path = path; actor.pathStatus = path.length ? 'moving' : 'arrived'; return; }
    this.releaseTaskStation(task);
    this.tasks.release(task.id, actor.id, 'Rota indisponível; tarefa devolvida à fila.');
    if (task.retryCount >= BALANCE.movementRecovery.maxTaskRetries) this.tasks.cancel(task.id, 'Destino permaneceu impossível após várias tentativas.');
    this.clearActorTask(actor);
  }

  private completeTask(actor: WorkerActor, task: RestaurantTask): void {
    if (!this.tasks.complete(task.id, actor.id)) return;
    this.releaseTaskStation(task);
    this.resolveTask(actor, task);
    if (actor.kind === 'player') awardPlayerTaskXp(this.state, task.kind);
    this.clearActorTask(actor); this.tasks.prune();
  }

  private resolveTask(actor: WorkerActor, task: RestaurantTask): void {
    const customer = this.customerFor(task.payload.customerId); const table = this.tableFor(task.payload.tableId); const seat = this.seatFor(task.payload.seatId);
    if (task.kind === 'take_order' && customer && table && seat && customer.state === 'waiting_order') this.placeOrder(customer, table, seat);
    else if (task.kind === 'cook_step') this.finishCookStep(String(task.payload.orderId));
    else if (task.kind === 'deliver' && task.payload.deliveryStage === 'collect') this.collectDish(actor, String(task.payload.orderId));
    else if (task.kind === 'deliver') this.serveDish(actor, String(task.payload.orderId));
    else if (task.kind === 'payment' && customer && table && seat && customer.state === 'paying') this.completePayment(customer, table, seat);
    else if (task.kind === 'clean' && table && seat && seat.state === 'dirty') {
      seat.state = 'free'; seat.orderId = undefined; seat.reservationId = undefined; this.refreshTableState(table);
    } else if (task.kind === 'stock_support') {
      actor.carrying = undefined;
      const order = this.orderFor(task.payload.orderId);
      if (order?.state === 'awaiting_station' && order.ingredientsState === 'reserved') this.createCookStep(order);
    }
  }

  private placeOrder(customer: CustomerRuntime, table: TableRuntime, seat: ChairRuntime): void {
    if (customer.orderId) return;
    const available = RECIPES.filter((recipe) => recipe.requiredLevel <= this.state.restaurantLevel);
    const recipe = available[(this.customerSequence + this.orders.length) % available.length];
    const order: OrderRuntime = {
      id: stableRuntimeId('order'), customerId: customer.id, tableId: table.id, seatId: seat.seatId, chairId: seat.chairId,
      recipeId: recipe.id, quantity: 1, state: 'requested', createdAt: this.simulationTime, priority: 80,
      stepIndex: 0, plateId: stableRuntimeId('plate'), ingredientReservation: {}, ingredientsState: 'none', paymentCompleted: false,
    };
    this.orders.push(order); customer.orderId = order.id; seat.orderId = order.id; seat.state = 'waiting_food'; this.setCustomerState(customer, 'waiting_food'); this.refreshTableState(table);
    if (this.state.readyDishes[recipe.id] > 0 && this.placeReadyDishOnCounter(order)) return;
    const reservation = reserveRecipe(this.state, recipe, 1);
    if (!reservation) {
      order.state = 'awaiting_ingredients';
      const firstStation = this.stations.find((station) => station.id === recipe.steps[0].stationId);
      if (firstStation) firstStation.state = 'no_ingredients';
      gameEvents.emit('toast', { message: `${this.missingIngredientLabel(order)} · pedido mantido na fila.`, tone: 'warning' });
      return;
    }
    order.ingredientReservation = reservation; order.ingredientsState = 'reserved'; order.state = 'awaiting_station'; this.createCookStep(order);
  }

  private placeReadyDishOnCounter(order: OrderRuntime): boolean {
    const slot = this.reserveCounterSlot(order.id);
    if (!slot) { order.state = 'awaiting_station'; return false; }
    if (this.state.readyDishes[order.recipeId] <= 0) { this.clearCounterSlot(slot); return false; }
    this.state.readyDishes[order.recipeId] -= 1; slot.state = 'occupied'; order.counterSlotId = slot.id; order.state = 'awaiting_pickup'; this.createDelivery(order); return true;
  }

  private createCookStep(order: OrderRuntime): void {
    if (order.state === 'cancelled') return;
    const recipe = RECIPE_BY_ID[order.recipeId]; const step = recipe.steps[order.stepIndex];
    if (!step) return;
    const station = this.stations.find((item) => item.id === step.stationId);
    if (!station) { order.state = 'cancelled'; return; }
    if (step.stationId === 'pickup' && !order.counterSlotId) {
      const slot = this.reserveCounterSlot(order.id);
      if (!slot) { order.state = 'awaiting_station'; station.state = 'blocked'; return; }
      order.counterSlotId = slot.id;
    }
    if (!station.queue.includes(order.id)) station.queue.push(order.id);
    station.currentStep = step.label; order.state = 'awaiting_station';
    this.tasks.add({
      key: `cook:${order.id}:${order.stepIndex}`, kind: 'cook_step', role: 'kitchen',
      target: step.stationId === 'pickup' ? PICKUP_KITCHEN_POINT : station.interaction,
      duration: step.duration / BALANCE.cookingSpeedMultiplier, priority: 60 + order.priority / 10,
      payload: { orderId: order.id, stationId: station.id, customerId: order.customerId, tableId: order.tableId, seatId: order.seatId },
      reservations: [{ type: 'station', id: station.id }, ...(order.counterSlotId ? [{ type: 'counter' as const, id: order.counterSlotId }] : [])],
    }, this.simulationTime);
  }

  private finishCookStep(orderId: string): void {
    const order = this.orderFor(orderId);
    if (!order || order.state === 'cancelled') return;
    const recipe = RECIPE_BY_ID[order.recipeId]; order.stepIndex += 1; order.assignedActorId = undefined;
    if (order.stepIndex < recipe.steps.length) { this.createCookStep(order); return; }
    const slot = order.counterSlotId ? this.counterSlots.find((item) => item.id === order.counterSlotId) : undefined;
    if (!slot) { order.state = 'awaiting_station'; return; }
    slot.state = 'occupied'; slot.orderId = order.id; slot.reservedBy = undefined;
    const customer = this.customerFor(order.customerId);
    if (!customer || ['gone', 'gave_up', 'leaving'].includes(customer.state)) { this.storeFinishedDish(order); this.clearCounterSlot(slot); order.state = 'cancelled'; return; }
    order.state = 'awaiting_pickup'; this.createDelivery(order);
  }

  private createDelivery(order: OrderRuntime): void {
    this.tasks.add({
      key: `deliver:${order.id}:collect`, kind: 'deliver', role: 'service', target: PICKUP_SERVICE_POINT,
      duration: Math.min(1.2, BALANCE.actionSeconds.deliver / 2), priority: 100,
      payload: { orderId: order.id, customerId: order.customerId, tableId: order.tableId, seatId: order.seatId, stationId: 'pickup', deliveryStage: 'collect' },
      reservations: order.counterSlotId ? [{ type: 'counter', id: order.counterSlotId }] : [],
    }, this.simulationTime);
  }

  private collectDish(actor: WorkerActor, orderId: string): void {
    const order = this.orderFor(orderId); const slot = order ? this.slotForOrder(order.id) : undefined;
    if (!order || order.state !== 'awaiting_pickup' || !slot || slot.state !== 'occupied') return;
    this.clearCounterSlot(slot); order.state = 'transporting'; order.assignedActorId = actor.id; actor.carrying = 'dish'; actor.carryingOrderId = order.id;
    const seat = this.seatFor(order.seatId);
    if (!seat) { this.storeFinishedDish(order); order.state = 'cancelled'; return; }
    const nextTask = this.tasks.add({
      key: `deliver:${order.id}:serve`, kind: 'deliver', role: 'service', target: seat.servicePoint,
      duration: Math.max(1.2, BALANCE.actionSeconds.deliver / 2), priority: 110,
      payload: { orderId: order.id, customerId: order.customerId, tableId: order.tableId, seatId: order.seatId, deliveryStage: 'serve' },
      reservations: [{ type: 'seat', id: order.seatId }],
    }, this.simulationTime);
    actor.preferredTaskId = nextTask.id;
  }

  private serveDish(actor: WorkerActor, orderId: string): void {
    const order = this.orderFor(orderId); const customer = order ? this.customerFor(order.customerId) : undefined; const seat = order ? this.seatFor(order.seatId) : undefined; const table = order ? this.tableFor(order.tableId) : undefined;
    actor.carrying = undefined; actor.carryingOrderId = undefined;
    if (!order || order.state !== 'transporting') return;
    if (!customer || !seat || !table || customer.state !== 'waiting_food' || seat.customerId !== customer.id) { this.storeFinishedDish(order); order.state = 'cancelled'; return; }
    order.state = 'delivered'; customer.eatRemaining = BALANCE.customerEatSeconds; this.setCustomerState(customer, 'eating'); seat.state = 'eating'; this.refreshTableState(table);
  }

  private completePayment(customer: CustomerRuntime, table: TableRuntime, seat: ChairRuntime): void {
    const order = this.orderFor(customer.orderId);
    if (!order || customer.paymentCompleted || order.paymentCompleted) return;
    const recipe = RECIPE_BY_ID[order.recipeId]; const earned = recipe.salePrice;
    customer.paymentCompleted = true; order.paymentCompleted = true; order.state = 'consumed';
    this.state.coins += earned; this.state.restaurantXp += recipe.experience + 2; this.state.reputation = Math.min(100, this.state.reputation + 1);
    this.state.stats.customersServed += 1; this.state.stats.coinsEarned += earned;
    this.beginDeparture(customer, false); this.refreshTableState(table);
    gameEvents.emit('toast', { message: `${recipe.name} servido · +${earned} moedas`, tone: 'success' });
  }

  retryBlockedOrders(): void {
    for (const order of this.orders.filter((item) => item.state === 'awaiting_ingredients')) {
      const recipe = RECIPE_BY_ID[order.recipeId]; if (!canConsumeRecipe(this.state, recipe, 1)) continue;
      const reservation = reserveRecipe(this.state, recipe, 1); if (!reservation) continue;
      order.ingredientReservation = reservation; order.ingredientsState = 'reserved'; order.state = 'awaiting_station';
      this.tasks.add({
        key: `stock:${order.id}`, kind: 'stock_support', role: 'stock', target: { x: 3, y: 5 }, duration: 2.5, priority: 88,
        payload: { orderId: order.id, customerId: order.customerId, tableId: order.tableId, seatId: order.seatId },
        reservations: Object.keys(reservation).map((id) => ({ type: 'ingredient' as const, id })),
      }, this.simulationTime);
    }
    if (!this.orders.some((item) => item.state === 'awaiting_ingredients')) for (const station of this.stations) if (station.state === 'no_ingredients') station.state = 'free';
  }

  private retryCounterOrders(): void {
    for (const order of this.orders.filter((item) => item.state === 'awaiting_station')) {
      const recipe = RECIPE_BY_ID[order.recipeId];
      if (order.ingredientsState === 'none' && this.state.readyDishes[order.recipeId] > 0) { this.placeReadyDishOnCounter(order); continue; }
      const step = recipe.steps[order.stepIndex];
      if (step?.stationId !== 'pickup' || order.counterSlotId || this.counterSlots.some((slot) => slot.state === 'free')) this.createCookStep(order);
    }
  }

  setPlayerRole(role: HelpRole): void {
    if (!this.state.profile) return;
    const actor = this.playerActor(); const task = actor.taskId ? this.tasks.get(actor.taskId) : undefined;
    this.state.profile.helpRole = role;
    if (task && ['reserved', 'moving'].includes(task.status)) { this.tasks.release(task.id, actor.id); this.clearActorTask(actor); }
    gameEvents.emit('toast', { message: `Agora você prioriza: ${this.roleLabel(role)}.`, tone: 'info' });
  }

  prioritizeForPlayer(taskId: string): boolean {
    const task = this.tasks.get(taskId); const player = this.playerActor();
    if (!task || task.status !== 'pending' || task.role !== this.state.profile?.helpRole) return false;
    player.preferredTaskId = taskId; return true;
  }

  prioritizeWorldTarget(type: 'table' | 'station', id: string): boolean {
    const task = this.tasks.list().find((candidate) => candidate.status === 'pending' && (type === 'table' ? candidate.payload.tableId === id : candidate.payload.stationId === id));
    return task ? this.prioritizeForPlayer(task.id) : false;
  }

  cancelPlayerPendingTask(): boolean {
    const actor = this.playerActor(); if (!actor.taskId) return false;
    const task = this.tasks.get(actor.taskId); if (!task || !['reserved', 'moving'].includes(task.status)) return false;
    this.tasks.release(task.id, actor.id); this.clearActorTask(actor); actor.activity = 'Tarefa devolvida'; return true;
  }

  setTimeScale(value: number): void { this.speed = value === 0 ? 0 : value === 2 ? 2 : value === 4 ? 4 : 1; }
  timeScale(): 0 | 1 | 2 | 4 { return this.speed; }
  animationClockMs(): number { return this.visualClock; }
  playerTaskLabel(): string { return this.playerActor().activity; }
  playerIdleReason(): string { return this.playerActor().idleReason; }
  playerDestinationLabel(): string {
    const actor = this.playerActor(); const task = actor.taskId ? this.tasks.get(actor.taskId) : undefined;
    return task ? `${task.target.x},${task.target.y}` : '—';
  }
  customerLabel(customer: CustomerRuntime): string { return CUSTOMER_LABELS[customer.state]; }
  activeCustomerCount(): number { return this.customers.filter((customer) => customer.state !== 'gone').length; }
  seatedCustomerCount(): number { return this.tables.flatMap((table) => table.chairs).filter((seat) => ACTIVE_SEAT_STATES.has(seat.state)).length; }
  totalCapacity(): number { return this.tables.flatMap((table) => table.chairs).filter((seat) => this.seatUsable(seat)).length; }
  dishesAwaitingPickup(): number { return this.counterSlots.filter((slot) => slot.state === 'occupied').length; }
  activeOrderCount(): number { return this.orders.filter((order) => !TERMINAL_ORDER_STATES.has(order.state)).length; }

  debugAddCustomer(): CustomerRuntime | undefined { return this.spawnParty(1)[0]; }
  debugAddGroup(size = 4): CustomerRuntime[] { return this.spawnParty(size); }
  debugSimulateOrder(): boolean {
    let customer = this.customers.find((item) => item.state === 'waiting_order');
    if (!customer) { customer = this.debugAddCustomer(); this.debugRunFor(16); }
    if (customer?.orderId) return true;
    if (!customer || customer.state !== 'waiting_order') return false;
    const table = this.tableFor(customer.tableId); const seat = this.seatFor(customer.seatId);
    if (!table || !seat) return false;
    this.placeOrder(customer, table, seat); return Boolean(customer.orderId);
  }
  debugReducePatience(): void { for (const customer of this.customers) customer.patience = Math.min(customer.patience, 5); }
  debugDirtySeat(): void {
    const seat = this.tables.flatMap((table) => table.chairs).find((item) => item.state === 'free');
    if (!seat) return; seat.state = 'dirty'; const table = this.tableFor(seat.tableId)!; this.refreshTableState(table);
    this.tasks.add({ key: `clean:${seat.seatId}`, kind: 'clean', role: 'cleaning', target: seat.approach, duration: BALANCE.actionSeconds.clean, priority: 82, payload: { tableId: table.id, seatId: seat.seatId } }, this.simulationTime);
  }
  debugRunFor(seconds: number, speed: 1 | 2 | 4 = 4): void {
    const before = this.speed; this.speed = speed;
    for (let elapsed = 0; elapsed < seconds; elapsed += .05 * speed) this.update(.05);
    this.speed = before;
  }
  debugSetAutoSpawn(enabled: boolean): void { this.autoSpawn = enabled; }
  debugBeginDeparture(customer: CustomerRuntime, gaveUp = false): void { if (gaveUp) this.customerGivesUp(customer); else this.beginDeparture(customer, false); }

  missingIngredients(): { id: IngredientId; needed: number; available: number }[] {
    const demand = new Map<IngredientId, number>();
    for (const order of this.orders.filter((item) => item.state === 'awaiting_ingredients')) {
      for (const part of RECIPE_BY_ID[order.recipeId].ingredients) demand.set(part.ingredientId, (demand.get(part.ingredientId) ?? 0) + part.amount);
    }
    return [...demand].map(([id, needed]) => ({ id, needed, available: Math.max(0, this.state.inventory[id] - this.state.inventoryReserved[id]) })).filter((item) => item.available < item.needed);
  }

  prepareSave(now = Date.now()): OperationSaveState {
    const operation: OperationSaveState = {
      dataVersion: 1, savedAt: now, simulationTime: this.simulationTime, customerSequence: this.customerSequence, spawnCountdown: this.spawnCountdown,
      actors: this.toRecords(this.actors), customers: this.toRecords(this.customers.filter((customer) => customer.state !== 'gone')),
      orders: this.toRecords(this.orders), tables: this.toRecords(this.tables), stations: this.toRecords(this.stations),
      tasks: this.tasks.serialize(), counterSlots: this.toRecords(this.counterSlots),
    };
    this.state.operation = operation; return operation;
  }

  private restoreOperation(operation: OperationSaveState): void {
    this.simulationTime = operation.simulationTime; this.customerSequence = operation.customerSequence; this.spawnCountdown = operation.spawnCountdown;
    const savedTables = operation.tables as unknown as TableRuntime[];
    for (const table of this.tables) {
      const saved = savedTables.find((item) => item.id === table.id); if (!saved) continue;
      for (const seat of table.chairs) {
        const savedSeat = saved.chairs?.find((item) => item.seatId === seat.seatId || item.id === seat.id);
        if (savedSeat) Object.assign(seat, savedSeat, { position: seat.position, approach: seat.approach, sitPoint: seat.sitPoint, servicePoint: seat.servicePoint, platePosition: seat.platePosition, dirtPosition: seat.dirtPosition, enabled: seat.enabled, accessible: seat.accessible });
      }
      this.refreshTableState(table);
    }
    const savedStations = operation.stations as unknown as StationRuntime[];
    for (const station of this.stations) {
      const saved = savedStations.find((item) => item.id === station.id); if (!saved) continue;
      Object.assign(station, saved, {
        position: station.position, interaction: station.interaction, interactionPoints: station.interactionPoints,
        state: saved.state === 'no_ingredients' ? 'no_ingredients' : 'free', workerId: undefined, remaining: 0, currentStep: undefined,
      });
    }
    const savedActors = operation.actors as unknown as WorkerActor[];
    for (const actor of this.actors) {
      const saved = savedActors.find((item) => item.id === actor.id); if (!saved) continue;
      Object.assign(actor, saved, { taskId: undefined, path: [], moveProgress: 0, carrying: saved.carrying, carryingOrderId: saved.carryingOrderId });
    }
    for (const raw of operation.customers as unknown as CustomerRuntime[]) if (raw?.id && raw.position && raw.state !== 'gone') this.customers.push({ ...raw, path: [], moveProgress: 0, blockedSeconds: 0, pathStatus: 'idle' });
    for (const raw of operation.orders as unknown as OrderRuntime[]) if (raw?.id && RECIPE_BY_ID[raw.recipeId]) this.orders.push({ ...raw, ingredientReservation: raw.ingredientReservation ?? {}, paymentCompleted: Boolean(raw.paymentCompleted) });
    const slots = operation.counterSlots as unknown as CounterSlotRuntime[];
    for (const slot of this.counterSlots) { const saved = slots.find((item) => item.id === slot.id); if (saved) Object.assign(slot, saved); }
    this.tasks.restore(operation.tasks);
  }

  private rebuildOccupancy(): void {
    const used = new Set<string>();
    const occupy = (mover: Mover, fallback: GridPoint) => {
      const key = `${mover.position.x},${mover.position.y}`;
      if (!this.grid.inBounds(mover.position) || !this.grid.get(mover.position)?.walkable || used.has(key)) { mover.position = { ...fallback }; mover.visual = { ...fallback }; }
      used.add(`${mover.position.x},${mover.position.y}`); this.grid.occupy(mover.position, mover.id);
    };
    const defaults = this.createDefaultActors();
    this.actors.forEach((actor, index) => occupy(actor, defaults[index].position));
    for (const customer of [...this.customers]) {
      const fallback = STREET_ENTRY_POINTS[customer.variant % STREET_ENTRY_POINTS.length];
      if (used.has(`${customer.position.x},${customer.position.y}`)) { customer.pathStatus = 'blocked'; customer.retryCount += 1; }
      else occupy(customer, fallback);
    }
  }

  private reconcileOperation(): void {
    for (const id of Object.keys(this.state.inventoryReserved) as IngredientId[]) this.state.inventoryReserved[id] = 0;
    for (const order of this.orders) {
      if (order.ingredientsState === 'reserved') {
        const valid = Object.entries(order.ingredientReservation).every(([rawId, amount]) => this.state.inventory[rawId as IngredientId] >= (amount ?? 0));
        if (valid) for (const [rawId, amount] of Object.entries(order.ingredientReservation)) this.state.inventoryReserved[rawId as IngredientId] += amount ?? 0;
        else { order.ingredientsState = 'released'; order.state = 'awaiting_ingredients'; }
      }
      if (order.state === 'preparing') order.state = 'awaiting_station';
      if (order.state === 'transporting') {
        const slot = this.reserveCounterSlot(order.id);
        if (slot) { slot.state = 'occupied'; order.counterSlotId = slot.id; order.state = 'awaiting_pickup'; }
        else { this.storeFinishedDish(order); order.state = 'cancelled'; }
      }
      if (order.state === 'awaiting_pickup') {
        let slot = this.slotForOrder(order.id);
        if (!slot) slot = this.reserveCounterSlot(order.id);
        if (slot) { slot.state = 'occupied'; order.counterSlotId = slot.id; this.createDelivery(order); }
      }
      if (order.state === 'awaiting_station') this.createCookStep(order);
    }
    for (const customer of this.customers) {
      if (customer.state === 'leaving' || customer.state === 'gave_up') { if (!customer.cleanupCompleted) this.cleanupCustomerReferences(customer); this.routeCustomerToExit(customer); }
      else if (customer.state === 'entering') this.routeCustomer(customer, ENTRANCE);
      else if (customer.state === 'walking_to_seat') this.routeCustomerToSeat(customer);
      else if (customer.state === 'waiting_order') {
        const seat = this.seatFor(customer.seatId); if (seat) this.tasks.add({ key: `order:${customer.id}`, kind: 'take_order', role: 'service', target: seat.servicePoint, duration: BALANCE.actionSeconds.takeOrder, priority: 70, payload: { customerId: customer.id, tableId: seat.tableId, seatId: seat.seatId } }, this.simulationTime);
      } else if (customer.state === 'paying') this.requestPayment(customer);
    }
    for (const table of this.tables) for (const seat of table.chairs) if (seat.state === 'dirty') this.tasks.add({ key: `clean:${seat.seatId}`, kind: 'clean', role: 'cleaning', target: seat.approach, duration: BALANCE.actionSeconds.clean, priority: 82, payload: { tableId: table.id, seatId: seat.seatId } }, this.simulationTime);
  }

  private refreshTableState(table: TableRuntime): void {
    const states = table.chairs.filter((seat) => this.seatUsable(seat)).map((seat) => seat.state);
    table.customerId = table.chairs.find((seat) => seat.customerId)?.customerId;
    if (!table.accessible || !states.length) table.state = 'unavailable';
    else if (states.includes('waiting_payment')) table.state = 'waiting_payment';
    else if (states.includes('eating')) table.state = 'eating';
    else if (states.includes('waiting_food')) table.state = 'waiting_food';
    else if (states.includes('waiting_order')) table.state = 'waiting_order';
    else if (states.includes('cleaning')) table.state = 'cleaning';
    else if (states.includes('dirty')) table.state = 'dirty';
    else if (states.some((state) => ACTIVE_SEAT_STATES.has(state))) table.state = 'occupied';
    else table.state = 'free';
  }

  private releaseCustomerSeat(customer: CustomerRuntime, dirty: boolean): void {
    const seat = this.seatFor(customer.seatId); const table = seat ? this.tableFor(seat.tableId) : undefined;
    if (seat?.customerId === customer.id) { seat.customerId = undefined; seat.reservationId = undefined; seat.state = dirty ? 'dirty' : 'free'; }
    customer.tableId = undefined; customer.seatId = undefined; customer.chairIds = []; customer.path = []; this.setCustomerState(customer, 'queueing');
    if (table) this.refreshTableState(table);
  }

  private reserveCounterSlot(orderId: string): CounterSlotRuntime | undefined {
    const existing = this.slotForOrder(orderId); if (existing) return existing;
    const slot = this.counterSlots.find((item) => item.state === 'free');
    if (slot) { slot.state = 'reserved'; slot.orderId = orderId; slot.reservedBy = orderId; }
    return slot;
  }
  private clearCounterSlot(slot: CounterSlotRuntime): void { slot.state = 'free'; slot.orderId = undefined; slot.reservedBy = undefined; }
  private slotForOrder(orderId: string): CounterSlotRuntime | undefined { return this.counterSlots.find((slot) => slot.orderId === orderId); }
  private storeFinishedDish(order: OrderRuntime): void {
    const free = readyDishCapacity(this.state) - readyDishUsed(this.state);
    if (free >= 1) this.state.readyDishes[order.recipeId] += 1;
  }
  private missingIngredientLabel(order: OrderRuntime): string {
    const missing = RECIPE_BY_ID[order.recipeId].ingredients.find((part) => this.state.inventory[part.ingredientId] - this.state.inventoryReserved[part.ingredientId] < part.amount);
    return missing ? `FALTA ${missing.ingredientId.toUpperCase()} · necessário ${missing.amount}` : 'Faltam ingredientes';
  }
  private releaseTaskStation(task: RestaurantTask): void {
    const station = this.stationFromTask(task);
    if (station) { station.state = 'free'; station.workerId = undefined; station.remaining = 0; station.currentStep = undefined; station.queue = station.queue.filter((id) => id !== task.payload.orderId); }
  }
  private clearActorTask(actor: WorkerActor): void {
    actor.taskId = undefined; actor.taskRemaining = 0; actor.path = []; actor.moveProgress = 0; actor.activity = 'Disponível'; actor.idleReason = 'Aguardando tarefa'; actor.pathStatus = 'idle';
    if (!actor.carryingOrderId) actor.carrying = undefined;
    this.grid.releaseReservations(actor.id);
  }
  private rolesForActor(actor: WorkerActor): HelpRole[] {
    if (actor.kind === 'cook') return ['kitchen']; if (actor.kind === 'waiter') return ['service']; if (actor.kind === 'cleaner') return ['cleaning']; if (actor.kind === 'stocker') return ['stock'];
    return [this.state.profile?.helpRole ?? 'kitchen'];
  }
  private primaryRole(actor: WorkerActor): HelpRole { return this.rolesForActor(actor)[0]; }
  private advanceMover(mover: Mover, delta: number, speed: number): MovementResult { return advanceTileMover(this.grid, mover, delta, speed); }
  private workerSpeed(actor: WorkerActor): number {
    if (actor.kind !== 'player' || !this.state.profile) return 2.5 * BALANCE.movementSpeedMultiplier;
    const profession = this.professionForRole(this.state.profile.helpRole);
    return 2.5 * BALANCE.movementSpeedMultiplier * (1 + (this.state.profile.professions[profession].level - 1) * .05);
  }
  private taskDuration(actor: WorkerActor, task: RestaurantTask): number {
    if (actor.kind !== 'player' || !this.state.profile) return task.duration;
    const profession = this.professionForRole(task.role); const bonus = (this.state.profile.professions[profession].level - 1) * BALANCE.professionSpeedPerLevel;
    return task.duration * Math.max(.65, 1 - bonus);
  }
  private professionForRole(role: HelpRole): 'cook' | 'waiter' | 'cleaner' | 'stocker' { return role === 'kitchen' ? 'cook' : role === 'service' ? 'waiter' : role === 'cleaning' ? 'cleaner' : 'stocker'; }
  private stationFromTask(task: RestaurantTask): StationRuntime | undefined { return this.stations.find((station) => station.id === task.payload.stationId); }
  private playerActor(): WorkerActor { return this.actors.find((actor) => actor.kind === 'player')!; }
  private customerFor(value: unknown): CustomerRuntime | undefined { return this.customers.find((customer) => customer.id === value); }
  private orderFor(value: unknown): OrderRuntime | undefined { return this.orders.find((order) => order.id === value); }
  private tableFor(value: unknown): TableRuntime | undefined { return this.tables.find((table) => table.id === value); }
  private seatFor(value: unknown): ChairRuntime | undefined { return this.tables.flatMap((table) => table.chairs).find((seat) => seat.seatId === value || seat.id === value); }
  private partyMembers(partyId: string): CustomerRuntime[] { return this.customers.filter((customer) => customer.partyId === partyId); }
  private seatUsable(seat: ChairRuntime): boolean { return seat.enabled && seat.accessible && !['blocked', 'inaccessible'].includes(seat.state); }
  private setCustomerState(customer: CustomerRuntime, state: CustomerState): void { customer.state = state; customer.stateEnteredAt = this.simulationTime; }
  private samePoint(a: GridPoint, b: GridPoint): boolean { return a.x === b.x && a.y === b.y; }
  private distance(a: GridPoint, b: GridPoint): number { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
  private roleLabel(role: HelpRole): string { return { kitchen: 'Cozinha', service: 'Atendimento', cleaning: 'Limpeza', stock: 'Estoque e apoio' }[role]; }
  private developmentMode(): boolean { return typeof window === 'undefined' || ['localhost', '127.0.0.1'].includes(window.location.hostname); }
  private toRecords(value: unknown): Record<string, unknown>[] { return JSON.parse(JSON.stringify(value)) as Record<string, unknown>[]; }
}

function playerRenderedStyle(hairStyle?: string): string {
  const index = ['wave', 'crop', 'bun', 'curls'].indexOf(hairStyle ?? 'wave');
  return `player-style-${Math.max(0, index)}`;
}
