import { BALANCE } from '../../config/balance';
import { RECIPE_BY_ID, RECIPES } from '../../content/recipes/recipes';
import type {
  GameState, ProductionPlan, ProductionPlanMode, ProductionSystemState, ProductionTask, RecipeId, ServiceCounterModule, StationRuntime,
} from '../../core/types';
import { stableRuntimeId } from '../../core/id';
import { productionDuration } from './ProductionService';
import { compatibleStationFunction } from '../recipes/RecipeAvailability';
import { STAFF_BY_ID } from '../data/staff';
import { gameEvents } from '../../core/events';

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
    repeat: Boolean(plan.repeat),
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
  const availableSpecialties = new Set(state.staff.instances
    .filter((instance) => instance.enabled && instance.role === 'cook')
    .flatMap((instance) => STAFF_BY_ID[instance.definitionId]?.specialties ?? []));
  const missingSpecialties = recipe.requiredSpecialties.filter((specialty) => !availableSpecialties.has(specialty));
  if (missingSpecialties.length) return { ok: false, reason: `Lote não iniciado: contrate ${missingSpecialties.join(' + ')}.` };
  const productionCost = productionCostFor(state, input.recipeId);
  if (state.coins < productionCost) return { ok: false, reason: `Saldo insuficiente: faltam ${productionCost - state.coins} moedas. O lote custa ${productionCost}.` };
  const targetQuantity = recipe.batchYield;
  const batchSize = recipe.batchYield;
  const repeating = Boolean(input.repeat || input.mode === 'repeatWhileResources');
  const mode: ProductionPlanMode = repeating ? 'repeatWhileResources' : 'singleBatch';
  const plan: ProductionPlan = {
    id: stableRuntimeId('production-plan'), recipeId: input.recipeId, mode, targetQuantity, batchSize,
    priority: Math.max(1, Math.min(100, Math.floor(input.priority ?? 50))),
    preferredEquipmentIds: [...(input.preferredEquipmentIds ?? [])], preferredCounterIds: [...(input.preferredCounterIds ?? [])],
    enabled: true, repeat: repeating, currentProgress: 0, createdAt: now, chargedCost: productionCost,
  };
  state.coins -= productionCost;
  state.production.plans.push(plan);
  appendBatches(state, plan, targetQuantity, now);
  return { ok: true, plan };
}

export function refreshMaintainTargetPlans(state: GameState, counters: ServiceCounterModule[], now = Date.now()): void {
  void counters; void now;
  for (const target of state.production.stockTargets) target.enabled = false;
  for (const plan of state.production.plans.filter((item) => item.mode === 'maintainTarget')) plan.enabled = false;
}

export interface PreparedProductionTask {
  task: ProductionTask;
  station: StationRuntime;
  target: { x: number; y: number };
  priority: number;
  duration: number;
}

