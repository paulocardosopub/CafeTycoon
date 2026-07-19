import { BALANCE } from '../../config/balance';
import { INGREDIENTS, INGREDIENT_BY_ID } from '../../content/ingredients/ingredients';
import type { GameState, IngredientId, RecipeDefinition } from '../../core/types';

export function inventoryCapacity(state: GameState): number {
  return BALANCE.inventoryCapacity + state.upgrades.inventory * BALANCE.upgrades.inventory.amount;
}

export function inventoryUsed(state: GameState): number {
  return Object.values(state.inventory).reduce((sum, amount) => sum + amount, 0);
}

export function canConsumeRecipe(state: GameState, recipe: RecipeDefinition, count = 1): boolean {
  return recipe.ingredients.every(({ ingredientId, amount }) => state.inventory[ingredientId] >= amount * count);
}

export function consumeRecipe(state: GameState, recipe: RecipeDefinition, count = 1): Partial<Record<IngredientId, number>> | null {
  if (!canConsumeRecipe(state, recipe, count)) return null;
  const consumed: Partial<Record<IngredientId, number>> = {};
  recipe.ingredients.forEach(({ ingredientId, amount }) => {
    const total = amount * count;
    state.inventory[ingredientId] -= total;
    consumed[ingredientId] = total;
  });
  return consumed;
}

export function buyIngredient(state: GameState, id: IngredientId): { ok: boolean; reason?: string } {
  const ingredient = INGREDIENT_BY_ID[id];
  if (state.coins < ingredient.purchaseCost) return { ok: false, reason: 'Moedas insuficientes.' };
  const personalSpace = ingredient.maxAmount - state.inventory[id];
  const globalSpace = inventoryCapacity(state) - inventoryUsed(state);
  const amount = Math.min(ingredient.purchaseAmount, personalSpace, globalSpace);
  if (amount <= 0) return { ok: false, reason: 'Estoque cheio.' };
  state.coins -= ingredient.purchaseCost;
  state.inventory[id] += amount;
  return { ok: true };
}

export function sanitizeInventory(input: Partial<Record<IngredientId, number>>): Record<IngredientId, number> {
  return Object.fromEntries(INGREDIENTS.map((item) => [item.id, Math.max(0, Math.min(item.maxAmount, Number(input[item.id]) || 0))])) as Record<IngredientId, number>;
}
