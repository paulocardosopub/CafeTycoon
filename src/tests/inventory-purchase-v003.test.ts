import { describe, expect, it } from 'vitest';
import { RECIPE_BY_ID } from '../content/recipes/recipes';
import { createDefaultState } from '../game/save/defaultState';
import { availableIngredient, consumeReservation, executePurchase, quotePurchase, releaseReservation, reserveRecipe } from '../game/inventory/InventoryService';
import { INGREDIENTS, INGREDIENT_BY_ID } from '../content/ingredients/ingredients';
import { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';

describe('reservas e compra rápida', () => {
  it('reserva, consome e libera ingredientes exatamente uma vez', () => {
    const state = createDefaultState(); const before = state.inventory.egg;
    const reservation = reserveRecipe(state, RECIPE_BY_ID.omelette)!;
    expect(availableIngredient(state, 'egg')).toBe(before - 2);
    expect(consumeReservation(state, reservation)).toBe(true);
    expect(state.inventory.egg).toBe(before - 2);
    expect(state.inventoryReserved.egg).toBe(0);
    expect(consumeReservation(state, reservation)).toBe(false);
    releaseReservation(state, reservation);
    expect(state.inventoryReserved.egg).toBe(0);
  });

  it('calcula custo, quantidade final e impede falta de moedas ou espaço', () => {
    const state = createDefaultState(); state.inventory.beef = 0;
    const quote = quotePurchase(state, 'beef', 'target');
    expect(quote.ok).toBe(true); expect(quote.amount).toBeGreaterThan(0); expect(quote.finalAmount).toBe(quote.amount);
    const coins = state.coins; expect(executePurchase(state, quote).ok).toBe(true); expect(state.coins).toBe(coins - quote.cost);
    state.coins = 0; expect(quotePurchase(state, 'beef', 'pack').ok).toBe(false);
    state.coins = 999; state.inventory.beef = INGREDIENT_BY_ID.beef.maxStock; expect(quotePurchase(state, 'beef', 'pack').reason).toContain('cheio');
  });

  it('impede confirmar duas vezes a mesma reposição', () => {
    const state = createDefaultState(); state.inventory.beef = 0;
    const quote = quotePurchase(state, 'beef', 'target');
    expect(executePurchase(state, quote).ok).toBe(true);
    const inventoryAfterFirst = state.inventory.beef; const coinsAfterFirst = state.coins;
    expect(executePurchase(state, quote).ok).toBe(false);
    expect(state.inventory.beef).toBe(inventoryAfterFirst);
    expect(state.coins).toBe(coinsAfterFirst);
  });

  it('mantém a compra do estoquista manual na 0.0.5', () => {
    const state = createDefaultState(0);
    for (const ingredient of INGREDIENTS) state.inventory[ingredient.id] = 0;
    state.coins = 1_000;
    const inventoryBefore = { ...state.inventory };
    const coinsBefore = state.coins;
    const simulation = new RestaurantSimulation(state);
    simulation.debugSetAutoSpawn(false);

    simulation.debugRunFor(60);

    expect(state.inventory).toEqual(inventoryBefore);
    expect(state.coins).toBe(coinsBefore);
  });

  it('retoma pedido bloqueado depois da reposição', () => {
    const state = createDefaultState(0);
    for (const ingredient of INGREDIENTS) state.inventory[ingredient.id] = 0;
    const simulation = new RestaurantSimulation(state); simulation.debugSetAutoSpawn(false);
    simulation.debugAddCustomer(); simulation.debugRunFor(30);
    expect(simulation.orders.some((order) => order.state === 'awaiting_ingredients')).toBe(true);
    for (const ingredient of INGREDIENTS) state.inventory[ingredient.id] = ingredient.maxStock;
    simulation.retryBlockedOrders(); simulation.debugRunFor(180);
    expect(state.stats.customersServed).toBe(1);
  });
});