export function prepareNextProductionTask(state: GameState, stations: StationRuntime[], counters: ServiceCounterModule[], now = Date.now()): PreparedProductionTask | undefined {
  const candidates = state.production.tasks.filter((task) => ['queued', 'waitingForStaff', 'waitingForWorkstation'].includes(task.state))
    .filter((task) => state.production.plans.find((plan) => plan.id === task.productionPlanId)?.enabled)
    .sort((left, right) => planPriority(state, right.productionPlanId) - planPriority(state, left.productionPlanId) || left.createdAt - right.createdAt);
  for (const task of candidates) {
    const plan = state.production.plans.find((item) => item.id === task.productionPlanId)!;
    const recipe = RECIPE_BY_ID[task.recipeId];
    const stationStep = recipe.steps.find((step) => step.stationId !== 'pickup');
    const compatibleStationId = stationStep ? compatibleStationFunction(stationStep.stationId) : undefined;
    const station = stations.find((candidate) => (!compatibleStationId || candidate.id === compatibleStationId || candidate.id.startsWith(`${compatibleStationId}:`))
      && candidate.state === 'free' && (!plan.preferredEquipmentIds.length || plan.preferredEquipmentIds.includes(candidate.id)));
    if (!station) { task.state = 'waitingForWorkstation'; task.blockedReason = 'Equipamento ou WorkSlot indisponível.'; continue; }
    const output = reserveOutputCapacity(counters, task.recipeId, task.batchQuantity, plan.preferredCounterIds);
    if (!output) { task.state = 'waitingForWorkstation'; task.blockedReason = 'Instale ao menos um balcão de serviço.'; continue; }
    task.reservedIngredients = {};
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
  task.state = 'cooking'; task.assignedStaffId = staffId; task.startedAt = now;
  task.endsAt = now + RECIPE_BY_ID[task.recipeId].baseDurationSeconds * 1000; task.currentStepIndex ??= 0; return true;
}

export function completeProductionTask(state: GameState, taskId: string, counters: ServiceCounterModule[], now = Date.now()): boolean {
  const task = state.production.tasks.find((item) => item.id === taskId);
  if (!task || !['reserved', 'inPreparation', 'cooking', 'delivering'].includes(task.state)) return false;
  if (!task.outputReservations.length || task.outputReservations.some((part) => {
    const module = counters.find((item) => item.id === part.moduleId);
    return !module || (module.incomingReservedQuantity ?? 0) < part.quantity;
  })) { task.state = 'queued'; task.blockedReason = 'Balcão removido; lote devolvido à fila.'; task.outputReservations = []; return false; }
  for (const part of task.outputReservations) {
    const module = counters.find((item) => item.id === part.moduleId)!;
    module.incomingReservedQuantity = Math.max(0, (module.incomingReservedQuantity ?? 0) - part.quantity);
    module.currentQuantity += part.quantity;
  }
  const plan = state.production.plans.find((item) => item.id === task.productionPlanId);
  if (plan) plan.currentProgress += task.batchQuantity;
  state.stats.dishesProduced += task.batchQuantity;
  state.restaurantXp += RECIPE_BY_ID[task.recipeId].experience * task.batchQuantity;
  task.state = 'completed'; task.completedAt = now; task.completionClaimed = true; task.blockedReason = undefined; task.reservedIngredients = {}; task.outputReservations = [];
  if (plan?.repeat && plan.enabled) {
    const nextCost = productionCostFor(state, task.recipeId);
    if (state.coins >= nextCost) {
      state.coins -= nextCost;
      plan.chargedCost = (plan.chargedCost ?? 0) + nextCost;
      appendBatches(state, plan, RECIPE_BY_ID[task.recipeId].batchYield, now + 1);
    } else {
      plan.enabled = false;
      plan.repeat = false;
      gameEvents.emit('toast', { message: `Repetição de ${RECIPE_BY_ID[task.recipeId].name} pausada: saldo insuficiente.`, tone: 'warning' });
    }
  }
  state.production.tasks = trimProductionTasks(state.production.tasks);
  return true;
}

export function setRecipeRepeat(state: GameState, recipeId: RecipeId, enabled: boolean, now = Date.now()): ProductionPlanResult {
  if (!enabled) {
    for (const plan of state.production.plans.filter((item) => item.recipeId === recipeId && item.repeat)) plan.repeat = false;
    return { ok: true };
  }
  return createProductionPlan(state, { recipeId, targetQuantity: RECIPE_BY_ID[recipeId]?.batchYield ?? 1, mode: 'repeatWhileResources', repeat: true }, now);
}

export function deferProductionTask(state: GameState, taskId: string, counters: ServiceCounterModule[], reason = 'Aguardando próxima oportunidade.'): boolean {
  const task = state.production.tasks.find((item) => item.id === taskId);
  if (!task || !['reserved', 'inPreparation', 'cooking', 'delivering'].includes(task.state)) return false;
  releaseOutputCapacity(counters, task.outputReservations);
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
    releaseOutputCapacity(counters, task.outputReservations);
    task.reservedIngredients = {}; task.outputReservations = []; task.state = 'cancelled'; task.completedAt = now; task.blockedReason = 'Plano cancelado pelo jogador.';
  }
  const started = state.production.tasks.some((item) => item.productionPlanId === planId && (item.startedAt || item.state === 'completed'));
  if (!started && plan.chargedCost && !plan.refundedAt) { state.coins += plan.chargedCost; plan.refundedAt = now; }
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
    state.production.tasks.push({
      id: stableRuntimeId('production-task'), productionPlanId: plan.id, recipeId: plan.recipeId, batchQuantity,
      state: 'queued', requiredIngredients: {}, reservedIngredients: {}, outputReservations: [], createdAt: now,
    });
    remaining -= batchQuantity;
  }
  state.production.tasks = trimProductionTasks(state.production.tasks);
}

