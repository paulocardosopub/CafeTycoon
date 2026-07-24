import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { RECIPES, RECIPE_BY_ID } from '../content/recipes/recipes';
import { createDefaultState } from '../game/save/defaultState';
import { migrateAndSanitizeSave } from '../game/save/migrations';
import { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';
import { createStaffInstance, hireStaff, processPayrollClock } from '../game/staff/StaffService';
import { STAFF_BY_ID } from '../game/data/staff';
import { modulesFromFurniture } from '../game/systems/service-counter/ServiceCounterSystem';
import { TaskManager } from '../game/tasks/TaskManager';
import { calculateOfflineProgress } from '../game/offline/OfflineService';
import {
  cancelProductionPlan, completeProductionTask, createInitialProductionState, createProductionPlan,
  markProductionTaskStarted, pauseProductionPlan, prepareNextProductionTask, sanitizeProductionState,
  transferWaitingProductionOutputs,
} from '../game/cooking/ProductionPlanningService';

function productionState(now = 0) {
  const state = createDefaultState(now);
  state.coins = 10_000;
  state.staff.instances.push(createStaffInstance(STAFF_BY_ID['cook-0'], now));
  state.construction.placedFurniture.push(
    { id: 'machine:coffee', definitionId: 'cooking.a8.coffee', gridX: 12, gridY: 8, orientation: 'sw', skinId: 'equipment-steel-level-1', level: 1, state: {} },
    { id: 'counter:coffee', definitionId: 'service.c1.isolated', gridX: 8, gridY: 6, orientation: 'sw', skinId: 'counter-forest', level: 1, state: {} },
  );
  state.construction.serviceCounters = modulesFromFurniture(state.construction.placedFurniture);
  return state;
}

function preparedCoffee(state = productionState()) {
  const simulation = new RestaurantSimulation(state);
  const plan = createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 12 }).plan!;
  const prepared = prepareNextProductionTask(state, simulation.stations, state.construction.serviceCounters)!;
  return { state, simulation, plan, prepared };
}

describe('0.0.10 · equipe e progresso preservados', () => {
  it('contrata a Barista inicial com saldo e estação compatível', () => {
    const state = productionState(); state.staff.instances = [];
    const before = state.coins;
    const result = hireStaff(state, 'cook-0', undefined, 10);
    expect(result.ok).toBe(true);
    expect(state.coins).toBe(before - STAFF_BY_ID['cook-0'].hiringCost);
    expect(state.staff.instances).toHaveLength(1);
  });

  it('rejeita contratação sem saldo sem criar funcionário', () => {
    const state = productionState(); state.staff.instances = []; state.coins = 0;
    expect(hireStaff(state, 'cook-0', undefined, 10).ok).toBe(false);
    expect(state.staff.instances).toHaveLength(0);
  });

  it('mantém a primeira folha em carência e registra folha elegível uma vez', () => {
    const state = productionState(0); const member = state.staff.instances[0];
    state.coins = 1_000; state.staff.nextPayrollAt = 3_600_000;
    expect(processPayrollClock(state, 3_600_000).charged).toBe(member.salary);
    const after = state.coins;
    expect(processPayrollClock(state, 3_600_000).charged).toBe(0);
    expect(state.coins).toBe(after);
  });
});

