import { BALANCE } from '../../config/balance';
import { RECIPE_BY_ID, RECIPES } from '../../content/recipes/recipes';
import type {
  GameState, ProductionPlan, ProductionPlanMode, ProductionSystemState, ProductionTask, RecipeId, ServiceCounterModule, StationRuntime,
} from '../../core/types';
import { stableRuntimeId } from '../../core/id';
import { consumeReservation, releaseReservation, reserveRecipe } from '../inventory/InventoryService';
import { productionDuration } from './ProductionService';

export interface CreateProductionPlanInput {
  recipeId: RecipeId;
  mode?: ProductionPlanMode;
  targetQuantity: number;
  batchSize?: number;
  priority?: number;
  preferredEquipmentIds?: string[];
  preferredCounterIds?: string[];
  repeat?: boolean;
}

export interface ProductionPlanResult { ok: boolean; plan?: ProductionPlan; reason?: string }

export function createInitialProductionState(): ProductionSystemState {
  return {
    plans: [],
    tasks: [],
    stockTargets: RECIPES.map((recipe, index) => ({
      recipeId: recipe.id, enabled: false, minimumPrepared: 4, targetPrepared: 12, maximumPrepared: 24,
      priority: 60 - index, allowedCounterIds: [],
    })),
  };
}

export function sanitizeProductionState(input: ProductionSystemState | undefined): ProductionSystemState {
  const fallback = createInitialProductionState();
  if (!input) return fallback;
  const plans = Array.isArray(input.plans) ? input.plans.filter((plan) => RECIPE_BY_ID[plan.recipeId]).map((plan) => ({
    ...plan,
    targetQuantity: clampQuantity(plan.targetQuantity),
    batchSize: clampBatch(plan.batchSize),
    priority: Math.max(1, Math.min(100, Math.floor(Number(plan.priority) || 50))),
    preferredEquipmentIds: Array.isArray(plan.preferredEquipmentIds) ? plan.preferredEquipmentIds : [],
    preferredCounterIds: Array.isArray(plan.preferredCounterIds) ? plan.preferredCounterIds : [],
  })) : [];
  const planIds = new Set(plans.map((plan) => plan.id));
  const tasks = Array.isArray(input.tasks) ? input.tasks.filter((task) => planIds.has(task.productionPlanId) && RECIPE_BY_ID[task.recipeId]).map(sanitizeTask).slice(-BALANCE.production.queueHistoryLimit) : [];
  const stockTargets = RECIPES.map((recipe) => {
    const base = fallback.stockTargets.find((target) => target.recipeId === recipe.id)!;
    const target = input.stockTargets?.find((item) => item.recipeId === recipe.id);
    if (!target) return base;
    const minimumPrepared = Math.max(0, Math.min(999, Math.floor(Number(target.minimumPrepared) || 0)));
    const targetPrepared = Math.max(minimumPrepared, Math.min(999, Math.floor(Number(target.targetPrepared) || 0)));
    return { ...base, ...target, minimumPrepared, targetPrepared, maximumPrepared: Math.max(targetPrepared, Math.min(999, Math.floor(Number(target.maximumPrepared) || targetPrepared))) };
  });
  return { plans, tasks, stockTargets };
}

export function createProductionPlan(state: GameState, input: CreateProductionPlanInput, now = Date.now()): ProductionPlanResult {
  const recipe = RECIPE_BY_ID[input.recipeId];
  if (!recipe) return { ok: false, reason: 'Receita desconhecida.' };
  if (recipe.requiredLevel > state.restaurantLevel) return { ok: false, reason: `Receita requer nível ${recipe.requiredLevel}.` };
  const targetQuantity = clampQuantity(input.targetQuantity);
  if (targetQuantity !== Math.floor(Number(input.targetQuantity))) return { ok: false, reason: `A quantidade deve ficar entre 1 e ${BALANCE.production.maximumQuantity}.` };
  const batchSize = Math.min(targetQuantity, clampBatch(input.batchSize ?? BALANCE.production.defaultBatchSize));
  const mode = input.mode ?? 'fixedQuantity';
  const plan: ProductionPlan = {
    id: stableRuntimeId('production-plan'), recipeId: input.recipeId, mode, targetQuantity, batchSize,
    priority: Math.max(1, Math.min(100, Math.floor(input.priority ?? 50))),
    preferredEquipmentIds: [...(input.preferredEquipmentIds ?? [])], preferredCounterIds: [...(input.preferredCounterIds ?? [])],
    enabled: true, repeat: Boolean(input.repeat || mode === 'repeatWhileResources'), currentProgress: 0, createdAt: now,
  };
  state.production.plans.push(plan);
  if (mode !== 'maintainTarget') appendBatches(state, plan, targetQuantity, now);
  return { ok: true, plan };
}

