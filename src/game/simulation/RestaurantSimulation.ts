import { BALANCE } from '../../config/balance';
import { RECIPE_BY_ID, RECIPES } from '../../content/recipes/recipes';
import type {
  ActorKind, CustomerState, Direction, GameState, GridPoint, HelpRole, RecipeId, StationRuntime, TableRuntime, TaskKind,
} from '../../core/types';
import { stableRuntimeId } from '../../core/id';
import { gameEvents } from '../../core/events';
import { canConsumeRecipe, consumeRecipe } from '../inventory/InventoryService';
import { createInitialGrid, createStations, createTables, ENTRANCE, CUSTOMER_QUEUE, PICKUP_SERVICE_POINT, STREET_ENTRY_POINTS, STREET_EXIT } from '../map/initialMap';
import { findPath } from '../navigation/AStar';
import { advanceTileMover, directionBetween } from '../navigation/TileMovement';
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
}

export interface WorkerActor extends Mover {
  kind: ActorKind;
  name: string;
  activity: string;
  taskId?: string;
  taskRemaining: number;
  preferredTaskId?: string;
  carrying?: 'dish' | 'ingredients';
}

export interface CustomerRuntime extends Mover {
  state: CustomerState;
  partySize: number;
  patience: number;
  maxPatience: number;
  tableId?: string;
  chairIds: string[];
  orderId?: string;
  eatRemaining: number;
  variant: number;
}

export interface OrderRuntime {
  id: string;
  customerId: string;
  tableId: string;
  recipeId: RecipeId;
  quantity: number;
  state: 'blocked' | 'cooking' | 'ready' | 'collected' | 'delivered' | 'cancelled';
  stepIndex: number;
}

const TASK_LABELS: Record<TaskKind, string> = {
  take_order: 'Anotando pedido', cook_step: 'Preparando prato', deliver: 'Servindo mesa',
  payment: 'Recebendo pagamento', clean: 'Limpando mesa', stock_support: 'Organizando estoque',
};

const CUSTOMER_LABELS: Record<CustomerState, string> = {
  entering: 'Chegando', queueing: 'Na fila', walking_to_seat: 'Indo à mesa', waiting_order: 'Aguardando pedido',
  waiting_food: 'Aguardando prato', eating: 'Saboreando', waiting_payment: 'Quer pagar', leaving: 'Saindo',
  gone: 'Foi embora', gave_up: 'Desistiu',
};

export class RestaurantSimulation {
  readonly tables: TableRuntime[] = createTables();
  readonly stations: StationRuntime[] = createStations();
  readonly grid = createInitialGrid(this.tables);
  readonly tasks = new TaskManager();
  readonly actors: WorkerActor[];
  readonly customers: CustomerRuntime[] = [];
  readonly orders: OrderRuntime[] = [];
  private spawnCountdown = 2;
  private customerSequence = 0;

  constructor(public readonly state: GameState) {
    this.actors = [
      this.makeActor('employee-cook-001', 'cook', 'Nina', { x: 5, y: 5 }),
      this.makeActor('employee-waiter-001', 'waiter', 'Caio', { x: 8, y: 9 }),
      this.makeActor('employee-assistant-001', 'assistant', 'Iara', { x: 3, y: 6 }),
      this.makeActor(state.playerId, 'player', state.profile?.name ?? 'Você', { x: 9, y: 14 }),
    ];
    this.actors.forEach((actor) => this.grid.occupy(actor.position, actor.id));
  }

  private makeActor(id: string, kind: ActorKind, name: string, position: GridPoint): WorkerActor {
    return { id, kind, name, position: { ...position }, visual: { ...position }, path: [], moveProgress: 0, direction: 'se', activity: 'Disponível', taskRemaining: 0 };
  }

  update(deltaSeconds: number): void {
    const delta = Math.max(0, Math.min(0.1, deltaSeconds));
    this.pruneGoneCustomers();
    const production = tickProduction(this.state, delta);
    if (Object.keys(production.produced).length) gameEvents.emit('toast', { message: 'Produção programada concluída!', tone: 'success' });

    this.spawnCountdown -= delta;
    if (this.spawnCountdown <= 0 && this.customers.filter((customer) => customer.state !== 'gone').length < 6) {
      this.spawnCustomer();
      this.spawnCountdown = BALANCE.customerSpawnSeconds + (this.customerSequence % 4);
    }
    this.assignQueuedCustomers();
    this.updateCustomers(delta);
    this.updateActors(delta);
    updateRestaurantLevel(this.state);
    gameEvents.emit('simulation:update', undefined);
  }

