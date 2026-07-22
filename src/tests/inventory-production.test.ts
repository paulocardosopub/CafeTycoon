import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { RECIPE_BY_ID } from '../content/recipes/recipes';
import { createDefaultState } from '../game/save/defaultState';
import { canConsumeRecipe, consumeRecipe, inventoryCapacity, inventoryUsed } from '../game/inventory/InventoryService';
import { enqueueProduction, productionDuration, readyDishCapacity, tickProduction } from '../game/cooking/ProductionService';

describe('estoque e receitas', () => {
  it('calcula e consome ingredientes exatamente uma vez', () => {
    const state = createDefaultState();
    const beforeEggs = state.inventory.egg;
    const beforeTomato = state.inventory.tomato;
    const beforeSeasoning = state.inventory.seasoning;
    expect(canConsumeRecipe(state, RECIPE_BY_ID.omelette)).toBe(true);
    expect(consumeRecipe(state, RECIPE_BY_ID.omelette)).not.toBeNull();
    expect(state.inventory.egg).toBe(beforeEggs - 2);
    expect(state.inventory.tomato).toBe(beforeTomato - 1);
    expect(state.inventory.seasoning).toBe(beforeSeasoning - 1);
  });

  it('respeita a capacidade do estoque', () => {
    const state = createDefaultState();
    expect(inventoryUsed(state)).toBeLessThanOrEqual(inventoryCapacity(state));
    state.upgrades.inventory = 2;
    expect(inventoryCapacity(state)).toBe(540);
  });
});

describe('produção programada', () => {
  it('usa movimento e preparo na velocidade 2x', () => {
    const state = createDefaultState();
    expect(BALANCE.movementSpeedMultiplier).toBe(2);
    expect(BALANCE.cookingSpeedMultiplier).toBe(2);
    expect(productionDuration(state, 'coffee')).toBe(4);
  });

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
