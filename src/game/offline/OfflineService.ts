import { BALANCE, levelFromXp } from '../../config/balance';
import { RECIPE_BY_ID, RECIPES } from '../../content/recipes/recipes';
import type { GameState, HelpRole, IngredientId, OfflineReport, ProfessionId, RecipeId } from '../../core/types';
import { consumeRecipe } from '../inventory/InventoryService';
import { productionDuration, readyDishCapacity, readyDishUsed } from '../cooking/ProductionService';
import { updateRestaurantLevel } from '../progression/progression';

const PROFESSION_BY_ROLE: Record<HelpRole, ProfessionId> = {
  kitchen: 'cook', service: 'waiter', cleaning: 'cleaner', stock: 'stocker',
};

function maxCraftableFromInventory(state: GameState, recipeId: RecipeId): number {
  const recipe = RECIPE_BY_ID[recipeId];
  return Math.min(...recipe.ingredients.map(({ ingredientId, amount }) => Math.floor(state.inventory[ingredientId] / amount)));
}

function addConsumed(target: Partial<Record<IngredientId, number>>, consumed: Partial<Record<IngredientId, number>> | null): void {
  if (!consumed) return;
  for (const [id, amount] of Object.entries(consumed)) {
    const key = id as IngredientId;
    target[key] = (target[key] ?? 0) + (amount ?? 0);
  }
}

function zeroReport(absentSeconds: number, calculatedSeconds: number, role: HelpRole): OfflineReport {
  return {
    absentSeconds, calculatedSeconds, capped: absentSeconds > BALANCE.offline.maxSeconds,
    produced: {}, sold: {}, ingredientsConsumed: {}, coins: 0, experience: 0,
    characterRole: role, characterTasks: 0, characterGeneralXp: 0, characterProfessionXp: 0,
    bonusPercent: 0, idleSeconds: calculatedSeconds, stoppedReasons: [],
  };
}