  private spawnCustomer(): void {
    this.customerSequence += 1;
    const maxParty = this.customerSequence % 4 === 0 ? 4 : this.customerSequence % 3 === 0 ? 2 : 1;
    const streetSpawn = STREET_ENTRY_POINTS[(this.customerSequence - 1) % STREET_ENTRY_POINTS.length];
    const customer: CustomerRuntime = {
      id: stableRuntimeId('customer'), state: 'entering', partySize: maxParty,
      patience: BALANCE.customerBasePatienceSeconds, maxPatience: BALANCE.customerBasePatienceSeconds,
      position: { ...streetSpawn }, visual: { ...streetSpawn }, path: [], moveProgress: 0,
      chairIds: [], eatRemaining: 0, variant: this.customerSequence % 8, direction: 'nw',
    };
    this.customers.push(customer);
    this.grid.occupy(customer.position, customer.id);
    customer.path = findPath(this.grid, customer.position, ENTRANCE, customer.id);
  }

  private assignTable(customer: CustomerRuntime): boolean {
    const table = this.tables.find((candidate) => candidate.state === 'free' && candidate.accessible && candidate.maxCustomers >= customer.partySize && candidate.chairs.filter((chair) => chair.state === 'free').length >= customer.partySize);
    if (!table) return false;
    const chairs = table.chairs.filter((chair) => chair.state === 'free').slice(0, customer.partySize);
    table.state = 'reserved';
    table.customerId = customer.id;
    chairs.forEach((chair) => { chair.state = 'reserved'; });
    customer.tableId = table.id;
    customer.chairIds = chairs.map((chair) => chair.id);
    customer.state = 'walking_to_seat';
    customer.path = findPath(this.grid, customer.position, chairs[0].approach, customer.id);
    return customer.path.length > 0 || this.samePoint(customer.position, chairs[0].approach);
  }

  private sendToQueue(customer: CustomerRuntime): void {
    customer.state = 'queueing';
    const queueIndex = Math.min(CUSTOMER_QUEUE.length - 1, this.customers.filter((entry) => entry.state === 'queueing').length - 1);
    customer.path = findPath(this.grid, customer.position, CUSTOMER_QUEUE[Math.max(0, queueIndex)], customer.id);
  }

  private assignQueuedCustomers(): void {
    for (const customer of this.customers.filter((entry) => entry.state === 'queueing' && entry.path.length === 0)) {
      if (this.assignTable(customer)) break;
    }
  }

  private updateCustomers(delta: number): void {
    for (const customer of this.customers) {
      if (customer.state === 'gone') continue;
      if ((customer.state === 'leaving' || customer.state === 'gave_up') && !customer.path.length) {
        this.routeCustomerToExit(customer);
        if (!customer.path.length) continue;
      }
      if (customer.path.length) {
        this.advanceMover(customer, delta, 2.1 * BALANCE.movementSpeedMultiplier);
        if (!customer.path.length) this.onCustomerArrived(customer);
      }
      if (['queueing', 'waiting_order', 'waiting_food', 'waiting_payment'].includes(customer.state)) {
        customer.patience -= delta;
        if (customer.patience <= 0) this.customerGivesUp(customer);
      }
      if (customer.state === 'eating') {
        customer.eatRemaining -= delta;
        if (customer.eatRemaining <= 0) this.requestPayment(customer);
      }
    }
  }

  private onCustomerArrived(customer: CustomerRuntime): void {
    if (customer.state === 'entering') {
      if (!this.assignTable(customer)) this.sendToQueue(customer);
    } else if (customer.state === 'walking_to_seat') {
      const table = this.tableFor(customer.tableId);
      if (!table) return;
      customer.state = 'waiting_order';
      table.state = 'waiting_order';
      const seatedChair = table.chairs.find((item) => customer.chairIds.includes(item.id));
      if (seatedChair) customer.direction = seatedChair.orientation;
      customer.chairIds.forEach((chairId) => { const chair = table.chairs.find((item) => item.id === chairId); if (chair) chair.state = 'occupied'; });
      this.tasks.add({
        key: `order:${customer.id}`, kind: 'take_order', role: 'service', target: table.waiterApproach,
        duration: BALANCE.actionSeconds.takeOrder, priority: 70, payload: { customerId: customer.id, tableId: table.id },
      });
    } else if (customer.state === 'leaving' || customer.state === 'gave_up') {
      this.completeCustomerDeparture(customer);
    }
  }

