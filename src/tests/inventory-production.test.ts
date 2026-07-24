import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { RECIPE_BY_ID, RECIPES } from '../content/recipes/recipes';
import { createDefaultState } from '../game/save/defaultState';
import { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';
import { completeProductionTask, createProductionPlan, prepareNextProductionTask } from '../game/cooking/ProductionPlanningService';
import { createStaffInstance } from '../game/staff/StaffService';
import { STAFF_BY_ID } from '../game/data/staff';
import { modulesFromFurniture } from '../game/systems/service-counter/ServiceCounterSystem';

function productionState() {
  const state = createDefaultState(0);
  state.coins = 10_000;
  state.staff.instances.push(createStaffInstance(STAFF_BY_ID['cook-0'], 0));
  state.construction.placedFurniture.push(
    { id: 'coffee-machine:contract', definitionId: 'cooking.a8.coffee', gridX: 12, gridY: 8, orientation: 'sw', skinId: 'equipment-steel-level-1', level: 1, state: {} },
    { id: 'counter:contract', definitionId: 'service.c1.isolated', gridX: 8, gridY: 6, orientation: 'sw', skinId: 'counter-forest', level: 1, state: {} },
  );
  state.construction.serviceCounters = modulesFromFurniture(state.construction.placedFurniture);
  return state;
}

describe('contrato atual de receitas e lotes', () => {
  it('mantém 52 receitas únicas sem requisitos de despensa', () => {
    expect(RECIPES).toHaveLength(52);
    expect(new Set(RECIPES.map((recipe) => recipe.id)).size).toBe(52);
    expect(RECIPES.every((recipe) => recipe.ingredients.length === 0)).toBe(true);
  });

  it('inicia somente com receita desbloqueada e estação compatível disponível', () => {
    const locked = productionState(); locked.restaurantLevel = 1;
    expect(createProductionPlan(locked, { recipeId: 'chocolate-cookies', targetQuantity: 24 }).ok).toBe(false);

    const incompatible = productionState();
    incompatible.construction.placedFurniture = incompatible.construction.placedFurniture.filter((item) => item.definitionId !== 'cooking.a8.coffee');
    const plan = createProductionPlan(incompatible, { recipeId: 'coffee', targetQuantity: 12 });
    expect(plan.ok).toBe(true);
    expect(prepareNextProductionTask(incompatible, new RestaurantSimulation(incompatible).stations, incompatible.construction.serviceCounters)).toBeUndefined();

    const compatible = productionState();
    const ready = createProductionPlan(compatible, { recipeId: 'coffee', targetQuantity: 12 });
    expect(prepareNextProductionTask(compatible, new RestaurantSimulation(compatible).stations, compatible.construction.serviceCounters)?.task.productionPlanId).toBe(ready.plan?.id);
  });

  it('limita quantidade e lote a 300 unidades', () => {
    expect(BALANCE.production.maximumQuantity).toBe(300);
    expect(BALANCE.production.maximumBatchSize).toBe(300);
    const state = productionState();
    expect(createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 300 }).ok).toBe(true);
    expect(createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 301 })).toMatchObject({ ok: false, reason: expect.stringContaining('300') });
  });

  it('debita o custo oficial uma única vez e não faz débito parcial sem saldo', () => {
    const state = productionState(); const before = state.coins;
    const created = createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 12 });
    expect(created.ok).toBe(true);
    expect(state.coins).toBe(before - RECIPE_BY_ID.coffee.batchCost);
    expect(state.production.plans[0].chargedCost).toBe(RECIPE_BY_ID.coffee.batchCost);

    const poor = productionState(); poor.coins = RECIPE_BY_ID.coffee.batchCost - 1;
    const coins = poor.coins;
    expect(createProductionPlan(poor, { recipeId: 'coffee', targetQuantity: 12 }).ok).toBe(false);
    expect(poor.coins).toBe(coins);
    expect(poor.production.plans).toHaveLength(0);
  });

  it('ocupa a estação, entrega a quantidade correta e agrupa no mesmo balcão', () => {
    const state = productionState(); const simulation = new RestaurantSimulation(state);
    const plan = createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 12 }).plan!;
    const prepared = prepareNextProductionTask(state, simulation.stations, state.construction.serviceCounters)!;
    expect(prepared.station.state).toBe('free');
    expect(completeProductionTask(state, prepared.task.id, state.construction.serviceCounters)).toBe(true);
    const counter = state.construction.serviceCounters[0];
    expect(counter).toMatchObject({ assignedRecipeId: 'coffee', currentQuantity: RECIPE_BY_ID.coffee.batchYield });
    expect(state.production.tasks.find((task) => task.productionPlanId === plan.id)?.completionClaimed).toBe(true);
  });
});
