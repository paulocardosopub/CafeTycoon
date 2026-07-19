import { describe, expect, it } from 'vitest';
import { RECIPE_BY_ID } from '../content/recipes/recipes';
import { createDefaultState } from '../game/save/defaultState';
import { canConsumeRecipe, consumeRecipe, inventoryCapacity, inventoryUsed } from '../game/inventory/InventoryService';
import { enqueueProduction, readyDishCapacity, tickProduction } from '../game/cooking/ProductionService';

describe('estoque e receitas', () => {
  it('calcula e consome ingredientes exatamente uma vez', () => {
    const state = createDefaultState();
    const beforeEggs = state.inventory.egg;
    expect(canConsumeRecipe(state, RECIPE_BY_ID.omelette)).toBe(true);
    expect(consumeRecipe(state, RECIPE_BY_ID.omelette)).not.toBeNull();
    expect(state.inventory.egg).toBe(beforeEggs - 2);
    expect(state.inventory.tomato).toBe(9);
    expect(state.inventory.seasoning).toBe(13);
  });

  it('respeita a capacidade do estoque', () => {
    const state = createDefaultState();
    expect(inventoryUsed(state)).toBeLessThanOrEqual(inventoryCapacity(state));
    state.upgrades.inventory = 2;
    expect(inventoryCapacity(state)).toBe(150);
  });
});

describe('produção programada', () => {
  it('produz prato, consome ingredientes e concede experiência', () => {
    const state = createDefaultState();
    const coffeeBefore = state.inventory.coffee;
    enqueueProduction(state, 'coffee', 1);
    const result = tickProduction(state, 10);
    expect(result.produced.coffee).toBe(1);
    expect(state.inventory.coffee).toBe(coffeeBefore - 1);
    expect(state.readyDishes.coffee).toBe(3);
    expect(state.restaurantXp).toBe(RECIPE_BY_ID.coffee.experience);
  });

  it('bloqueia sem ingredientes', () => {
    const state = createDefaultState();
    state.inventory.coffee = 0;
    enqueueProduction(state, 'coffee', 1);
    const result = tickProduction(state, 10);
    expect(result.blocked).toContain('Ingredientes');
    expect(state.productionQueue[0].status).toBe('blocked_ingredients');
  });

  it('bloqueia quando o armazenamento de pratos está cheio', () => {
    const state = createDefaultState();
    state.readyDishes.coffee = readyDishCapacity(state);
    const coffeeBefore = state.inventory.coffee;
    enqueueProduction(state, 'coffee', 1);
    const result = tickProduction(state, 10);
    expect(result.blocked).toContain('cheio');
    expect(state.inventory.coffee).toBe(coffeeBefore);
    expect(state.productionQueue[0].status).toBe('blocked_storage');
  });
});