export function refreshMaintainTargetPlans(state: GameState, counters: ServiceCounterModule[], now = Date.now()): void {
  for (const target of state.production.stockTargets.filter((item) => item.enabled)) {
    const prepared = preparedQuantity(counters, target.recipeId);
    const inProduction = plannedQuantity(state, target.recipeId);
    const need = Math.max(0, Math.min(target.maximumPrepared, target.targetPrepared) - prepared - inProduction);
    let plan = state.production.plans.find((item) => item.recipeId === target.recipeId && item.mode === 'maintainTarget');
    if (!plan) {
      plan = {
        id: stableRuntimeId('production-plan'), recipeId: target.recipeId, mode: 'maintainTarget', targetQuantity: target.targetPrepared,
        batchSize: Math.min(BALANCE.production.defaultBatchSize, Math.max(1, target.targetPrepared)), priority: target.priority,
        preferredEquipmentIds: [], preferredCounterIds: [...target.allowedCounterIds], enabled: true, repeat: true, currentProgress: 0, createdAt: now,
      };
      state.production.plans.push(plan);
    }
    plan.enabled = true; plan.targetQuantity = target.targetPrepared; plan.priority = target.priority; plan.preferredCounterIds = [...target.allowedCounterIds];
    if (need > 0) appendBatches(state, plan, need, now);
  }
}

export interface PreparedProductionTask {
  task: ProductionTask;
  station: StationRuntime;
  target: { x: number; y: number };
  priority: number;
  duration: number;
}

export function prepareNextProductionTask(state: GameState, stations: StationRuntime[], counters: ServiceCounterModule[], now = Date.now()): PreparedProductionTask | undefined {
  const candidates = state.production.tasks.filter((task) => ['queued', 'waitingForIngredients', 'waitingForStorage', 'waitingForStaff', 'waitingForWorkstation', 'waitingForCounterSpace'].includes(task.state))
    .filter((task) => state.production.plans.find((plan) => plan.id === task.productionPlanId)?.enabled)
    .sort((left, right) => planPriority(state, right.productionPlanId) - planPriority(state, left.productionPlanId) || left.createdAt - right.createdAt);
  for (const task of candidates) {
    const plan = state.production.plans.find((item) => item.id === task.productionPlanId)!;
    const recipe = RECIPE_BY_ID[task.recipeId];
    const stationStep = recipe.steps.find((step) => step.stationId !== 'pickup');
    const station = stations.find((candidate) => (!stationStep || candidate.id === stationStep.stationId || candidate.id.startsWith(`${stationStep.stationId}:`))
      && candidate.state === 'free' && (!plan.preferredEquipmentIds.length || plan.preferredEquipmentIds.includes(candidate.id)));
    if (!station) { task.state = 'waitingForWorkstation'; task.blockedReason = 'Equipamento ou WorkSlot indisponível.'; continue; }
    const output = reserveOutputCapacity(counters, task.recipeId, task.batchQuantity, plan.preferredCounterIds);
    if (!output) { task.state = 'waitingForCounterSpace'; task.blockedReason = 'Nenhum balcão compatível possui espaço livre.'; continue; }
    const reservation = reserveRecipe(state, recipe, task.batchQuantity);
    if (!reservation) {
      releaseOutputCapacity(counters, output); task.state = 'waitingForIngredients'; task.blockedReason = 'Ingredientes insuficientes.'; continue;
    }
    task.reservedIngredients = reservation;
    task.outputReservations = output;
    task.outputCounterId = output[0]?.moduleId;
    task.workstationId = station.id;
    task.workSlotId = `${station.id}:primary`;
    task.state = 'reserved';
    task.blockedReason = undefined;
    return { task, station, target: station.interaction, priority: plan.priority, duration: productionDuration(state, task.recipeId) * task.batchQuantity };
  }
  return undefined;
}