export function calculateOfflineProgress(state: GameState, now = Date.now()): OfflineReport {
  const absentSeconds = Math.max(0, Math.floor((now - state.lastActiveAt) / 1000));
  const calculatedSeconds = Math.min(absentSeconds, BALANCE.offline.maxSeconds);
  const role = state.profile?.helpRole ?? 'kitchen';
  const report = zeroReport(absentSeconds, calculatedSeconds, role);
  const claimId = `${state.lastActiveAt}:${now}`;

  if (state.offlineClaimId === claimId || calculatedSeconds <= 0) {
    state.lastActiveAt = now;
    return report;
  }
  state.offlineClaimId = claimId;
  state.lastActiveAt = now;

  const professionLevel = state.profile?.professions[PROFESSION_BY_ROLE[role]].level ?? 1;
  report.bonusPercent = Math.round((professionLevel - 1) * BALANCE.professionSpeedPerLevel * 100);
  const serviceModifier = role === 'service' ? 1 - (professionLevel - 1) * BALANCE.professionSpeedPerLevel : role === 'cleaning' ? 0.92 : 1;
  const saleInterval = BALANCE.offline.saleIntervalSeconds * Math.max(0.65, serviceModifier);
  let saleBudget = Math.floor(calculatedSeconds / saleInterval);
  let productionTime = calculatedSeconds;
  let theoreticalSpace = Math.max(0, readyDishCapacity(state) - readyDishUsed(state)) + saleBudget;
  if (state.productionQueue.length && theoreticalSpace <= 0) report.stoppedReasons.push('O armazenamento de pratos ficou cheio.');

  while (state.productionQueue.length && productionTime > 0 && theoreticalSpace > 0) {
    const item = state.productionQueue[0];
    const recipe = RECIPE_BY_ID[item.recipeId];
    const duration = productionDuration(state, item.recipeId);
    const pending = item.quantity - item.completed;
    const firstDiscount = item.progressSeconds;
    const byTime = Math.max(0, Math.floor((productionTime + firstDiscount) / duration));
    const committedUnits = item.ingredientsCommitted ? 1 : 0;
    const byIngredients = maxCraftableFromInventory(state, item.recipeId) + committedUnits;
    const bySpace = Math.floor(theoreticalSpace / (recipe.storageSpace * recipe.yield));
    const completed = Math.min(pending, byTime, byIngredients, bySpace);

    if (completed <= 0) {
      if (byIngredients <= 0) report.stoppedReasons.push(`Faltaram ingredientes para ${recipe.name}.`);
      else if (bySpace <= 0) report.stoppedReasons.push('O armazenamento de pratos ficou cheio.');
      else if (byTime <= 0 && !item.ingredientsCommitted) {
        const consumed = consumeRecipe(state, recipe);
        if (consumed) {
          addConsumed(report.ingredientsConsumed, consumed);
          item.ingredientsCommitted = true;
          item.status = 'producing';
          item.progressSeconds += productionTime;
          report.idleSeconds = Math.max(0, report.idleSeconds - productionTime);
          productionTime = 0;
        }
      }
      break;
    }

    const toConsume = Math.max(0, completed - committedUnits);
    if (toConsume > 0) addConsumed(report.ingredientsConsumed, consumeRecipe(state, recipe, toConsume));
    const timeSpent = Math.max(0, completed * duration - firstDiscount);
    productionTime = Math.max(0, productionTime - timeSpent);
    report.idleSeconds = Math.max(0, report.idleSeconds - timeSpent);
    item.progressSeconds = 0;
    item.ingredientsCommitted = false;
    item.completed += completed;
    state.readyDishes[item.recipeId] += completed * recipe.yield;
    state.stats.dishesProduced += completed * recipe.yield;
    report.produced[item.recipeId] = (report.produced[item.recipeId] ?? 0) + completed * recipe.yield;
    const prepXp = completed * recipe.experience;
    state.restaurantXp += prepXp;
    report.experience += prepXp;
    theoreticalSpace -= completed * recipe.storageSpace * recipe.yield;
    if (item.completed >= item.quantity) state.productionQueue.shift();
  }

  for (const recipe of [...RECIPES].sort((a, b) => b.salePrice - a.salePrice)) {
    if (saleBudget <= 0) break;
    const available = state.readyDishes[recipe.id];
    const sold = Math.min(available, saleBudget);
    if (!sold) continue;
    state.readyDishes[recipe.id] -= sold;
    saleBudget -= sold;
    report.sold[recipe.id] = sold;
    const revenue = sold * recipe.salePrice;
    report.coins += revenue;
    report.experience += sold * 2;
    state.coins += revenue;
    state.restaurantXp += sold * 2;
    state.stats.customersServed += sold;
    state.stats.coinsEarned += revenue;
  }

  const producedCount = Object.values(report.produced).reduce((sum, value) => sum + (value ?? 0), 0);
  const soldCount = Object.values(report.sold).reduce((sum, value) => sum + (value ?? 0), 0);
  report.characterTasks = role === 'kitchen' ? producedCount : role === 'service' ? soldCount * 2 : role === 'cleaning' ? soldCount : Math.floor(Object.values(report.ingredientsConsumed).reduce((sum, value) => sum + (value ?? 0), 0) / 3);

  if (state.profile && report.characterTasks > 0) {
    const professionalXp = report.characterTasks * 2;
    const generalXp = Math.max(1, Math.floor(report.characterTasks * 0.8));
    const profession = state.profile.professions[PROFESSION_BY_ROLE[role]];
    profession.xp += professionalXp;
    profession.tasksCompleted += report.characterTasks;
    profession.level = levelFromXp(profession.xp, BALANCE.professionLevels);
    state.profile.xp += generalXp;
    state.profile.level = levelFromXp(state.profile.xp, BALANCE.playerLevels);
    report.characterProfessionXp = professionalXp;
    report.characterGeneralXp = generalXp;
  }
  if (!producedCount && state.productionQueue.length === 0) report.stoppedReasons.push('Não havia produção programada.');
  if (!soldCount) report.stoppedReasons.push('Não havia pratos prontos para vender.');
  if (absentSeconds > BALANCE.offline.maxSeconds) report.stoppedReasons.push('O limite de 8 horas foi aplicado.');
  report.stoppedReasons = [...new Set(report.stoppedReasons)];
  updateRestaurantLevel(state);
  return report;
}
