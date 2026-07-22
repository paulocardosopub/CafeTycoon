import { BALANCE } from '../../config/balance';
import { INGREDIENTS, INGREDIENT_BY_ID } from '../../content/ingredients/ingredients';
import { RECIPE_BY_ID } from '../../content/recipes/recipes';
import type { GameState, IngredientId, RecipeDefinition } from '../../core/types';
import {
  commitStoredIngredient, planStorageAllocation, reconcileStorage, releaseStorageAllocation, removeStoredIngredient,
  reserveStorageAllocation, storageCapacity,
} from './StorageService';

export type PurchaseMode = 'pack' | 'minimum' | 'target';
export interface PurchaseQuote {
  ok: boolean;
  ingredientId: IngredientId;
  amount: number;
  packs: number;
  cost: number;
  finalAmount: number;
  spaceNeeded: number;
  reason?: string;
}

export function inventoryCapacity(state: GameState): number {
  return (state.storage ? storageCapacity(state) : BALANCE.inventoryCapacity) + state.upgrades.inventory * BALANCE.upgrades.inventory.amount;
}

export function inventoryUsed(state: GameState): number {
  return Object.values(state.inventory).reduce((sum, amount) => sum + amount, 0);
}

export function canConsumeRecipe(state: GameState, recipe: RecipeDefinition, count = 1): boolean {
  return recipe.ingredients.every(({ ingredientId, amount }) => availableIngredient(state, ingredientId) >= amount * count);
}

export function consumeRecipe(state: GameState, recipe: RecipeDefinition, count = 1): Partial<Record<IngredientId, number>> | null {
  if (!canConsumeRecipe(state, recipe, count)) return null;
  const consumed: Partial<Record<IngredientId, number>> = {};
  recipe.ingredients.forEach(({ ingredientId, amount }) => {
    const total = amount * count;
    if (state.storage) removeStoredIngredient(state, ingredientId, total);
    state.inventory[ingredientId] -= total;
    consumed[ingredientId] = total;
  });
  return consumed;
}

export function availableIngredient(state: GameState, id: IngredientId): number {
  return Math.max(0, state.inventory[id] - (state.inventoryReserved[id] ?? 0));
}

export function reserveRecipe(state: GameState, recipe: RecipeDefinition, count = 1): Partial<Record<IngredientId, number>> | null {
  if (!canConsumeRecipe(state, recipe, count)) return null;
  const reservation: Partial<Record<IngredientId, number>> = {};
  for (const { ingredientId, amount } of recipe.ingredients) {
    const total = amount * count;
    state.inventoryReserved[ingredientId] += total;
    reservation[ingredientId] = total;
  }
  return reservation;
}

export function consumeReservation(state: GameState, reservation: Partial<Record<IngredientId, number>>): boolean {
  const valid = Object.entries(reservation).every(([rawId, rawAmount]) => {
    const id = rawId as IngredientId; const amount = Math.max(0, Number(rawAmount) || 0);
    return state.inventory[id] >= amount && state.inventoryReserved[id] >= amount;
  });
  if (!valid) return false;
  for (const [rawId, rawAmount] of Object.entries(reservation)) {
    const id = rawId as IngredientId; const amount = Math.max(0, Number(rawAmount) || 0);
    if (state.storage) removeStoredIngredient(state, id, amount);
    state.inventory[id] -= amount;
    state.inventoryReserved[id] -= amount;
  }
  return true;
}

export function releaseReservation(state: GameState, reservation: Partial<Record<IngredientId, number>>): void {
  for (const [rawId, rawAmount] of Object.entries(reservation)) {
    const id = rawId as IngredientId; const amount = Math.max(0, Number(rawAmount) || 0);
    state.inventoryReserved[id] = Math.max(0, state.inventoryReserved[id] - amount);
  }
}

export function buyIngredient(state: GameState, id: IngredientId): { ok: boolean; reason?: string } {
  const result = executePurchase(state, quotePurchase(state, id, 'pack'));
  return result.ok ? { ok: true } : { ok: false, reason: result.reason };
}