  private routeCustomerToExit(customer: CustomerRuntime): void {
    if (this.samePoint(customer.position, STREET_EXIT)) {
      this.completeCustomerDeparture(customer);
      return;
    }
    customer.path = findPath(this.grid, customer.position, STREET_EXIT, customer.id);
  }

  private completeCustomerDeparture(customer: CustomerRuntime): void {
    customer.state = 'gone';
    customer.path = [];
    this.grid.vacate(customer.id);
  }

  private pruneGoneCustomers(): void {
    for (let index = this.customers.length - 1; index >= 0; index -= 1) {
      if (this.customers[index].state === 'gone') this.customers.splice(index, 1);
    }
  }

  private customerGivesUp(customer: CustomerRuntime): void {
    if (customer.state === 'gone' || customer.state === 'leaving' || customer.state === 'gave_up') return;
    const wasSeated = Boolean(customer.tableId);
    customer.state = 'gave_up';
    this.state.reputation = Math.max(0, this.state.reputation - 2);
    this.state.stats.customersLost += 1;
    this.tasks.cancelWhere((task) => task.payload.customerId === customer.id);
    const order = this.orders.find((item) => item.id === customer.orderId);
    if (order && order.state !== 'cooking') order.state = 'cancelled';
    if (wasSeated) this.dirtyTable(customer.tableId!);
    this.routeCustomerToExit(customer);
    gameEvents.emit('toast', { message: 'Um cliente perdeu a paciência. Reputação −2.', tone: 'danger' });
  }

  private requestPayment(customer: CustomerRuntime): void {
    const table = this.tableFor(customer.tableId);
    if (!table) return;
    customer.state = 'waiting_payment';
    table.state = 'occupied';
    this.tasks.add({
      key: `payment:${customer.id}`, kind: 'payment', role: 'service', target: table.waiterApproach,
      duration: BALANCE.actionSeconds.payment, priority: 95, payload: { customerId: customer.id, tableId: table.id },
    });
  }

  private updateActors(delta: number): void {
    for (const actor of this.actors) {
      if (!actor.taskId) this.claimTask(actor);
      if (!actor.taskId) { actor.activity = 'Sem tarefa'; continue; }
      const task = this.tasks.get(actor.taskId);
      if (!task || task.status === 'complete') { actor.taskId = undefined; actor.activity = 'Disponível'; continue; }
      if (actor.path.length) {
        actor.activity = `A caminho · ${TASK_LABELS[task.kind]}`;
        this.advanceMover(actor, delta, this.workerSpeed(actor));
      }
      if (!actor.path.length && task.status === 'reserved') {
        if (this.tasks.activate(task.id, actor.id)) {
          actor.taskRemaining = this.taskDuration(actor, task);
          actor.activity = TASK_LABELS[task.kind];
          const station = this.stationFromTask(task);
          if (station) {
            station.state = 'in_use'; station.workerId = actor.id; station.remaining = actor.taskRemaining;
            actor.direction = directionBetween(actor.position, station.position, actor.direction);
          }
        }
      }
      if (task.status === 'active') {
        actor.taskRemaining -= delta;
        const station = this.stationFromTask(task);
        if (station) station.remaining = Math.max(0, actor.taskRemaining);
        if (actor.taskRemaining <= 0) this.completeTask(actor, task);
      }
    }
  }

