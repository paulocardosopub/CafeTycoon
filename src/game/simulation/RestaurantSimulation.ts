import { BALANCE } from '../../config/balance';
import { RECIPE_BY_ID, RECIPES } from '../../content/recipes/recipes';
import { INGREDIENT_BY_ID } from '../../content/ingredients/ingredients';
import type {
  ActorKind, ChairRuntime, CustomerState, Direction, GameState, GridPoint, HelpRole, IngredientId, OperationSaveState,
  RecipeId, ServiceCounterModule, StationRuntime, TableRuntime, TaskKind,
} from '../../core/types';
import { stableRuntimeId } from '../../core/id';
import { gameEvents } from '../../core/events';
import {
  canConsumeRecipe, consumeReservation, releaseReservation, reserveRecipe,
} from '../inventory/InventoryService';
import {
  createInitialGrid, createStations, createTablesFromConstruction, CUSTOMER_QUEUE,
  RESTAURANT_ENTRY_ZONE, STREET_ENTRY_POINTS, STREET_EXIT_ZONE,
} from '../map/initialMap';
import { findPath } from '../navigation/AStar';
import { advanceTileMover, directionBetween, type MovementResult } from '../navigation/TileMovement';
import { awardPlayerTaskXp, updateRestaurantLevel } from '../progression/progression';
import { TaskManager, type RestaurantTask } from '../tasks/TaskManager';
import { tickProduction, readyDishCapacity, readyDishUsed } from '../cooking/ProductionService';
import { ServiceCounterStore } from '../systems/service-counter/ServiceCounterSystem';
import { STAFF_BY_ID } from '../data/staff';
import {
  awardStaffTaskExperience, effectiveMovementSpeed, effectiveStaffSpeed, processPayrollClock, staffStateFromTask, tickTraining,
} from '../staff/StaffService';
import { completePurchaseRequest, evaluateAutoPurchases, failPurchaseRequest, setPurchaseRequestStage } from '../inventory/ProcurementService';
import { storageTargetPoint } from '../inventory/StorageService';
import {
  cancelProductionPlan, completeProductionTask, markProductionTaskStarted, prepareNextProductionTask, refreshMaintainTargetPlans,
  transferWaitingProductionOutputs,
} from '../cooking/ProductionPlanningService';
import { compatibleStationFunction, recipeIsOperational } from '../recipes/RecipeAvailability';
import { playerSkinAsset } from '../../content/characters/playerSkins';
import { CUSTOMER_CHARACTER_ASSET_IDS } from '../../assets/pixel/characterVariantManifest';

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
  motionState: 'idle' | 'walk';
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
  moduleId: string;
  recipeId?: RecipeId;
  quantity: number;
  stockReservation?: { moduleId: string; quantity: number }[];
}