export function markProductionTaskStarted(state: Pick<GameState, 'production'>, taskId: string, staffId: string, now = Date.now()): boolean {
  const task = state.production.tasks.find((item) => item.id === taskId);
  if (!task || task.state !== 'reserved') return false;
  task.state = 'cooking'; task.assignedStaffId = staffId; task.startedAt = now; return true;
}

export function completeProductionTask(state: GameState, taskId: string, counters: ServiceCounterModule[], now = Date.now()): boolean {
  const task = state.production.tasks.find((item) => item.id === taskId);
  if (!task || !['reserved', 'inPreparation', 'cooking', 'delivering'].includes(task.state)) return false;
  if (!task.outputReservations.length || task.outputReservations.some((part) => {
    const module = counters.find((item) => item.id === part.moduleId);
    return !module || (module.incomingReservedQuantity ?? 0) < part.quantity || module.currentQuantity + part.quantity > module.maxCapacity;
  })) { task.state = 'waitingForCounterSpace'; task.blockedReason = 'Reserva do balcão ficou inválida.'; return false; }
  if (!consumeReservation(state, task.reservedIngredients)) {
    releaseReservation(state, task.reservedIngredients); releaseOutputCapacity(counters, task.outputReservations);
    task.reservedIngredients = {}; task.outputReservations = []; task.state = 'waitingForIngredients'; task.blockedReason = 'Reserva de ingredientes ficou inválida.'; return false;
  }
  for (const part of task.outputReservations) {
    const module = counters.find((item) => item.id === part.moduleId)!;
    module.incomingReservedQuantity = Math.max(0, (module.incomingReservedQuantity ?? 0) - part.quantity);
    module.currentQuantity += part.quantity;
  }
  const plan = state.production.plans.find((item) => item.id === task.productionPlanId);
  if (plan) plan.currentProgress += task.batchQuantity;
  state.stats.dishesProduced += task.batchQuantity;
  state.restaurantXp += RECIPE_BY_ID[task.recipeId].experience * task.batchQuantity;
  task.state = 'completed'; task.completedAt = now; task.blockedReason = undefined; task.reservedIngredients = {}; task.outputReservations = [];
  state.production.tasks = trimProductionTasks(state.production.tasks);
  return true;
}

export function deferProductionTask(state: GameState, taskId: string, counters: ServiceCounterModule[], reason = 'Aguardando próxima oportunidade.'): boolean {
  const task = state.production.tasks.find((item) => item.id === taskId);
  if (!task || !['reserved', 'inPreparation', 'cooking', 'delivering'].includes(task.state)) return false;
  releaseReservation(state, task.reservedIngredients); releaseOutputCapacity(counters, task.outputReservations);
  task.reservedIngredients = {}; task.outputReservations = []; task.assignedStaffId = undefined; task.workstationId = undefined; task.workSlotId = undefined;
  task.state = 'queued'; task.blockedReason = reason; return true;
}

export function pauseProductionPlan(state: Pick<GameState, 'production'>, planId: string, enabled: boolean): boolean {
  const plan = state.production.plans.find((item) => item.id === planId);
  if (!plan) return false; plan.enabled = enabled; return true;
}

export function cancelProductionPlan(state: GameState, planId: string, counters: ServiceCounterModule[], now = Date.now()): boolean {
  const plan = state.production.plans.find((item) => item.id === planId);
  if (!plan) return false;
  plan.enabled = false;
  for (const task of state.production.tasks.filter((item) => item.productionPlanId === planId && !['completed', 'cancelled', 'failed'].includes(item.state))) {
    if (Object.keys(task.reservedIngredients).length) releaseReservation(state, task.reservedIngredients);
    releaseOutputCapacity(counters, task.outputReservations);
    task.reservedIngredients = {}; task.outputReservations = []; task.state = 'cancelled'; task.completedAt = now; task.blockedReason = 'Plano cancelado pelo jogador.';
  }
  return true;
}

export function preparedQuantity(counters: ServiceCounterModule[], recipeId: RecipeId): number {
  return counters.filter((module) => module.assignedRecipeId === recipeId).reduce((sum, module) => sum + module.currentQuantity, 0);
}

export function availablePreparedQuantity(counters: ServiceCounterModule[], recipeId: RecipeId): number {
  return counters.filter((module) => module.assignedRecipeId === recipeId).reduce((sum, module) => sum + Math.max(0, module.currentQuantity - module.reservedQuantity), 0);
}