describe('0.0.10 · produção sem despensa ou reservas de ingredientes', () => {
  it('mantém exatamente 52 receitas e nenhuma exige ingrediente físico', () => {
    expect(RECIPES).toHaveLength(52);
    expect(new Set(RECIPES.map((recipe) => recipe.id)).size).toBe(52);
    expect(RECIPES.every((recipe) => recipe.ingredients.length === 0)).toBe(true);
  });

  it('cria lote desbloqueado e debita o custo oficial apenas uma vez', () => {
    const state = productionState(); const before = state.coins;
    const result = createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 12 });
    expect(result.ok).toBe(true);
    expect(state.coins).toBe(before - RECIPE_BY_ID.coffee.batchCost);
    expect(result.plan?.chargedCost).toBe(RECIPE_BY_ID.coffee.batchCost);
    expect(sanitizeProductionState(state.production).plans[0].chargedCost).toBe(RECIPE_BY_ID.coffee.batchCost);
  });

  it('rejeita lote sem saldo sem débito parcial', () => {
    const state = productionState(); state.coins = RECIPE_BY_ID.coffee.batchCost - 1;
    const before = state.coins;
    expect(createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 12 }).ok).toBe(false);
    expect(state.coins).toBe(before);
    expect(state.production.plans).toHaveLength(0);
  });

  it('rejeita receita bloqueada e não cria tarefa', () => {
    const state = productionState(); state.restaurantLevel = 1;
    expect(createProductionPlan(state, { recipeId: 'chocolate-cookies', targetQuantity: 24 }).ok).toBe(false);
    expect(state.production.tasks).toHaveLength(0);
  });

  it('aceita 300 e rejeita quantidade inválida ou acima do máximo', () => {
    const state = productionState();
    expect(createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 300 }).ok).toBe(true);
    expect(createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 0 }).ok).toBe(false);
    expect(createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 301 }).ok).toBe(false);
    expect(BALANCE.production.maximumQuantity).toBe(300);
  });

  it('não inicia tarefa em estação incompatível', () => {
    const state = productionState();
    state.construction.placedFurniture = state.construction.placedFurniture.filter((item) => item.id !== 'machine:coffee');
    createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 12 });
    expect(prepareNextProductionTask(state, new RestaurantSimulation(state).stations, state.construction.serviceCounters)).toBeUndefined();
  });

  it('reserva a estação concreta, não ingredientes, durante a preparação', () => {
    const { state, prepared } = preparedCoffee();
    expect(prepared.task).toMatchObject({ state: 'reserved', reservedIngredients: {}, workstationId: prepared.station.id });
    expect(prepared.task.workSlotId).toContain(':primary');
    expect(markProductionTaskStarted(state, prepared.task.id, state.staff.instances[0].id, 1)).toBe(true);
    expect(prepared.task.state).toBe('cooking');
  });

  it('entrega o lote correto, agrupa no balcão e ignora callback duplicado', () => {
    const { state, prepared } = preparedCoffee();
    expect(completeProductionTask(state, prepared.task.id, state.construction.serviceCounters, 2)).toBe(true);
    expect(state.construction.serviceCounters[0]).toMatchObject({ assignedRecipeId: 'coffee', currentQuantity: RECIPE_BY_ID.coffee.batchYield });
    const coins = state.coins; const dishes = state.stats.dishesProduced;
    expect(completeProductionTask(state, prepared.task.id, state.construction.serviceCounters, 3)).toBe(false);
    expect(state.coins).toBe(coins); expect(state.stats.dishesProduced).toBe(dishes);
  });

  it('mantém lote pronto na estação até existir balcão e transfere uma vez', () => {
    const state = productionState();
    state.construction.placedFurniture = state.construction.placedFurniture.filter((item) => item.id !== 'counter:coffee');
    state.construction.serviceCounters = [];
    const simulation = new RestaurantSimulation(state);
    createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 12 });
    const prepared = prepareNextProductionTask(state, simulation.stations, [])!;
    expect(completeProductionTask(state, prepared.task.id, [], 2)).toBe(false);
    expect(prepared.task.state).toBe('waitingForCounterSpace');
    state.construction.placedFurniture.push({ id: 'counter:later', definitionId: 'service.c1.isolated', gridX: 8, gridY: 6, orientation: 'sw', skinId: 'counter-forest', level: 1, state: {} });
    const counters = modulesFromFurniture(state.construction.placedFurniture);
    expect(transferWaitingProductionOutputs(state, counters, 3)).toEqual([prepared.task.id]);
    expect(counters[0].currentQuantity).toBe(RECIPE_BY_ID.coffee.batchYield);
  });

  it('pausa e cancela lote antes de iniciar, devolvendo somente o custo do lote', () => {
    const state = productionState(); const before = state.coins;
    const plan = createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 12 }).plan!;
    expect(pauseProductionPlan(state, plan.id, false)).toBe(true); expect(plan.enabled).toBe(false);
    expect(cancelProductionPlan(state, plan.id, state.construction.serviceCounters, 5)).toBe(true);
    expect(state.coins).toBe(before);
    expect(state.production.tasks[0].state).toBe('cancelled');
  });

  it('preserva lote parcial no save sem nova cobrança nem duplicação', () => {
    const { state, plan, prepared } = preparedCoffee();
    markProductionTaskStarted(state, prepared.task.id, state.staff.instances[0].id, 10);
    const coins = state.coins;
    const restored = migrateAndSanitizeSave(JSON.parse(JSON.stringify(state)), 20);
    expect(restored.coins).toBe(coins);
    expect(restored.production.plans.find((item) => item.id === plan.id)?.chargedCost).toBe(plan.chargedCost);
    expect(restored.production.tasks).toHaveLength(1);
    expect(migrateAndSanitizeSave(JSON.parse(JSON.stringify(restored)), 30).production.tasks).toEqual(restored.production.tasks);
  });

  it('normaliza espera legada por ingredientes para fila econômica atual', () => {
    const production = createInitialProductionState();
    production.plans.push({ id: 'legacy-plan', recipeId: 'coffee', mode: 'singleBatch', targetQuantity: 1, batchSize: 1, priority: 1, preferredEquipmentIds: [], preferredCounterIds: [], enabled: true, repeat: false, currentProgress: 0, createdAt: 0 });
    production.tasks.push({ id: 'legacy-task', productionPlanId: 'legacy-plan', recipeId: 'coffee', batchQuantity: 1, state: 'waitingForIngredients', requiredIngredients: { coffee: 1 }, reservedIngredients: { coffee: 1 }, outputReservations: [], createdAt: 0 });
    expect(sanitizeProductionState(production).tasks[0]).toMatchObject({ state: 'queued', reservedIngredients: {} });
  });
});