const TASK_LABELS: Record<TaskKind, string> = {
  take_order: 'Anotando pedido', cook_step: 'Preparando prato', deliver: 'Servindo lugar',
  payment: 'Recebendo pagamento', clean: 'Limpando lugar', stock_support: 'Repondo pedido',
  restock_purchase: 'Buscando estoque', production_batch: 'Produzindo lote',
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
const ADMISSION_STATES = new Set<CustomerState>(['entering', 'seeking_table', 'queueing']);
const MINIMUM_QUEUE_LIMIT = 1;

export class RestaurantSimulation {
  readonly tables: TableRuntime[];
  readonly stations: StationRuntime[];
  readonly grid;
  readonly tasks = new TaskManager();
  readonly actors: WorkerActor[];
  readonly customers: CustomerRuntime[] = [];
  readonly orders: OrderRuntime[] = [];
  readonly counterModules: ServiceCounterModule[];
  readonly counterStore: ServiceCounterStore;
  readonly counterSlots: CounterSlotRuntime[];
  private spawnCountdown = 2;
  private customerSequence = 0;
  private simulationTime = 0;
  private visualClock = 0;
  private speed: 0 | 1 | 2 | 4 = 1;
  private blockedTaskRetry = 0;
  private seatAssignmentRetry = 0;
  private autoSpawn = true;
  private constructionPaused = false;
  private speedBeforeConstruction: 0 | 1 | 2 | 4 = 1;
  private automationCountdown = 0;
  private productionSchedulerCountdown = 0;

  constructor(public readonly state: GameState) {
    this.autoSpawn = state.restaurantOpen;
    this.tables = createTablesFromConstruction(state.construction);
    this.stations = createStations(state.construction);
    this.grid = createInitialGrid(this.tables, this.stations, state.construction);
    this.counterModules = state.construction.serviceCounters;
    // Prepared dishes stack by recipe. Older saves can still carry the former
    // per-counter cap, so normalize it without forcing a rebuild or save reset.
    for (const module of this.counterModules) module.maxCapacity = Number.MAX_SAFE_INTEGER;
    this.counterStore = new ServiceCounterStore(this.counterModules);
    this.counterSlots = this.counterModules.flatMap((module) => Array.from({ length: 8 }, (_, index) => ({
      id: `${module.id}:slot:${index + 1}`, moduleId: module.id, state: 'free' as const, quantity: 0,
    })));
    this.actors = this.createDefaultActors();
    if (state.operation && [1, 2, 3].includes(state.operation.dataVersion)) this.restoreOperation(state.operation);
    this.rebuildOccupancy();
    this.reconcileOperation();
  }

  private createDefaultActors(): WorkerActor[] {
    const employees = this.state.staff.instances.map((instance) => {
      const definition = STAFF_BY_ID[instance.definitionId];
      const saved = this.state.construction.staffStartPositions.find((item) => item.staffId === instance.id || item.staffId === instance.definitionId);
      const position = instance.startPosition ?? (saved ? { x: saved.gridX, y: saved.gridY } : definition.suggestedStart);
      return this.makeActor(instance.id, instance.role, instance.customName, definition.assetId, position);
    });
    const start = (staffId: string, fallback: GridPoint) => {
      const saved = this.state.construction.staffStartPositions.find((item) => item.staffId === staffId);
      return saved ? { x: saved.gridX, y: saved.gridY } : fallback;
    };
    return [
      ...employees,
      this.makeActor(this.state.playerId, 'player', this.state.profile?.name ?? 'Você', playerSkinAsset(this.state.profile?.appearance), start('player', { x: 9, y: 14 })),
    ];
  }

  private makeActor(id: string, kind: ActorKind, name: string, assetId: string, position: GridPoint): WorkerActor {
    return {
      id, kind, name, assetId, position: { ...position }, visual: { ...position }, path: [], moveProgress: 0, direction: 'se',
      activity: 'Disponível', idleReason: 'Aguardando tarefa do setor', taskRemaining: 0, lastMovementAt: 0,
      blockedSeconds: 0, retryCount: 0, pathStatus: 'idle', motionState: 'idle',
    };
  }

  update(realDeltaSeconds: number): void {
    const realDelta = Math.max(0, Math.min(.25, realDeltaSeconds));
    this.visualClock += realDelta * Math.min(this.speed, 2) * 1000;
    if (this.speed === 0 || this.constructionPaused) {
      for (const mover of [...this.actors, ...this.customers]) mover.motionState = 'idle';
      gameEvents.emit('simulation:update', undefined); return;
    }
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
    tickTraining(this.state, delta, Date.now());
    processPayrollClock(this.state, Date.now());
    this.automationCountdown -= delta;
    if (this.automationCountdown <= 0) {
      evaluateAutoPurchases(this.state, true, Date.now());
      this.automationCountdown = this.state.procurement.globalSettings.checkIntervalSeconds;
    }
    this.createRestockTasks();
    this.productionSchedulerCountdown -= delta;
    if (this.productionSchedulerCountdown <= 0) {
      this.transferReadyProductionOutputs();
      refreshMaintainTargetPlans(this.state, this.counterModules, Date.now());
      this.createProductionTask();
      this.productionSchedulerCountdown = BALANCE.production.schedulerIntervalSeconds;
    }
    this.tasks.releaseStaleReservations(BALANCE.movementRecovery.reservationTimeoutSeconds);
    this.pruneGoneCustomers();
    const production = tickProduction(this.state, delta);
    if (Object.keys(production.produced).length) gameEvents.emit('toast', { message: 'Produção programada concluída!', tone: 'success' });
    this.spawnCountdown -= delta;
    const waitingCustomers = this.admissionCustomerCount();
    const queueLimit = this.admissionQueueLimit();
    const normalCustomerLimit = this.customerDemandCapacity() + queueLimit;
    if (this.autoSpawn && this.spawnCountdown <= 0 && waitingCustomers < queueLimit && this.activeCustomerCount() < normalCustomerLimit) {
      const nextPartySize = this.customerSequence > 0 && this.customerSequence % 9 === 0 ? 4 : this.customerSequence > 0 && this.customerSequence % 5 === 0 ? 2 : 1;
      const openTableSize = this.largestOpenTableSize();
      const supportedPartySize = Math.min(nextPartySize, this.largestTableCapacity());
      const queueAllowance = queueLimit - waitingCustomers;
      const admissionSize = Math.min(supportedPartySize, normalCustomerLimit - this.activeCustomerCount(), openTableSize || queueAllowance);
      if (admissionSize > 0) this.spawnParty(admissionSize);
      const demandScale = Math.max(.45, Math.sqrt(this.customerDemandCapacity() / 2) * this.reputationDemandFactor());
      this.spawnCountdown = Math.max(2, BALANCE.customerSpawnSeconds / demandScale) + (this.customerSequence % 3);
    }
    this.seatAssignmentRetry -= delta;
    if (this.seatAssignmentRetry <= 0) {
      this.assignWaitingParties();
      this.seatAssignmentRetry = .25;
    }
    this.retryBlockedOrders();
    this.retryCounterOrders();
    this.retryWaitingCustomerOrders();
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
    const partyPatience = BALANCE.customerBasePatienceSeconds + (partySize - 1) * 45;
    const members: CustomerRuntime[] = [];
    for (let index = 0; index < partySize; index += 1) {
      this.customerSequence += 1;
      const streetSpawn = spawnCells[index];
      const customer: CustomerRuntime = {
        id: stableRuntimeId('customer'), state: 'entering', stateEnteredAt: this.simulationTime, partyId, partySize, partyIndex: index,
        patience: partyPatience, maxPatience: partyPatience,
        position: { ...streetSpawn }, visual: { ...streetSpawn }, path: [], moveProgress: 0, chairIds: [], eatRemaining: 0,
        variant: (this.customerSequence - 1) % CUSTOMER_CHARACTER_ASSET_IDS.length, direction: 'nw', lastMovementAt: this.simulationTime, blockedSeconds: 0,
        retryCount: 0, pathStatus: 'idle', motionState: 'idle', cleanupCompleted: false, paymentCompleted: false, outcomeApplied: false,
      };
      this.customers.push(customer);
      this.grid.occupy(customer.position, customer.id);
      this.routeCustomerToEntrance(customer);
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
    const parties = [...new Set(this.customers.filter((customer) => ['seeking_table', 'queueing'].includes(customer.state)).map((customer) => customer.partyId))]
      .map((partyId) => this.partyMembers(partyId).filter((customer) => customer.state !== 'gone'))
      .filter((members) => members.length > 0)
      .sort((left, right) => Math.min(...left.map((customer) => customer.stateEnteredAt)) - Math.min(...right.map((customer) => customer.stateEnteredAt)));
    let mayAssignSeat = true;
    for (const members of parties) {
      if (members.some((customer) => !['seeking_table', 'queueing'].includes(customer.state))) continue;
      if (members.some((customer) => customer.path.length > 0)) { mayAssignSeat = false; continue; }
      if (mayAssignSeat && this.assignSeats(members)) continue;
      this.sendPartyToQueue(members);
      // FIFO estrito: se o primeiro grupo não couber, nenhum recém-chegado
      // pode ultrapassá-lo enquanto aguarda a próxima mesa livre.
      mayAssignSeat = false;
    }
  }

  private admissionCustomerCount(): number {
    return this.customers.filter((customer) => ADMISSION_STATES.has(customer.state) && !customer.seatId).length;
  }

  private admissionQueueLimit(): number {
    return Math.max(MINIMUM_QUEUE_LIMIT, Math.ceil(this.customerDemandCapacity() * .5));
  }

  private reputationDemandFactor(): number {
    return .15 + Math.max(0, Math.min(100, this.state.reputation)) / 100 * .85;
  }

  private largestOpenTableSize(): number {
    return this.tables.reduce((largest, table) => {
      if (!table.accessible) return largest;
      const free = table.chairs.filter((chair) => this.seatUsable(chair) && chair.state === 'free').length;
      return Math.max(largest, free);
    }, 0);
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
    const claimed = new Set(this.customers
      .filter((entry) => entry.state === 'queueing' && !members.includes(entry))
      .flatMap((entry) => [entry.position, entry.path.at(-1)])
      .filter((point): point is GridPoint => Boolean(point))
      .map((point) => `${point.x},${point.y}`));
    members.forEach((customer) => {
      if (customer.state !== 'queueing') this.setCustomerState(customer, 'queueing');
      if (customer.path.length) return;
      const queuePoint = CUSTOMER_QUEUE.find((point) => !claimed.has(`${point.x},${point.y}`) && this.grid.isWalkable(point, customer.id));
      if (!queuePoint) { customer.pathStatus = 'idle'; return; }
      claimed.add(`${queuePoint.x},${queuePoint.y}`);
      if (!this.samePoint(customer.position, queuePoint)) this.routeCustomer(customer, queuePoint);
    });
  }

  private updateCustomers(delta: number): void {
    for (const customer of [...this.customers]) {
      customer.motionState = 'idle';
      if (customer.state === 'gone') continue;
      if (customer.state === 'entering' && this.simulationTime - customer.stateEnteredAt >= 45) {
        // Corrupted saves and synthetic stress runs can place more guests on
        // the street than the admission corridor can hold. Give them a finite
        // outcome instead of allowing an immortal entrance queue.
        this.customerGivesUp(customer);
        continue;
      }
      if ((customer.state === 'leaving' || customer.state === 'gave_up') && !customer.path.length) {
        customer.blockedSeconds += delta; customer.pathStatus = 'no_path';
        if (customer.blockedSeconds >= BALANCE.movementRecovery.retrySeconds) {
          customer.blockedSeconds = 0; customer.retryCount += 1;
          this.routeCustomerToExit(customer, customer.retryCount > 1);
          if (!customer.path.length && customer.retryCount >= BALANCE.movementRecovery.maxExitRetries) this.safeRemoveCustomer(customer, 'saída permaneceu sem rota');
        }
      }
      else if (customer.state === 'entering' && !customer.path.length) {
        if (RESTAURANT_ENTRY_ZONE.some((point) => this.samePoint(customer.position, point))) this.onCustomerArrived(customer); else this.routeCustomerToEntrance(customer);
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
    } else if (customer.state === 'entering') {
      this.routeCustomerToEntrance(customer);
      if (!customer.path.length && customer.retryCount >= BALANCE.movementRecovery.maxTaskRetries) this.safeRemoveCustomer(customer, 'entrada permaneceu sem rota');
    } else if (customer.state === 'queueing' || customer.state === 'seeking_table') {
      customer.path = []; customer.pathStatus = 'idle';
      this.sendPartyToQueue([customer]);
    }
  }

  private onCustomerArrived(customer: CustomerRuntime): void {
    if (customer.state === 'entering') {
      this.setCustomerState(customer, 'seeking_table');
      customer.pathStatus = 'arrived';
      this.sendPartyToQueue([customer]);
    } else if (customer.state === 'walking_to_seat') {
      const seat = this.seatFor(customer.seatId); const table = this.tableFor(customer.tableId);
      if (!seat || !table || seat.customerId !== customer.id) { this.releaseCustomerSeat(customer, false); return; }
      // A seated guest is anchored to the chair visually and must no longer
      // occupy the outer approach tile used by restaurant circulation.
      this.grid.vacate(customer.id);
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

  private routeCustomerToEntrance(customer: CustomerRuntime): void {
    if (RESTAURANT_ENTRY_ZONE.some((point) => this.samePoint(customer.position, point))) {
      customer.path = []; customer.pathStatus = 'arrived'; return;
    }
    const candidates = [...RESTAURANT_ENTRY_ZONE].sort((a, b) => this.distance(customer.position, a) - this.distance(customer.position, b));
    for (const point of candidates) {
      const path = findPath(this.grid, customer.position, point, customer.id);
      if (!path.length) continue;
      customer.path = path; customer.pathStatus = 'moving'; return;
    }
    customer.path = []; customer.pathStatus = 'no_path';
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
    if (this.developmentMode()) console.warn(`[recuperação 0.0.6] ${customer.id} removido com segurança: ${reason}`);
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
    if (!slot && order.state === 'transporting') this.storeFinishedDish(order);
    if (slot) this.clearCounterSlot(slot);
    order.state = 'cancelled';
  }

  private createRestockTasks(): void {
    for (const request of this.state.procurement.requests.filter((item) => ['purchasing', 'delivering', 'storing'].includes(item.status))) {
      const activeTask = this.tasks.list().some((task) => task.kind === 'restock_purchase'
        && task.payload.purchaseRequestId === request.id && !['completed', 'cancelled'].includes(task.status));
      if (!activeTask) {
        request.status = 'approved'; request.responsibleStaffId = undefined;
        request.blockedReason = 'Tarefa anterior interrompida; reposição devolvida automaticamente à fila.';
      }
    }
    for (const request of this.state.procurement.requests.filter((item) => item.status === 'approved')) {
      const allocation = request.lines.flatMap((line) => line.storageAllocations.map((part) => ({ ...part, ingredientId: line.ingredientId })))[0];
      const destination = allocation ? storageTargetPoint(this.state.construction, allocation.placedFurnitureId) : undefined;
      if (!destination) {
        failPurchaseRequest(this.state, request.id, 'O móvel de armazenamento ou seu WorkSlot não está disponível.'); continue;
      }
      this.tasks.add({
        key: `purchase:${request.id}:outbound`, kind: 'restock_purchase', role: 'stock', target: STREET_ENTRY_POINTS[1],
        duration: 1.2, priority: request.priority,
        payload: { purchaseRequestId: request.id, restockStage: 'outbound', storageId: allocation.placedFurnitureId, workSlotId: destination.workSlotId, storageX: destination.point.x, storageY: destination.point.y },
        reservations: [
          { type: 'workSlot', id: destination.workSlotId }, { type: 'storage', id: allocation.placedFurnitureId },
          ...request.lines.map((line) => ({ type: 'ingredient' as const, id: line.ingredientId })),
        ],
      }, this.simulationTime);
    }
  }

  private createProductionTask(): void {
    const activeProductionTasks = this.tasks.list().filter((task) => task.kind === 'production_batch' && !['completed', 'cancelled'].includes(task.status)).length;
    const availableCooks = this.state.staff.instances.filter((instance) => instance.enabled && instance.role === 'cook' && !this.state.staff.training.some((session) => session.staffId === instance.id && session.status === 'active')).length;
    if (activeProductionTasks >= Math.max(1, availableCooks)) return;
    const prepared = prepareNextProductionTask(this.state, this.stations, this.counterModules, Date.now());
    if (!prepared) return;
    this.tasks.add({
      key: `production:${prepared.task.id}`, kind: 'production_batch', role: 'kitchen', target: prepared.target,
      duration: prepared.duration, priority: prepared.priority,
      payload: {
        productionTaskId: prepared.task.id, productionPlanId: prepared.task.productionPlanId,
        stationId: prepared.station.id, workSlotId: prepared.task.workSlotId, outputCounterId: prepared.task.outputCounterId,
      },
      reservations: [
        { type: 'equipment', id: prepared.station.id },
        { type: 'workSlot', id: prepared.task.workSlotId ?? `${prepared.station.id}:primary` },
        ...Object.keys(prepared.task.reservedIngredients).map((id) => ({ type: 'ingredient' as const, id })),
        ...prepared.task.outputReservations.map((part) => ({ type: 'counter' as const, id: part.moduleId })),
      ],
    }, this.simulationTime);
  }

  private updateActors(delta: number): void {
    for (const actor of this.actors) {
      actor.motionState = 'idle';
      const staff = actor.kind === 'player' ? undefined : this.state.staff.instances.find((item) => item.id === actor.id);
      if (staff) {
        staff.currentPosition = { ...actor.position }; staff.currentFacing = actor.direction; staff.currentTaskId = actor.taskId;
        const training = this.state.staff.training.some((session) => session.staffId === staff.id && session.status === 'active');
        if ((!staff.enabled || training) && !actor.taskId) {
          staff.currentState = training ? 'training' : 'offShift'; actor.activity = training ? 'Em treinamento' : 'Fora do turno'; actor.idleReason = actor.activity; continue;
        }
      }
      if (!actor.taskId) this.claimTask(actor);
      if (!actor.taskId) {
        const start = this.state.construction.staffStartPositions.find((item) => item.returnWhenIdle && (actor.kind === 'player'
          ? item.staffId === 'player'
          : item.staffId === actor.id || item.staffId === staff?.definitionId || item.staffId === actor.assetId))
          ?? (actor.kind === 'player' ? { staffId: 'player', gridX: 9, gridY: 14, facing: 'ne' as const, returnWhenIdle: true } : undefined);
        if (start && !actor.path.length && !this.samePoint(actor.position, { x: start.gridX, y: start.gridY })) {
          actor.path = findPath(this.grid, actor.position, { x: start.gridX, y: start.gridY }, actor.id);
          actor.pathStatus = actor.path.length ? 'moving' : 'no_path';
          actor.activity = actor.path.length ? 'Retornando ao ponto inicial' : 'Sem tarefa';
        }
        if (actor.path.length) {
          const result = this.advanceMover(actor, delta, this.workerSpeed(actor));
          if (result.moved) actor.activity = 'Retornando ao ponto inicial';
          if (!actor.path.length && start) actor.direction = start.facing;
        } else {
          actor.activity = 'Sem tarefa';
          if (actor.pathStatus !== 'no_path') actor.pathStatus = 'idle';
        }
        actor.idleReason = `Nenhuma tarefa de ${this.roleLabel(this.primaryRole(actor))}`;
        if (staff) { staff.currentState = 'idle'; staff.currentPosition = { ...actor.position }; staff.currentFacing = actor.direction; }
        continue;
      }
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
      if (staff) {
        staff.currentState = staffStateFromTask(task.status, Boolean(actor.carrying), actor.blockedSeconds);
        staff.currentTaskId = actor.taskId; staff.currentPosition = { ...actor.position }; staff.currentFacing = actor.direction;
      }
    }
  }

  private claimTask(actor: WorkerActor): void {
    const roles = this.rolesForActor(actor);
    const staff = actor.kind === 'player' ? undefined : this.state.staff.instances.find((item) => item.id === actor.id);
    const task = this.tasks.claim(actor.id, roles, actor.preferredTaskId, (candidate) => {
      const station = this.stationFromTask(candidate);
      const allowed = !staff || staff.automationSettings.allowedTasks.includes(candidate.kind);
      const productionRecipe = candidate.kind === 'production_batch'
        ? RECIPE_BY_ID[this.state.production.tasks.find((item) => item.id === candidate.payload.productionTaskId)?.recipeId ?? '']
        : undefined;
      const staffSpecialties = staff ? STAFF_BY_ID[staff.definitionId]?.specialties ?? [] : [];
      const specialtyAllowed = !productionRecipe || !staff || productionRecipe.requiredSpecialties.some((specialty) => staffSpecialties.includes(specialty));
      return allowed && specialtyAllowed && (!station || station.state === 'free' || station.queue[0] === candidate.payload.orderId);
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
    if (task.kind === 'stock_support' || (task.kind === 'restock_purchase' && task.payload.restockStage === 'inbound')) actor.carrying = 'ingredients';
    if (task.kind === 'restock_purchase') setPurchaseRequestStage(this.state, String(task.payload.purchaseRequestId), task.payload.restockStage === 'inbound' ? 'delivering' : 'purchasing', actor.id, Date.now());
    if (task.kind === 'production_batch') {
      const productionTask = this.state.production.tasks.find((item) => item.id === task.payload.productionTaskId);
      if (productionTask) productionTask.assignedStaffId = actor.id;
    }
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
    if (task.kind === 'restock_purchase' && task.payload.restockStage === 'inbound') setPurchaseRequestStage(this.state, String(task.payload.purchaseRequestId), 'storing', actor.id, Date.now());
    if (task.kind === 'production_batch') markProductionTaskStarted(this.state, String(task.payload.productionTaskId), actor.id, Date.now());
    actor.taskRemaining = this.taskDuration(actor, task);
    actor.activity = task.kind === 'restock_purchase' && task.payload.restockStage === 'inbound' ? 'Voltando com o estoque' : TASK_LABELS[task.kind]; actor.idleReason = '';
    const station = this.stationFromTask(task);
    if (station) {
      station.state = 'in_use'; station.workerId = actor.id; station.remaining = actor.taskRemaining;
      const equipmentCenter = { x: station.position.x + (station.size.x - 1) / 2, y: station.position.y + (station.size.y - 1) / 2 };
      actor.direction = directionBetween(actor.position, equipmentCenter, actor.direction);
    } else {
      const table = this.tableFor(task.payload.tableId);
      const seat = this.seatFor(task.payload.seatId);
      const interactionTarget = table?.position ?? seat?.position;
      if (interactionTarget) actor.direction = directionBetween(actor.position, interactionTarget, actor.direction);
    }
  }

  private handleActorMovement(actor: WorkerActor, task: RestaurantTask, result: MovementResult, delta: number): void {
    if (result.moved) { actor.lastMovementAt = this.simulationTime; actor.blockedSeconds = 0; actor.retryCount = 0; actor.pathStatus = actor.path.length ? 'moving' : 'arrived'; return; }
    if (!result.blocked) return;
    actor.blockedSeconds += delta; actor.pathStatus = 'blocked';
    if (actor.blockedSeconds < BALANCE.movementRecovery.retrySeconds) return;
    actor.blockedSeconds = 0; actor.retryCount += 1; this.grid.releaseReservations(actor.id);
    const staff = this.state.staff.instances.find((instance) => instance.id === actor.id);
    if (staff) { staff.recoveryAttempts += 1; staff.stats.blockedRecoveries += 1; staff.currentState = 'recovering'; }
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
    else awardStaffTaskExperience(this.state, actor.id, task.kind, Date.now());
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
    } else if (task.kind === 'restock_purchase') {
      if (task.payload.restockStage === 'outbound') {
        actor.carrying = 'ingredients';
        const inbound = this.tasks.add({
          key: `purchase:${task.payload.purchaseRequestId}:inbound`, kind: 'restock_purchase', role: 'stock',
          target: { x: Number(task.payload.storageX), y: Number(task.payload.storageY) }, duration: 2.4, priority: Math.min(200, task.priority + 20),
          payload: { ...task.payload, restockStage: 'inbound' }, reservations: task.reservations,
        }, this.simulationTime);
        actor.preferredTaskId = inbound.id;
        setPurchaseRequestStage(this.state, String(task.payload.purchaseRequestId), 'delivering', actor.id, Date.now());
        return;
      }
      actor.carrying = undefined;
      const result = completePurchaseRequest(this.state, String(task.payload.purchaseRequestId), actor.id, Date.now());
      if (result.ok) {
        this.retryBlockedOrders();
        gameEvents.emit('toast', { message: `Reposição concluída por ${actor.name}.`, tone: 'success' });
      } else gameEvents.emit('toast', { message: result.reason ?? 'Reposição bloqueada.', tone: 'warning' });
    } else if (task.kind === 'production_batch') {
      const completed = completeProductionTask(this.state, String(task.payload.productionTaskId), this.counterModules, Date.now());
      const productionTask = this.state.production.tasks.find((item) => item.id === task.payload.productionTaskId);
      if (!completed && productionTask?.state === 'waitingForCounterSpace') {
        const station = this.stationFromTask(task);
        if (station) {
          station.state = 'complete';
          station.workerId = undefined;
          station.remaining = 0;
          station.currentStep = `Pronto: ${RECIPE_BY_ID[productionTask.recipeId].name} ×${productionTask.batchQuantity}`;
        }
        gameEvents.emit('toast', { message: 'Lote pronto na estação; aguardando um balcão de serviço livre.', tone: 'info' });
      } else {
        gameEvents.emit('toast', { message: completed ? 'Lote entregue ao balcão de serviço.' : 'Não foi possível concluir o lote.', tone: completed ? 'success' : 'warning' });
      }
    } else if (task.kind === 'stock_support') {
      actor.carrying = undefined;
      const order = this.orderFor(task.payload.orderId);
      if (order?.state === 'awaiting_station' && order.ingredientsState === 'reserved') this.createCookStep(order);
    }
  }

  private placeOrder(customer: CustomerRuntime, table: TableRuntime, seat: ChairRuntime): void {
    if (customer.orderId) return;
    // O que está exposto no balcão forma o cardápio real do restaurante.
    // Uma lista antiga de receitas habilitadas não pode esconder comida pronta.
    const available = RECIPES.filter((recipe) => recipe.requiredLevel <= this.state.restaurantLevel
      && this.counterModules.some((module) => module.assignedRecipeId === recipe.id && module.currentQuantity - module.reservedQuantity > 0));
    if (!available.length) {
      gameEvents.emit('toast', { message: 'Nenhum prato pronto disponível. Produza um lote antes de receber novos pedidos.', tone: 'warning' });
      return;
    }
    const recipe = available[Math.floor(Math.random() * available.length)];
    const order: OrderRuntime = {
      id: stableRuntimeId('order'), customerId: customer.id, tableId: table.id, seatId: seat.seatId, chairId: seat.chairId,
      recipeId: recipe.id, quantity: 1, state: 'requested', createdAt: this.simulationTime, priority: 80,
      stepIndex: 0, plateId: stableRuntimeId('plate'), ingredientReservation: {}, ingredientsState: 'none', paymentCompleted: false,
    };
    this.orders.push(order); customer.orderId = order.id; seat.orderId = order.id; seat.state = 'waiting_food'; this.setCustomerState(customer, 'waiting_food'); this.refreshTableState(table);
    if (this.placePreparedCounterDish(order)) return;
    order.state = 'cancelled'; customer.orderId = undefined; seat.orderId = undefined; seat.state = 'waiting_order'; this.setCustomerState(customer, 'waiting_order');
  }

  private placeReadyDishOnCounter(order: OrderRuntime): boolean {
    const slot = this.reserveCounterSlot(order.id, order.recipeId, 'incoming');
    if (!slot) { order.state = 'awaiting_station'; return false; }
    if (this.state.readyDishes[order.recipeId] <= 0) { this.clearCounterSlot(slot); return false; }
    const module = this.counterModules.find((item) => item.id === slot.moduleId)!;
    module.currentQuantity += 1; module.reservedQuantity += 1; slot.stockReservation = [{ moduleId: module.id, quantity: 1 }]; slot.quantity = 1;
    this.state.readyDishes[order.recipeId] -= 1; slot.state = 'occupied'; order.counterSlotId = slot.id; order.state = 'awaiting_pickup'; this.createDelivery(order); return true;
  }

  private placePreparedCounterDish(order: OrderRuntime): boolean {
    const slot = this.reserveCounterSlot(order.id, order.recipeId, 'existing');
    if (!slot) return false;
    const reservation = this.counterStore.reserve(order.recipeId, 1);
    if (!reservation) { this.clearCounterSlot(slot); return false; }
    slot.stockReservation = reservation; slot.quantity = 1; slot.state = 'occupied';
    order.counterSlotId = slot.id; order.state = 'awaiting_pickup'; this.createDelivery(order); return true;
  }

  private createCookStep(order: OrderRuntime): void {
    if (order.state === 'cancelled') return;
    const recipe = RECIPE_BY_ID[order.recipeId]; const step = recipe.steps[order.stepIndex];
    if (!step) return;
    if (step.stationId === 'pickup' && !order.counterSlotId) {
      const slot = this.reserveCounterSlot(order.id, order.recipeId, 'incoming');
      if (!slot) { order.state = 'awaiting_station'; return; }
      order.counterSlotId = slot.id;
    }
    const station = this.stationForStep(step.stationId, order.recipeId, order.counterSlotId ? this.slotForOrder(order.id)?.moduleId : undefined);
    if (!station) { order.state = 'awaiting_station'; return; }
    if (!station.queue.includes(order.id)) station.queue.push(order.id);
    station.currentStep = step.label; order.state = 'awaiting_station';
    this.tasks.add({
      key: `cook:${order.id}:${order.stepIndex}`, kind: 'cook_step', role: 'kitchen',
      target: station.interaction,
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
    const module = this.counterModules.find((item) => item.id === slot.moduleId);
    if (!module || module.currentQuantity >= module.maxCapacity) { order.state = 'awaiting_station'; return; }
    module.currentQuantity += 1; module.reservedQuantity += 1; slot.stockReservation = [{ moduleId: module.id, quantity: 1 }]; slot.quantity = 1;
    slot.state = 'occupied'; slot.orderId = order.id; slot.reservedBy = undefined;
    const customer = this.customerFor(order.customerId);
    if (!customer || ['gone', 'gave_up', 'leaving'].includes(customer.state)) { this.clearCounterSlot(slot); order.state = 'cancelled'; return; }
    order.state = 'awaiting_pickup'; this.createDelivery(order);
  }

  private createDelivery(order: OrderRuntime): void {
    const slot = this.slotForOrder(order.id);
    const module = slot ? this.counterModules.find((item) => item.id === slot.moduleId) : undefined;
    const station = module ? this.stationForCounterModule(module.id) : undefined;
    this.tasks.add({
      key: `deliver:${order.id}:collect`, kind: 'deliver', role: 'service', target: module?.waiterPickupSlot ?? station?.serviceInteraction ?? { x: 8, y: 7 },
      duration: Math.min(1.2, BALANCE.actionSeconds.deliver / 2), priority: 150,
      payload: { orderId: order.id, customerId: order.customerId, tableId: order.tableId, seatId: order.seatId, stationId: station?.id ?? 'pickup', deliveryStage: 'collect' },
      reservations: order.counterSlotId ? [{ type: 'counter', id: order.counterSlotId }] : [],
    }, this.simulationTime);
  }

  private collectDish(actor: WorkerActor, orderId: string): void {
    const order = this.orderFor(orderId); const slot = order ? this.slotForOrder(order.id) : undefined;
    if (!order || order.state !== 'awaiting_pickup' || !slot || slot.state !== 'occupied') return;
    this.consumeCounterSlot(slot); order.state = 'transporting'; order.assignedActorId = actor.id; actor.carrying = 'dish'; actor.carryingOrderId = order.id;
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
    for (const order of this.orders.filter((item) => item.state === 'awaiting_station' || item.state === 'awaiting_ingredients')) {
      const recipe = RECIPE_BY_ID[order.recipeId];
      if (this.prioritizePreparedDish(order)) continue;
      if (order.state !== 'awaiting_station') continue;
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
  totalCapacity(): number { return this.tables.filter((table) => table.accessible).flatMap((table) => table.chairs).filter((seat) => this.seatUsable(seat)).length; }
  customerDemandCapacity(): number {
    const physicalCapacity = this.totalCapacity();
    return physicalCapacity > 0 ? Math.max(1, Math.ceil(physicalCapacity * this.reputationDemandFactor())) : 0;
  }

  private retryWaitingCustomerOrders(): void {
    const hasPreparedFood = this.counterModules.some((module) => module.assignedRecipeId
      && RECIPE_BY_ID[module.assignedRecipeId]?.requiredLevel <= this.state.restaurantLevel
      && module.currentQuantity - module.reservedQuantity > 0);
    if (!hasPreparedFood) return;
    const activeCustomers = new Set(this.tasks.list().filter((task) => task.kind === 'take_order').map((task) => String(task.payload.customerId)));
    for (const customer of this.customers.filter((item) => item.state === 'waiting_order' && !item.orderId && !activeCustomers.has(item.id))) {
      const seat = this.seatFor(customer.seatId);
      if (!seat || seat.customerId !== customer.id) continue;
      this.tasks.add({
        key: `order:${customer.id}`, kind: 'take_order', role: 'service', target: seat.servicePoint,
        duration: BALANCE.actionSeconds.takeOrder, priority: 85,
        payload: { customerId: customer.id, tableId: seat.tableId, seatId: seat.seatId },
        reservations: [{ type: 'seat', id: seat.seatId }],
      }, this.simulationTime);
    }
  }
  dishesAwaitingPickup(): number { return this.counterSlots.filter((slot) => slot.state === 'occupied').length; }
  activeOrderCount(): number { return this.orders.filter((order) => !TERMINAL_ORDER_STATES.has(order.state)).length; }

  prepareConstructionMode(): boolean {
    if (this.constructionPaused) return true;
    this.speedBeforeConstruction = this.speed;
    this.speed = 0;
    this.constructionPaused = true;
    gameEvents.emit('construction:paused', undefined);
    return true;
  }

  cancelConstructionMode(): void {
    this.constructionPaused = false;
    this.speed = this.speedBeforeConstruction;
    gameEvents.emit('construction:resumed', undefined);
  }

  finalizeConstructionMode(movedChairIds: readonly string[]): number {
    const moved = new Set(movedChairIds);
    let displaced = 0;
    for (const customer of [...this.customers]) {
      if (!customer.chairIds.some((chairId) => moved.has(chairId))) continue;
      if (['gone', 'leaving', 'gave_up'].includes(customer.state)) continue;
      const seat = this.seatFor(customer.seatId);
      const table = seat ? this.tableFor(seat.tableId) : undefined;
      this.customerGivesUp(customer);
      // Moving an occupied chair releases it immediately instead of leaving
      // a cleaning task tied to the old floor position.
      this.cancelTasksForCustomer(customer.id);
      if (seat) {
        seat.customerId = undefined;
        seat.reservationId = undefined;
        seat.orderId = undefined;
        seat.state = 'free';
      }
      if (table) this.refreshTableState(table);
      displaced += 1;
    }
    this.constructionPaused = false;
    this.speed = this.speedBeforeConstruction;
    this.prepareSave();
    gameEvents.emit('construction:resumed', undefined);
    return displaced;
  }

  isConstructionMode(): boolean { return this.constructionPaused; }

  debugAddCustomer(): CustomerRuntime | undefined { return this.spawnParty(1)[0]; }
  debugAddGroup(size = 4): CustomerRuntime[] { return this.spawnParty(size); }
  debugSeatGroupAtFirstTable(size = 4): CustomerRuntime[] {
    const table = this.tables.find((item) => item.chairs.length >= size);
    if (!table) return [];
    this.autoSpawn = false;
    const members = this.spawnParty(Math.min(size, table.chairs.length));
    members.forEach((customer, index) => {
      const seat = table.chairs[index];
      this.grid.vacate(customer.id);
      customer.position = { ...seat.approach }; customer.visual = { ...seat.seatAnchor };
      customer.path = []; customer.pathStatus = 'arrived'; customer.motionState = 'idle';
      customer.tableId = table.id; customer.seatId = seat.seatId; customer.chairIds = [seat.id]; customer.direction = seat.orientation;
      customer.state = 'waiting_order'; customer.stateEnteredAt = this.simulationTime;
      seat.customerId = customer.id; seat.reservationId = customer.partyId; seat.state = 'waiting_order';
      this.tasks.add({
        key: `order:${customer.id}`, kind: 'take_order', role: 'service', target: seat.servicePoint,
        duration: BALANCE.actionSeconds.takeOrder, priority: 70,
        payload: { customerId: customer.id, tableId: table.id, seatId: seat.seatId },
        reservations: [{ type: 'seat', id: seat.seatId }],
      }, this.simulationTime);
    });
    this.refreshTableState(table);
    return members;
  }
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
    const step = .2;
    for (let elapsed = 0; elapsed < seconds; elapsed += step) this.tick(Math.min(step, seconds - elapsed));
    this.visualClock += seconds * 1000;
    this.speed = before;
    gameEvents.emit('simulation:update', undefined);
  }
  debugSetAutoSpawn(enabled: boolean): void { this.autoSpawn = enabled; }
  setRestaurantOpen(open: boolean): void {
    this.state.restaurantOpen = open;
    this.autoSpawn = open;
    // O primeiro cliente deve aparecer quase imediatamente; o tutorial não
    // pode parecer travado esperando o intervalo normal de lotação.
    if (open && this.activeCustomerCount() === 0) this.spawnCountdown = Math.min(this.spawnCountdown, .35);
  }
  cancelProduction(planId: string): boolean {
    const heldStationIds = this.state.production.tasks
      .filter((task) => task.productionPlanId === planId && task.state === 'waitingForCounterSpace')
      .map((task) => task.workstationId)
      .filter((id): id is string => Boolean(id));
    const cancelled = cancelProductionPlan(this.state, planId, this.counterModules, Date.now());
    if (!cancelled) return false;
    const runtimeTasks = this.tasks.cancelWhere((task) => task.kind === 'production_batch' && task.payload.productionPlanId === planId, 'Produção cancelada pelo jogador.');
    for (const task of runtimeTasks) {
      for (const actor of this.actors.filter((entry) => entry.taskId === task.id)) this.clearActorTask(actor);
      this.releaseTaskStation(task);
    }
    for (const stationId of heldStationIds) {
      const station = this.stations.find((item) => item.id === stationId);
      if (station) {
        station.state = 'free';
        station.workerId = undefined;
        station.remaining = 0;
        station.currentStep = undefined;
      }
    }
    return true;
  }

  private transferReadyProductionOutputs(): void {
    const waitingStations = new Map(this.state.production.tasks
      .filter((task) => task.state === 'waitingForCounterSpace' && task.workstationId)
      .map((task) => [task.id, task.workstationId!]));
    const transferred = transferWaitingProductionOutputs(this.state, this.counterModules, Date.now());
    for (const taskId of transferred) {
      const station = this.stations.find((item) => item.id === waitingStations.get(taskId));
      if (station) {
        station.state = 'free';
        station.workerId = undefined;
        station.remaining = 0;
        station.currentStep = undefined;
      }
    }
    if (transferred.length) gameEvents.emit('toast', { message: `${transferred.length} lote${transferred.length === 1 ? '' : 's'} transferido${transferred.length === 1 ? '' : 's'} para o balcão.`, tone: 'success' });
  }
  debugBeginDeparture(customer: CustomerRuntime, gaveUp = false): void { if (gaveUp) this.customerGivesUp(customer); else this.beginDeparture(customer, false); }

  syncStaffRoster(): void {
    const validIds = new Set(this.state.staff.instances.map((instance) => instance.id));
    for (let index = this.actors.length - 1; index >= 0; index -= 1) {
      const actor = this.actors[index];
      if (actor.kind === 'player' || validIds.has(actor.id)) continue;
      if (actor.taskId) this.tasks.release(actor.taskId, actor.id);
      this.grid.vacate(actor.id); this.grid.releaseReservations(actor.id); this.actors.splice(index, 1);
    }
    for (const instance of this.state.staff.instances) {
      if (this.actors.some((actor) => actor.id === instance.id)) continue;
      const definition = STAFF_BY_ID[instance.definitionId];
      const actor = this.makeActor(instance.id, instance.role, instance.customName, definition.assetId, instance.startPosition);
      this.actors.splice(Math.max(0, this.actors.length - 1), 0, actor);
      this.grid.occupy(actor.position, actor.id);
    }
  }

  private prioritizePreparedDish(order: OrderRuntime): boolean {
    if (order.stepIndex !== 0 || order.assignedActorId || this.counterStore.available(order.recipeId) < 1) return false;
    const cookTasks = this.tasks.list().filter((task) => task.kind === 'cook_step' && task.payload.orderId === order.id);
    if (cookTasks.some((task) => task.status !== 'pending')) return false;
    for (const task of cookTasks) this.tasks.cancel(task.id, 'Prato pronto priorizado para o cliente.');
    if (order.ingredientsState === 'reserved') releaseReservation(this.state, order.ingredientReservation);
    order.ingredientReservation = {}; order.ingredientsState = 'none';
    return this.placePreparedCounterDish(order);
  }

  missingIngredients(): { id: IngredientId; needed: number; available: number }[] {
    const demand = new Map<IngredientId, number>();
    for (const order of this.orders.filter((item) => item.state === 'awaiting_ingredients')) {
      for (const part of RECIPE_BY_ID[order.recipeId].ingredients) demand.set(part.ingredientId, (demand.get(part.ingredientId) ?? 0) + part.amount);
    }
    return [...demand].map(([id, needed]) => ({ id, needed, available: Math.max(0, this.state.inventory[id] - this.state.inventoryReserved[id]) })).filter((item) => item.available < item.needed);
  }

  prepareSave(now = Date.now()): OperationSaveState {
    const operation: OperationSaveState = {
      dataVersion: 3, savedAt: now, simulationTime: this.simulationTime, customerSequence: this.customerSequence, spawnCountdown: this.spawnCountdown,
      actors: this.toRecords(this.actors), customers: this.toRecords(this.customers.filter((customer) => customer.state !== 'gone')),
      orders: this.toRecords(this.orders), tables: this.toRecords(this.tables), stations: this.toRecords(this.stations),
      tasks: this.tasks.serialize(), counterSlots: this.toRecords(this.counterSlots), counterModules: this.toRecords(this.counterModules),
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
        if (savedSeat) Object.assign(seat, savedSeat, {
          position: seat.position, visualPosition: seat.visualPosition, approach: seat.approach, sitPoint: seat.sitPoint, seatAnchor: seat.seatAnchor,
          footprint: seat.footprint, depthOffset: seat.depthOffset, visualSkinId: seat.visualSkinId, layerAssetIds: seat.layerAssetIds,
          servicePoint: seat.servicePoint, platePosition: seat.platePosition, dirtPosition: seat.dirtPosition,
          orientation: seat.orientation, tableId: seat.tableId,
          enabled: seat.enabled, accessible: seat.accessible,
        });
      }
      this.refreshTableState(table);
    }
    const savedStations = operation.stations as unknown as StationRuntime[];
    for (const station of this.stations) {
      const saved = savedStations.find((item) => item.id === station.id); if (!saved) continue;
      const layout = {
        name: station.name, icon: station.icon, position: station.position, size: station.size, interaction: station.interaction,
        color: station.color, orientation: station.orientation, front: station.front, interactionPoints: station.interactionPoints,
        primaryWorkSlot: station.primaryWorkSlot, optionalWorkSlots: station.optionalWorkSlots,
        ingredientSlot: station.ingredientSlot, outputSlot: station.outputSlot, clearanceCells: station.clearanceCells,
        serviceInteraction: station.serviceInteraction, asset: station.asset, anchor: station.anchor, visualHeight: station.visualHeight,
        blocksMovement: station.blocksMovement, rotatable: station.rotatable, visualSkinId: station.visualSkinId,
        visualBounds: station.visualBounds, visualScale: station.visualScale, heightCategory: station.heightCategory,
        depthOffset: station.depthOffset, equipmentFamilyId: station.equipmentFamilyId,
        visualLevel: station.visualLevel, gameplayLevel: station.gameplayLevel, renderedAssetId: station.renderedAssetId,
        thumbnailId: station.thumbnailId, interactionSlots: station.interactionSlots, animationSet: station.animationSet,
        nextLevelAssetId: station.nextLevelAssetId, unlockRequirement: station.unlockRequirement, statsConfigId: station.statsConfigId,
        level: station.level,
      };
      Object.assign(station, saved, {
        ...layout,
        state: saved.state === 'no_ingredients' ? 'no_ingredients' : 'free', workerId: undefined, remaining: 0, currentStep: undefined,
      });
    }
    const savedActors = operation.actors as unknown as WorkerActor[];
    for (const actor of this.actors) {
      const saved = savedActors.find((item) => item.id === actor.id); if (!saved) continue;
      const currentAssetId = actor.assetId;
      Object.assign(actor, saved, { assetId: currentAssetId, taskId: undefined, path: [], moveProgress: 0, carrying: saved.carrying, carryingOrderId: saved.carryingOrderId });
    }
    for (const raw of operation.customers as unknown as CustomerRuntime[]) if (raw?.id && raw.position && raw.state !== 'gone') this.customers.push({ ...raw, path: [], moveProgress: 0, blockedSeconds: 0, pathStatus: 'idle', motionState: 'idle' });
    for (const raw of operation.orders as unknown as OrderRuntime[]) if (raw?.id && RECIPE_BY_ID[raw.recipeId]) this.orders.push({ ...raw, ingredientReservation: raw.ingredientReservation ?? {}, paymentCompleted: Boolean(raw.paymentCompleted) });
    const slots = operation.counterSlots as unknown as CounterSlotRuntime[];
    for (const slot of this.counterSlots) { const saved = slots.find((item) => item.id === slot.id); if (saved) Object.assign(slot, saved); }
    const savedModules = operation.counterModules as unknown as ServiceCounterModule[] | undefined;
    if (savedModules) for (const module of this.counterModules) {
      const saved = savedModules.find((item) => item.id === module.id);
      if (saved) Object.assign(module, saved, { gridX: module.gridX, gridY: module.gridY, orientation: module.orientation, kitchenDropSlot: module.kitchenDropSlot, waiterPickupSlot: module.waiterPickupSlot, connectionVariant: module.connectionVariant });
    }
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
    const recoveryCells = [
      ...STREET_ENTRY_POINTS,
      ...Array.from({ length: 16 }, (_, index) => ({ x: 1 + index, y: 21 })),
      ...Array.from({ length: 14 }, (_, index) => ({ x: 2 + index, y: 20 })),
      ...CUSTOMER_QUEUE,
    ];
    for (const customer of [...this.customers]) {
      if (customer.seatId && ['sitting', 'waiting_order', 'waiting_food', 'eating', 'paying', 'standing'].includes(customer.state)) {
        this.grid.vacate(customer.id);
        continue;
      }
      const key = `${customer.position.x},${customer.position.y}`;
      const currentIsUsable = this.grid.inBounds(customer.position) && Boolean(this.grid.get(customer.position)?.walkable) && !used.has(key) && this.grid.isWalkable(customer.position, customer.id);
      const fallback = currentIsUsable ? customer.position : recoveryCells.find((point) => !used.has(`${point.x},${point.y}`) && this.grid.isWalkable(point, customer.id));
      if (!fallback) { customer.state = 'gone'; customer.path = []; customer.pathStatus = 'no_path'; continue; }
      if (!currentIsUsable) {
        customer.position = { ...fallback }; customer.visual = { ...fallback }; customer.pathStatus = 'blocked'; customer.retryCount += 1;
      }
      occupy(customer, fallback);
    }
  }

  private reconcileOperation(): void {
    const customerById = new Map(this.customers.map((customer) => [customer.id, customer]));
    for (const table of this.tables) for (const seat of table.chairs) {
      const occupant = seat.customerId ? customerById.get(seat.customerId) : undefined;
      const validOccupant = occupant && occupant.seatId === seat.seatId && occupant.tableId === table.id && !['gone', 'gave_up', 'leaving'].includes(occupant.state);
      if (!validOccupant && ACTIVE_SEAT_STATES.has(seat.state)) {
        seat.state = 'free'; seat.customerId = undefined; seat.reservationId = undefined; seat.orderId = undefined;
      }
    }
    for (const customer of this.customers) {
      if (!customer.seatId) continue;
      const seat = this.seatFor(customer.seatId);
      if (!seat || seat.customerId !== customer.id) {
        customer.tableId = undefined; customer.seatId = undefined; customer.chairIds = [];
        if (!['leaving', 'gave_up'].includes(customer.state)) this.setCustomerState(customer, 'queueing');
      }
    }
    this.normalizeRestoredPartySizes();
    this.trimRestoredAdmissionQueue();
    for (const table of this.tables) this.refreshTableState(table);
    for (const id of Object.keys(this.state.inventoryReserved) as IngredientId[]) this.state.inventoryReserved[id] = 0;
    for (const order of this.orders) {
      if (order.ingredientsState === 'reserved') {
        const valid = Object.entries(order.ingredientReservation).every(([rawId, amount]) => this.state.inventory[rawId as IngredientId] >= (amount ?? 0));
        if (valid) for (const [rawId, amount] of Object.entries(order.ingredientReservation)) this.state.inventoryReserved[rawId as IngredientId] += amount ?? 0;
        else { order.ingredientsState = 'released'; order.state = 'awaiting_ingredients'; }
      }
      if (order.state === 'preparing') order.state = 'awaiting_station';
      if (order.state === 'transporting') {
        const slot = this.reserveCounterSlot(order.id, order.recipeId, 'incoming');
        if (slot) {
          const module = this.counterModules.find((item) => item.id === slot.moduleId)!;
          module.currentQuantity += 1; module.reservedQuantity += 1; slot.stockReservation = [{ moduleId: module.id, quantity: 1 }]; slot.quantity = 1;
          slot.state = 'occupied'; order.counterSlotId = slot.id; order.state = 'awaiting_pickup';
        }
        else { this.storeFinishedDish(order); order.state = 'cancelled'; }
      }
      if (order.state === 'awaiting_pickup') {
        let slot = this.slotForOrder(order.id);
        if (!slot) {
          slot = this.reserveCounterSlot(order.id, order.recipeId, 'incoming');
          if (slot) {
            const module = this.counterModules.find((item) => item.id === slot!.moduleId)!;
            module.currentQuantity += 1; module.reservedQuantity += 1; slot.stockReservation = [{ moduleId: module.id, quantity: 1 }]; slot.quantity = 1;
          }
        }
        if (slot) { slot.state = 'occupied'; order.counterSlotId = slot.id; this.createDelivery(order); }
      }
      if (order.state === 'awaiting_station') this.createCookStep(order);
    }
    for (const task of this.state.production.tasks.filter((item) => item.state === 'waitingForCounterSpace' && item.workstationId)) {
      const station = this.stations.find((item) => item.id === task.workstationId);
      if (!station) continue;
      station.state = 'complete';
      station.workerId = undefined;
      station.remaining = 0;
      station.currentStep = `Pronto: ${RECIPE_BY_ID[task.recipeId].name} ×${task.batchQuantity}`;
    }
    for (const customer of this.customers) {
      if (customer.state === 'leaving' || customer.state === 'gave_up') { if (!customer.cleanupCompleted) this.cleanupCustomerReferences(customer); this.routeCustomerToExit(customer); }
      else if (customer.state === 'entering') this.routeCustomerToEntrance(customer);
      else if (customer.state === 'walking_to_seat') this.routeCustomerToSeat(customer);
      else if (customer.state === 'waiting_order') {
        const seat = this.seatFor(customer.seatId); if (seat) this.tasks.add({ key: `order:${customer.id}`, kind: 'take_order', role: 'service', target: seat.servicePoint, duration: BALANCE.actionSeconds.takeOrder, priority: 70, payload: { customerId: customer.id, tableId: seat.tableId, seatId: seat.seatId } }, this.simulationTime);
      } else if (customer.state === 'paying') this.requestPayment(customer);
    }
    for (const table of this.tables) for (const seat of table.chairs) if (seat.state === 'dirty') this.tasks.add({ key: `clean:${seat.seatId}`, kind: 'clean', role: 'cleaning', target: seat.approach, duration: BALANCE.actionSeconds.clean, priority: 82, payload: { tableId: table.id, seatId: seat.seatId } }, this.simulationTime);
  }

  private trimRestoredAdmissionQueue(): void {
    const parties = [...new Set(this.customers
      .filter((customer) => ADMISSION_STATES.has(customer.state) && !customer.seatId)
      .sort((a, b) => a.stateEnteredAt - b.stateEnteredAt || a.partyIndex - b.partyIndex)
      .map((customer) => customer.partyId))];
    let retained = 0;
    for (const partyId of parties) {
      const members = this.partyMembers(partyId).filter((customer) => ADMISSION_STATES.has(customer.state) && !customer.seatId);
      if (retained + members.length <= this.admissionQueueLimit()) { retained += members.length; continue; }
      for (const customer of members) this.completeCustomerDeparture(customer);
    }
    this.pruneGoneCustomers();
  }

  private normalizeRestoredPartySizes(): void {
    const capacity = this.largestTableCapacity();
    if (capacity < 1) return;
    const partyIds = [...new Set(this.customers.filter((customer) => ADMISSION_STATES.has(customer.state) && !customer.seatId).map((customer) => customer.partyId))];
    for (const partyId of partyIds) {
      const members = this.partyMembers(partyId)
        .filter((customer) => ADMISSION_STATES.has(customer.state) && !customer.seatId)
        .sort((a, b) => a.partyIndex - b.partyIndex);
      if (members.length <= capacity) continue;
      for (let offset = 0; offset < members.length; offset += capacity) {
        const chunk = members.slice(offset, offset + capacity);
        const recoveredPartyId = offset === 0 ? partyId : stableRuntimeId('party-recovered');
        chunk.forEach((customer, index) => {
          customer.partyId = recoveredPartyId;
          customer.partySize = chunk.length;
          customer.partyIndex = index;
        });
      }
    }
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

  private reserveCounterSlot(orderId: string, recipeId: RecipeId, mode: 'existing' | 'incoming' = 'existing'): CounterSlotRuntime | undefined {
    const existing = this.slotForOrder(orderId); if (existing) return existing;
    let modules = this.counterModules.filter((item) => item.assignedRecipeId === recipeId);
    if (!modules.some((item) => mode === 'incoming' ? item.currentQuantity < item.maxCapacity : item.currentQuantity - item.reservedQuantity > 0) && mode === 'incoming') {
      const assignable = this.counterModules.find((item) => item.currentQuantity === 0 && item.reservedQuantity === 0 && (item.incomingReservedQuantity ?? 0) === 0);
      if (assignable) { assignable.assignedRecipeId = recipeId; modules = [assignable]; }
    }
    const module = modules.find((item) => mode === 'incoming' ? item.currentQuantity < item.maxCapacity : item.currentQuantity - item.reservedQuantity > 0);
    if (!module) return undefined;
    const slot = this.counterSlots.find((item) => item.state === 'free' && item.moduleId === module.id);
    if (slot) { slot.state = 'reserved'; slot.orderId = orderId; slot.reservedBy = orderId; slot.recipeId = recipeId; slot.quantity = 0; }
    return slot;
  }
  private clearCounterSlot(slot: CounterSlotRuntime): void {
    if (slot.stockReservation?.length) this.counterStore.release(slot.stockReservation);
    slot.state = 'free'; slot.orderId = undefined; slot.reservedBy = undefined; slot.recipeId = undefined; slot.quantity = 0; slot.stockReservation = undefined;
  }
  private consumeCounterSlot(slot: CounterSlotRuntime): void {
    if (slot.stockReservation?.length) this.counterStore.consume(slot.stockReservation);
    slot.state = 'free'; slot.orderId = undefined; slot.reservedBy = undefined; slot.recipeId = undefined; slot.quantity = 0; slot.stockReservation = undefined;
  }
  private slotForOrder(orderId: string): CounterSlotRuntime | undefined { return this.counterSlots.find((slot) => slot.orderId === orderId); }
  private storeFinishedDish(order: OrderRuntime): void {
    const free = readyDishCapacity(this.state) - readyDishUsed(this.state);
    if (free >= 1) this.state.readyDishes[order.recipeId] += 1;
  }
  private ingredientAvailabilityIssue(order: OrderRuntime): { message: string; physicallyMissing: boolean } {
    const missing = RECIPE_BY_ID[order.recipeId].ingredients.find((part) => this.state.inventory[part.ingredientId] - this.state.inventoryReserved[part.ingredientId] < part.amount);
    if (!missing) return { message: 'Ingredientes temporariamente indisponíveis', physicallyMissing: false };
    const ingredient = INGREDIENT_BY_ID[missing.ingredientId];
    const physicallyMissing = this.state.inventory[missing.ingredientId] < missing.amount;
    return physicallyMissing
      ? { message: `FALTA ${ingredient.name.toUpperCase()} · necessário ${missing.amount}`, physicallyMissing: true }
      : { message: `${ingredient.name} em uso em outro preparo`, physicallyMissing: false };
  }
  private releaseTaskStation(task: RestaurantTask): void {
    const station = this.stationFromTask(task);
    if (station) { station.state = 'free'; station.workerId = undefined; station.remaining = 0; station.currentStep = undefined; station.queue = station.queue.filter((id) => id !== task.payload.orderId); }
  }
  private clearActorTask(actor: WorkerActor): void {
    actor.taskId = undefined; actor.taskRemaining = 0; actor.path = []; actor.moveProgress = 0; actor.activity = 'Disponível'; actor.idleReason = 'Aguardando tarefa'; actor.pathStatus = 'idle';
    if (!actor.carryingOrderId && !actor.preferredTaskId) actor.carrying = undefined;
    this.grid.releaseReservations(actor.id);
  }
  private rolesForActor(actor: WorkerActor): HelpRole[] {
    if (actor.kind === 'cook') return ['kitchen']; if (actor.kind === 'waiter') return ['service']; if (actor.kind === 'cleaner') return ['cleaning']; if (actor.kind === 'stocker') return ['stock'];
    return [this.state.profile?.helpRole ?? 'kitchen'];
  }
  private primaryRole(actor: WorkerActor): HelpRole { return this.rolesForActor(actor)[0]; }
  private advanceMover(mover: Mover, delta: number, speed: number): MovementResult {
    const before = { ...mover.visual };
    const result = advanceTileMover(this.grid, mover, delta, speed);
    const visualMoved = Math.abs(mover.visual.x - before.x) + Math.abs(mover.visual.y - before.y) > .0001;
    mover.motionState = visualMoved ? 'walk' : 'idle';
    if (visualMoved) {
      const staff = this.state.staff.instances.find((instance) => instance.id === mover.id);
      if (staff) { staff.stats.distanceWalked += Math.abs(mover.visual.x - before.x) + Math.abs(mover.visual.y - before.y); staff.lastProgressAt = Date.now(); }
    }
    if (result.moved) mover.pathStatus = mover.path.length ? 'moving' : 'arrived';
    else if (result.blocked) mover.pathStatus = 'blocked';
    else if (!mover.path.length && mover.pathStatus === 'moving') mover.pathStatus = 'arrived';
    return result;
  }
  private workerSpeed(actor: WorkerActor): number {
    if (actor.kind !== 'player') {
      const staff = this.state.staff.instances.find((instance) => instance.id === actor.id);
      return 2.5 * BALANCE.movementSpeedMultiplier * (staff ? effectiveMovementSpeed(staff) : 1);
    }
    if (!this.state.profile) return 2.5 * BALANCE.movementSpeedMultiplier;
    const profession = this.professionForRole(this.state.profile.helpRole);
    return 2.5 * BALANCE.movementSpeedMultiplier * (1 + (this.state.profile.professions[profession].level - 1) * .05);
  }
  private taskDuration(actor: WorkerActor, task: RestaurantTask): number {
    if (actor.kind !== 'player') {
      const staff = this.state.staff.instances.find((instance) => instance.id === actor.id);
      return task.duration / Math.max(.5, staff ? effectiveStaffSpeed(staff) : 1);
    }
    if (!this.state.profile) return task.duration;
    const profession = this.professionForRole(task.role); const bonus = (this.state.profile.professions[profession].level - 1) * BALANCE.professionSpeedPerLevel;
    return task.duration * Math.max(.65, 1 - bonus);
  }
  private professionForRole(role: HelpRole): 'cook' | 'waiter' | 'cleaner' | 'stocker' { return role === 'kitchen' ? 'cook' : role === 'service' ? 'waiter' : role === 'cleaning' ? 'cleaner' : 'stocker'; }
  private stationFromTask(task: RestaurantTask): StationRuntime | undefined { return this.stations.find((station) => station.id === task.payload.stationId); }
  private stationForStep(stationId: string, recipeId: RecipeId, moduleId?: string): StationRuntime | undefined {
    if (stationId === 'pickup') {
      const module = moduleId ? this.counterModules.find((item) => item.id === moduleId) : this.counterModules.find((item) => item.assignedRecipeId === recipeId);
      return module ? this.stationForCounterModule(module.id) : this.stations.find((item) => item.id === 'pickup' || item.id.startsWith('pickup:'));
    }
    const compatible = compatibleStationFunction(stationId);
    return this.stations.find((item) => item.id === compatible || item.id.startsWith(`${compatible}:`));
  }
  private stationForCounterModule(moduleId: string): StationRuntime | undefined {
    const module = this.counterModules.find((item) => item.id === moduleId);
    return this.stations.find((item) => (item.id === 'pickup' || item.id === `pickup:${moduleId}`) && (!module || item.position.x === module.gridX && item.position.y === module.gridY));
  }
  private playerActor(): WorkerActor { return this.actors.find((actor) => actor.kind === 'player')!; }
  private customerFor(value: unknown): CustomerRuntime | undefined { return this.customers.find((customer) => customer.id === value); }
  private orderFor(value: unknown): OrderRuntime | undefined { return this.orders.find((order) => order.id === value); }
  private tableFor(value: unknown): TableRuntime | undefined { return this.tables.find((table) => table.id === value); }
  private seatFor(value: unknown): ChairRuntime | undefined { return this.tables.flatMap((table) => table.chairs).find((seat) => seat.seatId === value || seat.id === value); }
  private partyMembers(partyId: string): CustomerRuntime[] { return this.customers.filter((customer) => customer.partyId === partyId); }
  private largestTableCapacity(): number {
    return this.tables.reduce((largest, table) => Math.max(largest, table.accessible ? table.chairs.filter((seat) => this.seatUsable(seat)).length : 0), 0);
  }
  private seatUsable(seat: ChairRuntime): boolean { return seat.enabled && seat.accessible && !['blocked', 'inaccessible'].includes(seat.state); }
  private setCustomerState(customer: CustomerRuntime, state: CustomerState): void { customer.state = state; customer.stateEnteredAt = this.simulationTime; }
  private samePoint(a: GridPoint, b: GridPoint): boolean { return a.x === b.x && a.y === b.y; }
  private distance(a: GridPoint, b: GridPoint): number { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
  private roleLabel(role: HelpRole): string { return { kitchen: 'Cozinha', service: 'Atendimento', cleaning: 'Limpeza', stock: 'Estoque e apoio' }[role]; }
  private developmentMode(): boolean { return typeof window === 'undefined' || ['localhost', '127.0.0.1'].includes(window.location.hostname); }
  private toRecords(value: unknown): Record<string, unknown>[] { return JSON.parse(JSON.stringify(value)) as Record<string, unknown>[]; }
}
