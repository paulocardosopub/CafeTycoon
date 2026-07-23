import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../game/save/defaultState';
import { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';
import {
  completeProductionTask,
  createProductionPlan,
  markProductionTaskStarted,
  prepareNextProductionTask,
  sanitizeProductionState,
  setRecipeRepeat,
  transferWaitingProductionOutputs,
} from '../game/cooking/ProductionPlanningService';
import { modulesFromFurniture } from '../game/systems/service-counter/ServiceCounterSystem';
import { createStaffInstance } from '../game/staff/StaffService';
import { STAFF_BY_ID } from '../game/data/staff';
import { RECIPE_BY_ID } from '../content/recipes/recipes';

describe('produção 0.0.8 sem ingredientes e sem limite de balcão', () => {
  it('preserva lotes prontos que aguardam balcão', () => {
    const state = createDefaultState(0);
    state.production.plans.push({ id: 'plan', recipeId: 'coffee', mode: 'singleBatch', targetQuantity: 6, batchSize: 6, priority: 50, preferredEquipmentIds: [], preferredCounterIds: [], enabled: true, repeat: false, currentProgress: 0, createdAt: 0 });
    state.production.tasks.push({ id: 'task', productionPlanId: 'plan', recipeId: 'coffee', batchQuantity: 6, state: 'waitingForCounterSpace', requiredIngredients: {}, reservedIngredients: {}, outputReservations: [], createdAt: 0, blockedReason: 'legado' });
    const sanitized = sanitizeProductionState(state.production);
    expect(sanitized.tasks[0].state).toBe('waitingForCounterSpace');
    expect(sanitized.tasks[0].blockedReason).toBe('legado');
  });

  it('Forneiro começa no forno sem balcão e transfere o lote quando um fica livre', () => {
    const state = createDefaultState(0); state.coins = 10_000; state.restaurantLevel = 5;
    state.staff.instances.push(createStaffInstance(STAFF_BY_ID['cook-1'], 0));
    state.construction.placedFurniture.push({ id: 'oven:test', definitionId: 'cooking.a2.convection', gridX: 12, gridY: 8, orientation: 'sw', skinId: 'equipment-steel-level-1', level: 1, state: {} });
    const simulation = new RestaurantSimulation(state);
    const plan = createProductionPlan(state, { recipeId: 'chocolate-cookies', targetQuantity: 24 }, 1);
    expect(plan.ok).toBe(true);
    const prepared = prepareNextProductionTask(state, simulation.stations, [], 2);
    expect(prepared?.station.id.startsWith('oven')).toBe(true);
    expect(prepared?.task.outputReservations).toEqual([]);
    expect(markProductionTaskStarted(state, prepared!.task.id, state.staff.instances.at(-1)!.id, 3)).toBe(true);
    expect(completeProductionTask(state, prepared!.task.id, [], 4)).toBe(false);
    expect(prepared!.task.state).toBe('waitingForCounterSpace');

    state.construction.placedFurniture.push({ id: 'counter:later', definitionId: 'service.c1.isolated', gridX: 8, gridY: 6, orientation: 'sw', skinId: 'counter-forest', level: 1, state: {} });
    const counters = modulesFromFurniture(state.construction.placedFurniture);
    expect(transferWaitingProductionOutputs(state, counters, 5)).toEqual([prepared!.task.id]);
    expect(counters[0]).toMatchObject({ assignedRecipeId: 'chocolate-cookies', currentQuantity: 24 });
    expect(prepared!.task.state).toBe('completed');
  });

  it('acumula cinco lotes de café no mesmo balcão apesar do limite legado', () => {
    const state = createDefaultState(0);
    state.coins = 100_000;
    state.staff.instances.push(createStaffInstance(STAFF_BY_ID['cook-0'], 0));
    state.construction.placedFurniture.push({ id: 'coffee-machine:test', definitionId: 'cooking.a8.coffee', gridX: 12, gridY: 8, orientation: 'sw', skinId: 'equipment-steel-level-1', level: 1, state: {} });
    state.construction.placedFurniture.push({ id: 'counter:test', definitionId: 'service.c1.isolated', gridX: 8, gridY: 6, orientation: 'sw', skinId: 'counter-forest', level: 1, state: {} });
    state.construction.serviceCounters = modulesFromFurniture(state.construction.placedFurniture);
    const counter = state.construction.serviceCounters[0];
    counter.maxCapacity = 12;
    counter.assignedRecipeId = 'coffee';
    const simulation = new RestaurantSimulation(state);
    expect(counter.maxCapacity).toBe(Number.MAX_SAFE_INTEGER);

    for (let index = 0; index < 5; index += 1) {
      expect(createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 1 }).ok).toBe(true);
      const prepared = prepareNextProductionTask(state, simulation.stations, state.construction.serviceCounters, index + 1);
      expect(prepared).toBeDefined();
      expect(completeProductionTask(state, prepared!.task.id, state.construction.serviceCounters, index + 2)).toBe(true);
    }

    expect(counter.currentQuantity).toBeGreaterThan(2 * 6);
    expect(new Set(state.production.tasks.map((task) => task.outputCounterId))).toEqual(new Set([counter.id]));
  });

  it('cancelar lote libera funcionário, timer e estação', () => {
    const state = createDefaultState(0); state.coins = 10_000;
    state.staff.instances.push(createStaffInstance(STAFF_BY_ID['cook-0'], 0));
    state.construction.placedFurniture.push({ id: 'coffee-machine:cancel', definitionId: 'cooking.a8.coffee', gridX: 12, gridY: 8, orientation: 'sw', skinId: 'equipment-steel-level-1', level: 1, state: {} });
    state.construction.staffStartPositions.push({ staffId: 'cook-0', linkedFurnitureId: 'coffee-machine:cancel', gridX: 12, gridY: 9, facing: 'ne', returnWhenIdle: true });
    const simulation = new RestaurantSimulation(state);
    const plan = createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 12 }).plan!;
    const productionTask = state.production.tasks[0];
    const station = simulation.stations.find((item) => item.id.startsWith('coffee_machine'))!;
    const runtime = simulation.tasks.add({ key: 'cancel-test', kind: 'production_batch', role: 'kitchen', target: station.interaction, duration: 30, priority: 100, payload: { productionPlanId: plan.id, productionTaskId: productionTask.id, stationId: station.id } });
    const actor = simulation.actors.find((item) => item.kind === 'cook')!;
    actor.taskId = runtime.id; actor.taskRemaining = 30; station.state = 'in_use'; station.workerId = actor.id; station.remaining = 30;
    expect(simulation.cancelProduction(plan.id)).toBe(true);
    expect(actor.taskId).toBeUndefined(); expect(actor.taskRemaining).toBe(0); expect(station.state).toBe('free'); expect(station.remaining).toBe(0); expect(simulation.tasks.list()).toHaveLength(0);
  });

  it('repete uma receita após a entrega e para depois que o jogador desmarca', () => {
    const state = createDefaultState(0); state.coins = 10_000;
    state.staff.instances.push(createStaffInstance(STAFF_BY_ID['cook-0'], 0));
    state.construction.placedFurniture.push({ id: 'coffee-machine:repeat', definitionId: 'cooking.a8.coffee', gridX: 12, gridY: 8, orientation: 'sw', skinId: 'equipment-steel-level-1', level: 1, state: {} });
    state.construction.placedFurniture.push({ id: 'counter:repeat', definitionId: 'service.c1.isolated', gridX: 8, gridY: 6, orientation: 'sw', skinId: 'counter-forest', level: 1, state: {} });
    state.construction.serviceCounters = modulesFromFurniture(state.construction.placedFurniture);
    const simulation = new RestaurantSimulation(state);
    const before = state.coins;
    expect(setRecipeRepeat(state, 'coffee', true, 1).ok).toBe(true);
    const first = prepareNextProductionTask(state, simulation.stations, state.construction.serviceCounters, 2)!;
    expect(completeProductionTask(state, first.task.id, state.construction.serviceCounters, 3)).toBe(true);
    expect(state.production.tasks.filter((task) => !['completed', 'cancelled', 'failed'].includes(task.state))).toHaveLength(1);
    expect(state.coins).toBe(before - 2 * RECIPE_BY_ID.coffee.batchCost);
    expect(setRecipeRepeat(state, 'coffee', false, 4).ok).toBe(true);
    const second = prepareNextProductionTask(state, simulation.stations, state.construction.serviceCounters, 5)!;
    expect(completeProductionTask(state, second.task.id, state.construction.serviceCounters, 6)).toBe(true);
    expect(state.production.tasks.filter((task) => !['completed', 'cancelled', 'failed'].includes(task.state))).toHaveLength(0);
  });
});