  private claimTask(actor: WorkerActor): void {
    const roles: HelpRole[] = actor.kind === 'cook' ? ['kitchen'] : actor.kind === 'waiter' ? ['service', 'cleaning'] : actor.kind === 'assistant' ? ['stock', 'cleaning'] : [this.state.profile?.helpRole ?? 'kitchen'];
    const task = this.tasks.claim(actor.id, roles, actor.preferredTaskId, (candidate) => {
      const station = this.stationFromTask(candidate);
      return !station || station.state === 'free' || station.queue[0] === candidate.payload.orderId;
    });
    actor.preferredTaskId = undefined;
    if (!task) return;
    const path = findPath(this.grid, actor.position, task.target, actor.id);
    if (!path.length && !this.samePoint(actor.position, task.target)) {
      this.tasks.release(task.id, actor.id);
      actor.activity = 'Caminho bloqueado';
      return;
    }
    actor.taskId = task.id;
    actor.path = path;
    if (task.kind === 'deliver' && task.payload.deliveryStage === 'serve') actor.carrying = 'dish';
    if (task.kind === 'stock_support') actor.carrying = 'ingredients';
    const station = this.stationFromTask(task);
    if (station) { station.state = 'reserved'; station.workerId = actor.id; }
  }

  private completeTask(actor: WorkerActor, task: RestaurantTask): void {
    const completed = this.tasks.complete(task.id, actor.id);
    if (!completed) return;
    const station = this.stationFromTask(task);
    if (station) { station.state = 'free'; station.workerId = undefined; station.remaining = 0; station.currentStep = undefined; station.queue = station.queue.filter((id) => id !== task.payload.orderId); }
    this.resolveTask(actor, task);
    if (actor.kind === 'player') awardPlayerTaskXp(this.state, task.kind);
    actor.taskId = undefined;
    actor.taskRemaining = 0;
    actor.activity = 'Disponível';
    this.tasks.prune();
  }

  private resolveTask(actor: WorkerActor, task: RestaurantTask): void {
    const customer = this.customerFor(task.payload.customerId);
    const table = this.tableFor(task.payload.tableId);
    if (task.kind === 'take_order' && customer && table && customer.state === 'waiting_order') {
      this.placeOrder(customer, table);
    } else if (task.kind === 'cook_step') {
      this.finishCookStep(String(task.payload.orderId));
    } else if (task.kind === 'deliver' && task.payload.deliveryStage === 'collect' && customer && table && customer.state === 'waiting_food') {
      const order = this.orders.find((item) => item.id === customer.orderId);
      if (order) {
        order.state = 'collected';
        actor.carrying = 'dish';
        const nextTask = this.createTableDelivery(order);
        actor.preferredTaskId = nextTask.id;
      }
    } else if (task.kind === 'deliver' && customer && table && customer.state === 'waiting_food') {
      const order = this.orders.find((item) => item.id === customer.orderId);
      if (order) order.state = 'delivered';
      actor.carrying = undefined;
      customer.state = 'eating'; customer.eatRemaining = BALANCE.customerEatSeconds + customer.partySize;
      table.state = 'eating';
    } else if (task.kind === 'payment' && customer && table && customer.state === 'waiting_payment') {
      const order = this.orders.find((item) => item.id === customer.orderId);
      if (!order) return;
      const recipe = RECIPE_BY_ID[order.recipeId];
      const earned = recipe.salePrice * order.quantity;
      this.state.coins += earned;
      this.state.restaurantXp += recipe.experience * order.quantity + 2;
      this.state.reputation = Math.min(100, this.state.reputation + 1);
      this.state.stats.customersServed += order.quantity;
      this.state.stats.coinsEarned += earned;
      customer.state = 'leaving';
      this.routeCustomerToExit(customer);
      this.dirtyTable(table.id);
      gameEvents.emit('toast', { message: `${recipe.name} servido · +${earned} moedas`, tone: 'success' });
    } else if (task.kind === 'clean' && table) {
      table.state = 'free'; table.customerId = undefined;
      table.chairs.forEach((chair) => { chair.state = 'free'; });
    } else if (task.kind === 'stock_support') {
      actor.carrying = undefined;
      const order = this.orders.find((item) => item.id === task.payload.orderId && item.state === 'blocked');
      if (!order) return;
      const recipe = RECIPE_BY_ID[order.recipeId];
      if (!consumeRecipe(this.state, recipe, order.quantity)) return;
      order.state = 'cooking';
      const station = this.stations.find((item) => item.id === recipe.steps[0].stationId);
      if (station?.state === 'no_ingredients') station.state = 'free';
      this.createCookStep(order);
    }
  }

