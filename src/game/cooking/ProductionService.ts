import { BALANCE } from '../../config/balance';
import { RECIPE_BY_ID } from '../../content/recipes/recipes';
import type { GameState, ProductionQueueItem, RecipeId } from '../../core/types';
import { stableRuntimeId } from '../../core/id';
import { consumeRecipe } from '../inventory/InventoryService';

export function readyDishCapacity(state: GameState): number {
  return BALANCE.readyDishCapacity + state.upgrades.dishStorage * BALANCE.upgrades.dishStorage.amount;
}

export function readyDishUsed(state: GameState): number {
  return Object.entries(state.readyDishes).reduce((sum, [recipeId, amount]) => sum + amount * RECIPE_BY_ID[recipeId as RecipeId].storageSpace, 0);
}

export function enqueueProduction(state: GameState, recipeId: RecipeId, quantity: number): ProductionQueueItem {
  const item: ProductionQueueItem = {
    id: stableRuntimeId('production'), recipeId, quantity: Math.max(1, Math.min(BALANCE.production.maximumQuantity, Math.floor(quantity))),
    completed: 0, progressSeconds: 0, status: 'queued', ingredientsCommitted: false,
  };
  state.productionQueue.push(item);
  return item;
}

export function productionDuration(state: GameState, recipeId: RecipeId): number {
  const recipe = RECIPE_BY_ID[recipeId];
  const base = recipe.steps.reduce((total, step) => total + step.duration, 0);
  const stationBonus = state.upgrades.stationSpeed * BALANCE.upgrades.stationSpeed.amount;
  const professionLevel = state.profile?.professions.cook.level ?? 1;
  const playerBonus = state.profile?.helpRole === 'kitchen' ? (professionLevel - 1) * BALANCE.professionSpeedPerLevel : 0;
  return base * Math.max(0.55, 1 - stationBonus - playerBonus) / BALANCE.cookingSpeedMultiplier;
}

export interface ProductionTickResult { produced: Partial<Record<RecipeId, number>>; blocked?: string }

export function tickProduction(state: GameState, deltaSeconds: number): ProductionTickResult {
  const result: ProductionTickResult = { produced: {} };
  let remainingDelta = Math.max(0, Math.min(deltaSeconds, 10));
  while (remainingDelta > 0 && state.productionQueue.length) {
    const item = state.productionQueue[0];
    const recipe = RECIPE_BY_ID[item.recipeId];
    if (!item.ingredientsCommitted) {
      if (readyDishUsed(state) + recipe.storageSpace * recipe.yield > readyDishCapacity(state)) {
        item.status = 'blocked_storage'; result.blocked = 'Armazenamento de pratos cheio.'; break;
      }
      if (!consumeRecipe(state, recipe)) {
        item.status = 'blocked_ingredients'; result.blocked = 'Ingredientes insuficientes.'; break;
      }
      item.ingredientsCommitted = true;
      item.status = 'producing';
    }
    const duration = productionDuration(state, item.recipeId);
    const needed = duration - item.progressSeconds;
    const applied = Math.min(needed, remainingDelta);
    item.progressSeconds += applied;
    remainingDelta -= applied;
    if (item.progressSeconds + 0.0001 >= duration) {
      item.progressSeconds = 0;
      item.ingredientsCommitted = false;
      item.completed += 1;
      state.readyDishes[item.recipeId] += recipe.yield;
      state.restaurantXp += recipe.experience;
      state.stats.dishesProduced += recipe.yield;
      result.produced[item.recipeId] = (result.produced[item.recipeId] ?? 0) + recipe.yield;
      if (item.completed >= item.quantity) state.productionQueue.shift();
    }
  }
  return result;
}
