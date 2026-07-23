import { BALANCE, GAME_VERSION, SAVE_SCHEMA_VERSION } from '../../config/balance';
import { RECIPES } from '../../content/recipes/recipes';
import type { GameState, IngredientId, RecipeId } from '../../core/types';
import { createPersistentId } from '../../core/id';
import { createGraphicsSaveState } from '../map/initialMap';
import { createInitialConstructionState } from '../map/initialConstruction';
import { createInitialStaffState } from '../staff/StaffService';
import { createInitialStorageState } from '../inventory/StorageService';
import { createInitialProcurementState } from '../inventory/ProcurementService';
import { createInitialProductionState } from '../cooking/ProductionPlanningService';
import { applyProgressionThroughLevel, createInitialProgressionState } from '../progression/RewardService';

export function createDefaultState(now = Date.now()): GameState {
  const construction = createInitialConstructionState();
  // Kept empty only so old save files remain readable. Ingredients no longer exist in gameplay.
  const inventory = {} as Record<IngredientId, number>;
  const base = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    gameVersion: GAME_VERSION,
    playerId: createPersistentId('player'),
    restaurantId: createPersistentId('restaurant'),
    coins: BALANCE.startingCoins,
    restaurantXp: 0,
    restaurantLevel: 1,
    reputation: BALANCE.startingReputation,
    restaurantOpen: false,
    inventory,
    inventoryReserved: {} as Record<IngredientId, number>,
    readyDishes: Object.fromEntries(RECIPES.map((recipe) => [recipe.id, 0])) as Record<RecipeId, number>,
    enabledRecipeIds: [],
    productionQueue: [],
    upgrades: { inventory: 0, dishStorage: 0, stationSpeed: 0 },
    lastActiveAt: now,
    offlineClaimId: '',
    stats: { customersServed: 0, customersLost: 0, dishesProduced: 0, coinsEarned: 0 },
    graphics: createGraphicsSaveState(),
    construction,
  };
  const state: GameState = {
    ...base,
    staff: createInitialStaffState(base, now),
    storage: createInitialStorageState(base, now),
    procurement: createInitialProcurementState(now),
    production: createInitialProductionState(),
    progression: createInitialProgressionState(),
    tutorial006: { currentStep: 0, completed: false, automationUnlocked: false, dismissed: false },
    tutorial008: { started: true, mandatory: true, minimized: false, currentStep: 0, completedSteps: [], availableChapters: ['level-1-first-service'], deferredChapters: [], completedChapters: [], rewardsReceived: [], highlightsShown: [] },
  };
  applyProgressionThroughLevel(state, 1, { notify: true });
  return state;
}