  private placeOrder(customer: CustomerRuntime, table: TableRuntime): void {
    const available = RECIPES.filter((recipe) => recipe.requiredLevel <= this.state.restaurantLevel);
    const recipe = available[(this.customerSequence + this.orders.length) % available.length];
    const order: OrderRuntime = {
      id: stableRuntimeId('order'), customerId: customer.id, tableId: table.id, recipeId: recipe.id,
      quantity: customer.partySize, state: 'cooking', stepIndex: 0,
    };
    this.orders.push(order);
    customer.orderId = order.id;
    customer.state = 'waiting_food'; table.state = 'waiting_food';
    if (this.state.readyDishes[recipe.id] >= order.quantity) {
      this.state.readyDishes[recipe.id] -= order.quantity;
      order.state = 'ready';
      this.createDelivery(order);
      return;
    }
    const consumed = consumeRecipe(this.state, recipe, order.quantity);
    if (!consumed) {
      order.state = 'blocked';
      const firstStation = this.stations.find((station) => station.id === recipe.steps[0].stationId);
      if (firstStation) firstStation.state = 'no_ingredients';
      gameEvents.emit('toast', { message: `Faltam ingredientes para ${recipe.name}.`, tone: 'warning' });
      return;
    }
    this.createCookStep(order);
  }

  private createCookStep(order: OrderRuntime): void {
    const recipe = RECIPE_BY_ID[order.recipeId];
    const step = recipe.steps[order.stepIndex];
    const station = this.stations.find((item) => item.id === step.stationId)!;
    if (!station.queue.includes(order.id)) station.queue.push(order.id);
    station.currentStep = step.label;
    this.tasks.add({
      key: `cook:${order.id}:${order.stepIndex}`, kind: 'cook_step', role: 'kitchen', target: station.interaction,
      duration: step.duration * (0.7 + 0.3 * order.quantity) / BALANCE.cookingSpeedMultiplier, priority: 60,
      payload: { orderId: order.id, stationId: station.id, customerId: order.customerId, tableId: order.tableId },
    });
  }

  private finishCookStep(orderId: string): void {
    const order = this.orders.find((item) => item.id === orderId);
    if (!order || order.state === 'cancelled') return;
    const recipe = RECIPE_BY_ID[order.recipeId];
    order.stepIndex += 1;
    if (order.stepIndex < recipe.steps.length) this.createCookStep(order);
    else {
      const customer = this.customerFor(order.customerId);
      if (!customer || customer.state === 'gone' || customer.state === 'gave_up') {
        const free = readyDishCapacity(this.state) - readyDishUsed(this.state);
        this.state.readyDishes[order.recipeId] += Math.max(0, Math.min(order.quantity, free));
        order.state = 'cancelled';
      } else {
        order.state = 'ready'; this.createDelivery(order);
      }
    }
  }

  private createDelivery(order: OrderRuntime): void {
    this.tasks.add({
      key: `deliver:${order.id}:collect`, kind: 'deliver', role: 'service', target: PICKUP_SERVICE_POINT,
      duration: Math.min(1.2, BALANCE.actionSeconds.deliver / 2), priority: 100,
      payload: { orderId: order.id, customerId: order.customerId, tableId: order.tableId, stationId: 'pickup', deliveryStage: 'collect' },
    });
  }

  private createTableDelivery(order: OrderRuntime): RestaurantTask {
    const table = this.tableFor(order.tableId)!;
    return this.tasks.add({
      key: `deliver:${order.id}:serve`, kind: 'deliver', role: 'service', target: table.waiterApproach,
      duration: Math.max(1.2, BALANCE.actionSeconds.deliver / 2), priority: 110,
      payload: { orderId: order.id, customerId: order.customerId, tableId: order.tableId, deliveryStage: 'serve' },
    });
  }

  private dirtyTable(tableId: string): void {
    const table = this.tableFor(tableId);
    if (!table || table.state === 'waiting_cleaning') return;
    table.state = 'waiting_cleaning';
    this.tasks.add({
      key: `clean:${table.id}`, kind: 'clean', role: 'cleaning', target: table.waiterApproach,
      duration: BALANCE.actionSeconds.clean, priority: 82, payload: { tableId: table.id, customerId: table.customerId ?? '' },
    });
  }