export function quotePurchase(state: GameState, id: IngredientId, mode: PurchaseMode): PurchaseQuote {
  if (state.storage && !state.procurement?.requests.some((request) => !['completed', 'cancelled', 'failed', 'blocked'].includes(request.status))) reconcileStorage(state);
  const item = INGREDIENT_BY_ID[id];
  const target = mode === 'pack' ? state.inventory[id] + item.quickBuyPackSize : mode === 'minimum' ? item.reorderPoint : item.targetStock;
  const desired = Math.max(0, target - state.inventory[id]);
  const personalSpace = Math.max(0, item.maxStock - state.inventory[id]);
  const physical = state.storage ? planStorageAllocation(state, id, desired) : undefined;
  const compatibleSpace = physical?.ok ? desired : physical?.allocations.reduce((sum, part) => sum + part.quantity, 0) ?? Number.POSITIVE_INFINITY;
  const globalSpace = Math.max(0, Math.min(inventoryCapacity(state) - inventoryUsed(state), compatibleSpace));
  const packLimited = Math.min(desired, personalSpace, globalSpace);
  const packs = Math.ceil(packLimited / item.quickBuyPackSize);
  const amount = Math.min(packLimited, packs * item.quickBuyPackSize);
  const cost = packs * item.purchasePrice;
  const base: PurchaseQuote = { ok: amount > 0 && cost > 0 && cost <= state.coins, ingredientId: id, amount, packs, cost, finalAmount: state.inventory[id] + amount, spaceNeeded: amount };
  if (desired <= 0) return { ...base, ok: false, reason: 'O estoque já atingiu essa meta.' };
  if (personalSpace <= 0 || globalSpace <= 0 || amount <= 0) return { ...base, ok: false, reason: 'Estoque cheio.' };
  if (cost > state.coins) return { ...base, ok: false, reason: 'Moedas insuficientes.' };
  return base;
}

export function executePurchase(state: GameState, quote: PurchaseQuote): { ok: boolean; reason?: string } {
  if (!quote.ok || quote.amount <= 0 || quote.cost <= 0) return { ok: false, reason: quote.reason ?? 'Compra inválida.' };
  const fresh = quotePurchase(state, quote.ingredientId, quote.packs === 1 ? 'pack' : 'target');
  if (state.coins < quote.cost) return { ok: false, reason: 'Moedas insuficientes.' };
  const item = INGREDIENT_BY_ID[quote.ingredientId];
  const space = Math.min(item.maxStock - state.inventory[quote.ingredientId], inventoryCapacity(state) - inventoryUsed(state));
  if (space < quote.amount) return { ok: false, reason: 'O espaço disponível mudou.' };
  if (fresh.amount <= 0) return { ok: false, reason: fresh.reason ?? 'Compra inválida.' };
  if (state.storage) {
    reconcileStorage(state);
    const allocation = planStorageAllocation(state, quote.ingredientId, quote.amount);
    if (!allocation.ok || !reserveStorageAllocation(state, quote.ingredientId, allocation.allocations)) return { ok: false, reason: allocation.reason ?? 'A capacidade física mudou.' };
    if (!commitStoredIngredient(state, quote.ingredientId, quote.amount, allocation.allocations)) {
      releaseStorageAllocation(state, quote.ingredientId, allocation.allocations);
      return { ok: false, reason: 'A capacidade física mudou.' };
    }
  } else state.inventory[quote.ingredientId] += quote.amount;
  state.coins -= quote.cost;
  return { ok: true };
}

export function ingredientDemand(state: GameState, id: IngredientId): number {
  return state.operation?.orders.reduce((sum, record) => {
    const order = record as { state?: string; recipeId?: keyof typeof RECIPE_BY_ID; quantity?: number };
    if (['cancelled', 'consumed', 'delivered'].includes(order.state ?? '')) return sum;
    const recipe = order.recipeId ? RECIPE_BY_ID[order.recipeId] : undefined;
    const part = recipe?.ingredients.find((entry) => entry.ingredientId === id);
    return sum + (part?.amount ?? 0) * Math.max(1, Number(order.quantity) || 1);
  }, 0) ?? 0;
}

export function sanitizeInventory(input: Partial<Record<IngredientId, number>>): Record<IngredientId, number> {
  return Object.fromEntries(INGREDIENTS.map((item) => [item.id, Math.max(0, Math.min(item.maxAmount, Number(input[item.id]) || 0))])) as Record<IngredientId, number>;
}
