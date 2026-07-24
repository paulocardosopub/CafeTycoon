import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { RECIPE_BY_ID, RECIPES } from '../content/recipes/recipes';
import type { GameState } from '../core/types';
import {
  completeProductionTask, createProductionPlan, markProductionTaskStarted, prepareNextProductionTask,
} from '../game/cooking/ProductionPlanningService';
import { STAFF_BY_ID } from '../game/data/staff';
import { calculateOfflineProgress } from '../game/offline/OfflineService';
import { createDefaultState } from '../game/save/defaultState';
import { migrateAndSanitizeSave } from '../game/save/migrations';
import { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';
import { createStaffInstance, hireStaff } from '../game/staff/StaffService';
import { modulesFromFurniture } from '../game/systems/service-counter/ServiceCounterSystem';
import { TaskManager } from '../game/tasks/TaskManager';

function productionState(now = 0): GameState {
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

function reserveCoffee(state: GameState) {
  const simulation = new RestaurantSimulation(state);
  const plan = createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 12 }).plan!;
  const prepared = prepareNextProductionTask(state, simulation.stations, state.construction.serviceCounters)!;
  return { plan, prepared, simulation };
}

describe('fluxos integrados da v0.0.10', () => {
  it('FLUXO A · contrata a Barista inicial e a materializa na estação compatível', () => {
    const state = productionState(10);
    state.staff.instances = [];
    const before = state.coins;
    const hired = hireStaff(state, 'cook-0', undefined, 10);
    expect(hired.ok).toBe(true);
    expect(state.coins).toBe(before - STAFF_BY_ID['cook-0'].hiringCost);
    expect(state.construction.staffStartPositions.at(-1)).toMatchObject({ linkedFurnitureId: 'machine:coffee' });
    expect(new RestaurantSimulation(state).actors.find((actor) => actor.id === hired.instance!.id)?.position).toEqual(hired.instance!.startPosition);
  });

  it('FLUXO B · debita diretamente o custo oficial e cria um único lote sem ingredientes', () => {
    const state = productionState();
    const before = state.coins;
    const created = createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 12 });
    expect(created.ok).toBe(true);
    expect(state.coins).toBe(before - RECIPE_BY_ID.coffee.batchCost);
    expect(created.plan).toMatchObject({ chargedCost: RECIPE_BY_ID.coffee.batchCost, targetQuantity: RECIPE_BY_ID.coffee.batchYield });
    expect(state.production.tasks).toHaveLength(1);
    expect(state.production.tasks[0]).toMatchObject({ recipeId: 'coffee', reservedIngredients: {}, batchQuantity: RECIPE_BY_ID.coffee.batchYield });
    expect(Object.keys(state.inventory)).toHaveLength(0);
  });

  it('FLUXO C · rejeita saldo insuficiente de forma atômica', () => {
    const state = productionState();
    state.coins = RECIPE_BY_ID.coffee.batchCost - 1;
    const before = state.coins;
    const rejected = createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 12 });
    expect(rejected.ok).toBe(false);
    expect(state.coins).toBe(before);
    expect(state.production.plans).toHaveLength(0);
    expect(state.production.tasks).toHaveLength(0);
  });

  it('FLUXO D · aceita o limite de 300 e rejeita quantidade acima dele', () => {
    const state = productionState();
    const accepted = createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 300 });
    expect(accepted.ok).toBe(true);
    expect(accepted.plan?.chargedCost).toBe(RECIPE_BY_ID.coffee.batchCost);
    expect(createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 301 })).toMatchObject({ ok: false, reason: expect.stringContaining('300') });
    expect(BALANCE.production.maximumQuantity).toBe(300);
  });

  it('FLUXO E · reserva estação compatível e produz sem despensa física', () => {
    const state = productionState();
    expect(state.construction.placedFurniture.some((item) => item.definitionId === 'storage.c5.pantry')).toBe(false);
    const { prepared } = reserveCoffee(state);
    expect(prepared.task).toMatchObject({ state: 'reserved', workstationId: prepared.station.id, reservedIngredients: {} });
    expect(prepared.task.workSlotId).toContain(':primary');
    expect(markProductionTaskStarted(state, prepared.task.id, state.staff.instances[0].id, 1)).toBe(true);
    expect(prepared.task.state).toBe('cooking');
  });

  it('FLUXO F · entrega, agrupa no balcão e torna o callback idempotente', () => {
    const state = productionState();
    const first = reserveCoffee(state);
    expect(completeProductionTask(state, first.prepared.task.id, state.construction.serviceCounters, 2)).toBe(true);
    const second = reserveCoffee(state);
    expect(completeProductionTask(state, second.prepared.task.id, state.construction.serviceCounters, 3)).toBe(true);
    expect(state.construction.serviceCounters[0]).toMatchObject({ assignedRecipeId: 'coffee', currentQuantity: RECIPE_BY_ID.coffee.batchYield * 2 });
    const coins = state.coins;
    const dishes = state.stats.dishesProduced;
    expect(completeProductionTask(state, second.prepared.task.id, state.construction.serviceCounters, 4)).toBe(false);
    expect(state.coins).toBe(coins);
    expect(state.stats.dishesProduced).toBe(dishes);
  });

  it('FLUXO G · preserva prioridade e processamento offline sem duplicar produção ou débito', () => {
    const manager = new TaskManager();
    manager.add({ key: 'batch', kind: 'production_batch', role: 'kitchen', target: { x: 1, y: 1 }, duration: 1, priority: 40, payload: {} });
    manager.add({ key: 'order', kind: 'cook_step', role: 'kitchen', target: { x: 2, y: 2 }, duration: 1, priority: 100, payload: {} });
    expect(manager.claim('cook', ['kitchen'])?.kind).toBe('cook_step');

    const now = 1_800_000_000_000;
    const state = productionState(now - 10 * 3_600_000);
    createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 12 });
    const afterPlanning = state.coins;
    const first = calculateOfflineProgress(state, now);
    const afterFirst = state.coins;
    const second = calculateOfflineProgress(state, now);
    expect(first.calculatedSeconds).toBe(8 * 3_600);
    expect(first.produced.coffee).toBe(RECIPE_BY_ID.coffee.batchYield);
    expect(afterFirst).toBeLessThanOrEqual(afterPlanning + first.grossRevenue);
    expect(second.calculatedSeconds).toBe(0);
    expect(state.coins).toBe(afterFirst);
  });

  it('FLUXO H · salva e recarrega lote parcial sem cobrança nova, grupos ou duplicação', () => {
    const state = productionState(100);
    const { plan, prepared } = reserveCoffee(state);
    expect(markProductionTaskStarted(state, prepared.task.id, state.staff.instances[0].id, 110)).toBe(true);
    const coins = state.coins;
    const migrated = migrateAndSanitizeSave(JSON.parse(JSON.stringify(state)), 200);
    const reloaded = migrateAndSanitizeSave(JSON.parse(JSON.stringify(migrated)), 300);
    expect(reloaded.coins).toBe(coins);
    expect(reloaded.production.plans.find((item) => item.id === plan.id)?.chargedCost).toBe(plan.chargedCost);
    expect(reloaded.production.tasks).toEqual(migrated.production.tasks);
    expect(RECIPES).toHaveLength(52);
    const simulation = new RestaurantSimulation(reloaded);
    simulation.debugSetAutoSpawn(false);
    const customer = simulation.debugAddCustomer()!;
    expect('partyId' in customer).toBe(false);
    expect('partySize' in customer).toBe(false);
  });
});
