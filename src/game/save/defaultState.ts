import { BALANCE, GAME_VERSION, SAVE_SCHEMA_VERSION } from '../../config/balance';
import { INGREDIENTS } from '../../content/ingredients/ingredients';
import { RECIPES } from '../../content/recipes/recipes';
import type { GameState, IngredientId, RecipeId } from '../../core/types';
import { createPersistentId } from '../../core/id';
import { createGraphicsSaveState } from '../map/initialMap';
import { createInitialConstructionState } from '../map/initialConstruction';
import { createInitialStaffState } from '../staff/StaffService';
import { createInitialStorageState } from '../inventory/StorageService';
import { createInitialProcurementState } from '../inventory/ProcurementService';
import { createInitialProductionState } from '../cooking/ProductionPlanningService';

export function createDefaultState(now = Date.now()): GameState {
  const construction = createInitialConstructionState();
  const inventory = Object.fromEntries(INGREDIENTS.map((item) => [item.id, item.startingAmount])) as Record<IngredientId, number>;
  const base = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    gameVersion: GAME_VERSION,
    playerId: createPersistentId('player'),
    restaurantId: createPersistentId('restaurant'),
    coins: BALANCE.startingCoins,
    restaurantXp: 0,
    restaurantLevel: 1,
    reputation: BALANCE.startingReputation,
    inventory,
    inventoryReserved: Object.fromEntries(INGREDIENTS.map((item) => [item.id, 0])) as Record<IngredientId, number>,
    readyDishes: Object.fromEntries(RECIPES.map((recipe) => [recipe.id, recipe.id === 'coffee' ? 2 : 0])) as Record<RecipeId, number>,
    productionQueue: [],
    upgrades: { inventory: 0, dishStorage: 0, stationSpeed: 0 },
    lastActiveAt: now,
    offlineClaimId: '',
    stats: { customersServed: 0, customersLost: 0, dishesProduced: 0, coinsEarned: 0 },
    graphics: createGraphicsSaveState(),
    construction,
  };
  return {
    ...base,
    staff: createInitialStaffState(base, now),
    storage: createInitialStorageState(base, now),
    procurement: createInitialProcurementState(now),
    production: createInitialProductionState(),
    tutorial006: { currentStep: 0, completed: false, automationUnlocked: false, dismissed: false },
  };
}