export function plannedQuantity(state: Pick<GameState, 'production'>, recipeId: RecipeId): number {
  return state.production.tasks.filter((task) => task.recipeId === recipeId && !['completed', 'cancelled', 'failed'].includes(task.state)).reduce((sum, task) => sum + task.batchQuantity, 0);
}

function appendBatches(state: Pick<GameState, 'production'>, plan: ProductionPlan, quantity: number, now: number): void {
  let remaining = Math.max(0, Math.floor(quantity));
  while (remaining > 0) {
    const batchQuantity = Math.min(plan.batchSize, remaining);
    const requiredIngredients = Object.fromEntries(RECIPE_BY_ID[plan.recipeId].ingredients.map((part) => [part.ingredientId, part.amount * batchQuantity]));
    state.production.tasks.push({
      id: stableRuntimeId('production-task'), productionPlanId: plan.id, recipeId: plan.recipeId, batchQuantity,
      state: 'queued', requiredIngredients, reservedIngredients: {}, outputReservations: [], createdAt: now,
    });
    remaining -= batchQuantity;
  }
  state.production.tasks = trimProductionTasks(state.production.tasks);
}

function reserveOutputCapacity(counters: ServiceCounterModule[], recipeId: RecipeId, quantity: number, preferredIds: string[]): { moduleId: string; quantity: number }[] | undefined {
  let compatible = counters.filter((module) => module.assignedRecipeId === recipeId && (!preferredIds.length || preferredIds.includes(module.id)));
  if (!compatible.length && preferredIds.length) compatible = counters.filter((module) => module.assignedRecipeId === recipeId);
  if (!compatible.length) {
    const empty = counters.find((module) => !module.assignedRecipeId && module.currentQuantity === 0 && module.reservedQuantity === 0 && (module.incomingReservedQuantity ?? 0) === 0);
    if (empty) { empty.assignedRecipeId = recipeId; compatible = [empty]; }
  }
  let remaining = quantity;
  const reservation: { moduleId: string; quantity: number }[] = [];
  for (const module of compatible) {
    const free = Math.max(0, module.maxCapacity - module.currentQuantity - (module.incomingReservedQuantity ?? 0));
    const accepted = Math.min(remaining, free);
    if (!accepted) continue;
    module.incomingReservedQuantity = (module.incomingReservedQuantity ?? 0) + accepted;
    reservation.push({ moduleId: module.id, quantity: accepted }); remaining -= accepted;
    if (!remaining) break;
  }
  if (remaining) { releaseOutputCapacity(counters, reservation); return undefined; }
  return reservation;
}

function releaseOutputCapacity(counters: ServiceCounterModule[], reservation: readonly { moduleId: string; quantity: number }[]): void {
  for (const part of reservation) {
    const module = counters.find((item) => item.id === part.moduleId);
    if (module) module.incomingReservedQuantity = Math.max(0, (module.incomingReservedQuantity ?? 0) - part.quantity);
  }
}

function sanitizeTask(task: ProductionTask): ProductionTask {
  const resumable = ['reserved', 'inPreparation', 'cooking', 'delivering'].includes(task.state);
  return {
    ...task,
    batchQuantity: clampQuantity(task.batchQuantity),
    state: resumable ? 'queued' : task.state,
    reservedIngredients: resumable ? {} : (task.reservedIngredients ?? {}),
    outputReservations: resumable ? [] : (task.outputReservations ?? []),
    assignedStaffId: resumable ? undefined : task.assignedStaffId,
    workstationId: resumable ? undefined : task.workstationId,
    workSlotId: resumable ? undefined : task.workSlotId,
  };
}

function trimProductionTasks(tasks: ProductionTask[]): ProductionTask[] {
  const active = tasks.filter((task) => !['completed', 'cancelled', 'failed'].includes(task.state));
  const terminal = tasks.filter((task) => ['completed', 'cancelled', 'failed'].includes(task.state)).slice(-Math.max(0, BALANCE.production.queueHistoryLimit - active.length));
  return [...terminal, ...active];
}

function planPriority(state: Pick<GameState, 'production'>, planId: string): number { return state.production.plans.find((plan) => plan.id === planId)?.priority ?? 0; }
function clampQuantity(value: number): number { return Math.max(1, Math.min(BALANCE.production.maximumQuantity, Math.floor(Number(value) || 1))); }
function clampBatch(value: number): number { return Math.max(1, Math.min(BALANCE.production.maximumBatchSize, Math.floor(Number(value) || 1))); }