  retryBlockedOrders(): void {
    for (const order of this.orders.filter((item) => item.state === 'blocked')) {
      const recipe = RECIPE_BY_ID[order.recipeId];
      if (!canConsumeRecipe(this.state, recipe, order.quantity)) continue;
      this.tasks.add({
        key: `stock:${order.id}`, kind: 'stock_support', role: 'stock', target: { x: 3, y: 5 },
        duration: 3.5, priority: 66, payload: { orderId: order.id, customerId: order.customerId, tableId: order.tableId },
      });
    }
  }

  setPlayerRole(role: HelpRole): void {
    if (!this.state.profile) return;
    this.state.profile.helpRole = role;
    const actor = this.playerActor();
    const task = actor.taskId ? this.tasks.get(actor.taskId) : undefined;
    if (task?.status === 'reserved') {
      this.tasks.release(task.id, actor.id); actor.taskId = undefined; actor.path = []; this.grid.releaseReservations(actor.id);
    }
    gameEvents.emit('toast', { message: `Agora você prioriza: ${this.roleLabel(role)}.`, tone: 'info' });
  }

  prioritizeForPlayer(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    const player = this.playerActor();
    if (!task || task.status !== 'available' || task.role !== this.state.profile?.helpRole) return false;
    player.preferredTaskId = taskId;
    return true;
  }

  prioritizeWorldTarget(type: 'table' | 'station', id: string): boolean {
    const task = this.tasks.list().find((candidate) => candidate.status === 'available' && (type === 'table' ? candidate.payload.tableId === id : candidate.payload.stationId === id));
    return task ? this.prioritizeForPlayer(task.id) : false;
  }

  cancelPlayerPendingTask(): boolean {
    const actor = this.playerActor();
    if (!actor.taskId) return false;
    const task = this.tasks.get(actor.taskId);
    if (!task || task.status !== 'reserved') return false;
    this.tasks.release(task.id, actor.id); actor.taskId = undefined; actor.path = []; actor.activity = 'Tarefa cancelada'; this.grid.releaseReservations(actor.id);
    return true;
  }

  playerTaskLabel(): string { return this.playerActor().activity; }
  customerLabel(customer: CustomerRuntime): string { return CUSTOMER_LABELS[customer.state]; }
  activeCustomerCount(): number { return this.customers.filter((customer) => !['gone', 'gave_up'].includes(customer.state)).length; }

  private advanceMover(mover: Mover, delta: number, speed: number): void {
    advanceTileMover(this.grid, mover, delta, speed);
  }

  private workerSpeed(actor: WorkerActor): number {
    if (actor.kind !== 'player' || !this.state.profile) return 2.5 * BALANCE.movementSpeedMultiplier;
    const role = this.state.profile.helpRole;
    const profession = role === 'kitchen' ? 'cook' : role === 'service' ? 'waiter' : role === 'cleaning' ? 'cleaner' : 'stocker';
    return 2.5 * BALANCE.movementSpeedMultiplier * (1 + (this.state.profile.professions[profession].level - 1) * 0.05);
  }

  private taskDuration(actor: WorkerActor, task: RestaurantTask): number {
    if (actor.kind !== 'player' || !this.state.profile) return task.duration;
    const profession = task.role === 'kitchen' ? 'cook' : task.role === 'service' ? 'waiter' : task.role === 'cleaning' ? 'cleaner' : 'stocker';
    const bonus = (this.state.profile.professions[profession].level - 1) * BALANCE.professionSpeedPerLevel;
    return task.duration * Math.max(0.65, 1 - bonus);
  }

  private stationFromTask(task: RestaurantTask): StationRuntime | undefined {
    return this.stations.find((station) => station.id === task.payload.stationId);
  }
  private playerActor(): WorkerActor { return this.actors.find((actor) => actor.kind === 'player')!; }
  private customerFor(value: unknown): CustomerRuntime | undefined { return this.customers.find((customer) => customer.id === value); }
  private tableFor(value: unknown): TableRuntime | undefined { return this.tables.find((table) => table.id === value); }
  private samePoint(a: GridPoint, b: GridPoint): boolean { return a.x === b.x && a.y === b.y; }
  private roleLabel(role: HelpRole): string { return { kitchen: 'Cozinha', service: 'Atendimento', cleaning: 'Limpeza', stock: 'Estoque e apoio' }[role]; }
}
