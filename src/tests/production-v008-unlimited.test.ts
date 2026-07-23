import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../game/save/defaultState';
import { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';
import {
  completeProductionTask,
  createProductionPlan,
  prepareNextProductionTask,
  sanitizeProductionState,
} from '../game/cooking/ProductionPlanningService';
import { modulesFromFurniture } from '../game/systems/service-counter/ServiceCounterSystem';
import { createStaffInstance } from '../game/staff/StaffService';
import { STAFF_BY_ID } from '../game/data/staff';

describe('produção 0.0.8 sem ingredientes e sem limite de balcão', () => {
  it('migra esperas obsoletas para a fila normal', () => {
    const state = createDefaultState(0);
    state.production.plans.push({ id: 'plan', recipeId: 'coffee', mode: 'singleBatch', targetQuantity: 6, batchSize: 6, priority: 50, preferredEquipmentIds: [], preferredCounterIds: [], enabled: true, repeat: false, currentProgress: 0, createdAt: 0 });
    state.production.tasks.push({ id: 'task', productionPlanId: 'plan', recipeId: 'coffee', batchQuantity: 6, state: 'waitingForCounterSpace', requiredIngredients: {}, reservedIngredients: {}, outputReservations: [], createdAt: 0, blockedReason: 'legado' });
    const sanitized = sanitizeProductionState(state.production);
    expect(sanitized.tasks[0].state).toBe('queued');
    expect(sanitized.tasks[0].blockedReason).toBeUndefined();
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
});
