import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../game/save/defaultState';
import { migrateAndSanitizeSave } from '../game/save/migrations';
import { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';
import { createProductionPlan, sanitizeProductionState } from '../game/cooking/ProductionPlanningService';
import { createStaffInstance } from '../game/staff/StaffService';
import { STAFF_BY_ID } from '../game/data/staff';
import { RECIPE_BY_ID } from '../content/recipes/recipes';

describe('produção sem compras de ingredientes', () => {
  it('preserva lote parcial no save sem nova cobrança ou duplicação', () => {
    const state = createDefaultState(0); state.coins = 1000;
    state.staff.instances.push(createStaffInstance(STAFF_BY_ID['cook-0'], 0));
    const before = state.coins;
    const plan = createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 12 }).plan!;
    state.production.tasks[0].state = 'cooking'; state.production.tasks[0].startedAt = 10; state.production.tasks[0].endsAt = 25;
    const restored = migrateAndSanitizeSave(JSON.parse(JSON.stringify(state)), 20);
    expect(restored.coins).toBe(before - RECIPE_BY_ID.coffee.batchCost);
    expect(restored.production.plans.find((item) => item.id === plan.id)?.chargedCost).toBe(RECIPE_BY_ID.coffee.batchCost);
    expect(restored.production.tasks).toHaveLength(1);
    const reloaded = migrateAndSanitizeSave(JSON.parse(JSON.stringify(restored)), 30);
    expect(reloaded.coins).toBe(restored.coins);
    expect(reloaded.production.tasks).toEqual(restored.production.tasks);
  });

  it('normaliza estados legados de despensa sem criar bloqueio físico', () => {
    const state = createDefaultState(0);
    state.production.tasks.push({ id: 'legacy', productionPlanId: 'missing', recipeId: 'coffee', batchQuantity: 1, state: 'waitingForIngredients', requiredIngredients: { coffee: 1 }, reservedIngredients: { coffee: 1 }, outputReservations: [], createdAt: 0 });
    const sanitized = sanitizeProductionState({ ...state.production, plans: [{ id: 'missing', recipeId: 'coffee', mode: 'singleBatch', targetQuantity: 1, batchSize: 1, priority: 1, preferredEquipmentIds: [], preferredCounterIds: [], enabled: true, repeat: false, currentProgress: 0, createdAt: 0 }] });
    expect(sanitized.tasks[0]).toMatchObject({ state: 'queued', reservedIngredients: {} });
  });

  it('mantém tutorial atual e clientes individuais sem estoque físico', () => {
    const simulation = new RestaurantSimulation(createDefaultState(0));
    simulation.debugSetAutoSpawn(false);
    const first = simulation.debugAddCustomer()!;
    const second = simulation.debugAddCustomer()!;
    expect(first.id).not.toBe(second.id);
    expect(first.chairIds).toEqual([]);
    expect(second.chairIds).toEqual([]);
    expect(Object.values(simulation.state.inventory).every((value) => value === 0)).toBe(true);
  });
});