describe('0.0.10 · coordenação, clientes e migração', () => {
  it('prioriza pedido de cliente sobre lote preventivo', () => {
    const manager = new TaskManager();
    manager.add({ key: 'batch', kind: 'production_batch', role: 'kitchen', target: { x: 1, y: 1 }, duration: 1, priority: 40, payload: {} });
    manager.add({ key: 'order', kind: 'cook_step', role: 'kitchen', target: { x: 2, y: 2 }, duration: 1, priority: 100, payload: {} });
    expect(manager.claim('cook', ['kitchen'])?.kind).toBe('cook_step');
  });

  it('recupera reserva de tarefa vencida', () => {
    const manager = new TaskManager(); const task = manager.add({ key: 'blocked', kind: 'clean', role: 'cleaning', target: { x: 1, y: 1 }, duration: 1, priority: 1, payload: {} });
    manager.claim('cleaner', ['cleaning']); manager.release(task.id, 'cleaner', 'rota'); manager.tick(30);
    expect(manager.releaseStaleReservations(20)).toHaveLength(1); expect(task.status).toBe('pending');
  });

  it('mantém clientes individuais e campos de grupos fora do runtime', () => {
    const simulation = new RestaurantSimulation(createDefaultState(0)); simulation.debugSetAutoSpawn(false);
    const first = simulation.debugAddCustomer()!; const second = simulation.debugAddCustomer()!;
    expect(first.id).not.toBe(second.id);
    expect('partyId' in first).toBe(false); expect('partySize' in first).toBe(false);
  });

  it('limita progresso offline a oito horas', () => {
    const now = 1_800_000_000_000; const state = createDefaultState(now - 12 * 3_600_000);
    expect(calculateOfflineProgress(state, now).calculatedSeconds).toBe(8 * 3_600);
  });

  it('migra save antigo sem perder moedas, equipe ou lote atual', () => {
    const { state } = preparedCoffee(); state.coins = 777;
    const migrated = migrateAndSanitizeSave(JSON.parse(JSON.stringify(state)), 200);
    expect(migrated.coins).toBe(777); expect(migrated.staff.instances).toHaveLength(1); expect(migrated.production.tasks).toHaveLength(1);
  });
});