function reserveOutputCapacity(counters: ServiceCounterModule[], recipeId: RecipeId, quantity: number, preferredIds: string[]): { moduleId: string; quantity: number }[] | undefined {
  let compatible = counters.filter((module) => module.assignedRecipeId === recipeId && (!preferredIds.length || preferredIds.includes(module.id)));
  if (!compatible.length && preferredIds.length) compatible = counters.filter((module) => module.assignedRecipeId === recipeId);
  if (!compatible.length) {
    const empty = counters.find((module) => module.currentQuantity === 0 && module.reservedQuantity === 0 && (module.incomingReservedQuantity ?? 0) === 0);
    if (empty) { empty.assignedRecipeId = recipeId; compatible = [empty]; }
  }
  const module = compatible[0];
  if (!module) return undefined;
  module.incomingReservedQuantity = (module.incomingReservedQuantity ?? 0) + quantity;
  return [{ moduleId: module.id, quantity }];
}

function releaseOutputCapacity(counters: ServiceCounterModule[], reservation: readonly { moduleId: string; quantity: number }[]): void {
  for (const part of reservation) {
    const module = counters.find((item) => item.id === part.moduleId);
    if (module) module.incomingReservedQuantity = Math.max(0, (module.incomingReservedQuantity ?? 0) - part.quantity);
  }
}

function sanitizeTask(task: ProductionTask): ProductionTask {
  const obsoleteWaitingState = ['waitingForIngredients', 'waitingForStorage', 'waitingForCounterSpace'].includes(task.state);
  return {
    ...task,
    state: obsoleteWaitingState ? 'queued' : task.state,
    blockedReason: obsoleteWaitingState ? undefined : task.blockedReason,
    batchQuantity: clampQuantity(task.batchQuantity),
    reservedIngredients: task.reservedIngredients ?? {}, outputReservations: task.outputReservations ?? [], currentStepIndex: task.currentStepIndex ?? 0,
  };
}

function trimProductionTasks(tasks: ProductionTask[]): ProductionTask[] {
  const active = tasks.filter((task) => !['completed', 'cancelled', 'failed'].includes(task.state));
  const terminal = tasks.filter((task) => ['completed', 'cancelled', 'failed'].includes(task.state)).slice(-Math.max(0, BALANCE.production.queueHistoryLimit - active.length));
  return [...terminal, ...active];
}

function planPriority(state: Pick<GameState, 'production'>, planId: string): number { return state.production.plans.find((plan) => plan.id === planId)?.priority ?? 0; }
function productionCostFor(state: GameState, recipeId: RecipeId): number { return Math.max(1, Math.round(RECIPE_BY_ID[recipeId].batchCost * (1 - Math.min(.3, state.upgrades.inventory * .05)))); }
function clampQuantity(value: number): number { return Math.max(1, Math.min(BALANCE.production.maximumQuantity, Math.floor(Number(value) || 1))); }
function clampBatch(value: number): number { return Math.max(1, Math.min(BALANCE.production.maximumBatchSize, Math.floor(Number(value) || 1))); }
