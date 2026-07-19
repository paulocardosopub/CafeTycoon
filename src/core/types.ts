export type GridPoint = { x: number; y: number };
export type Presentation = 'masculina' | 'feminina';
export type HelpRole = 'kitchen' | 'service' | 'cleaning' | 'stock';
export type ProfessionId = 'cook' | 'waiter' | 'cleaner' | 'stocker';
export type IngredientId = 'bread' | 'beef' | 'cheese' | 'egg' | 'tomato' | 'coffee' | 'water' | 'vegetables' | 'seasoning';
export type RecipeId = 'coffee' | 'omelette' | 'burger' | 'soup';
export type StationId = 'prep' | 'stove' | 'grill' | 'cauldron' | 'coffee_machine' | 'assembly' | 'pickup';
export type TableState = 'free' | 'reserved' | 'occupied' | 'waiting_order' | 'waiting_food' | 'eating' | 'waiting_cleaning' | 'unavailable';
export type ChairState = 'free' | 'reserved' | 'occupied' | 'blocked';
export type StationState = 'free' | 'reserved' | 'in_use' | 'waiting_worker' | 'complete' | 'blocked' | 'no_ingredients';
export type CustomerState = 'entering' | 'queueing' | 'walking_to_seat' | 'waiting_order' | 'waiting_food' | 'eating' | 'waiting_payment' | 'leaving' | 'gone' | 'gave_up';
export type TaskKind = 'take_order' | 'cook_step' | 'deliver' | 'payment' | 'clean' | 'stock_support';
export type ActorKind = 'player' | 'cook' | 'waiter';

export interface IngredientDefinition {
  id: IngredientId;
  name: string;
  category: 'fresh' | 'pantry' | 'drink';
  startingAmount: number;
  maxAmount: number;
  purchaseCost: number;
  purchaseAmount: number;
  unit: string;
  icon: string;
}

export interface RecipeIngredient { ingredientId: IngredientId; amount: number }
export interface RecipeStep { stationId: StationId; duration: number; label: string }
export interface RecipeDefinition {
  id: RecipeId;
  name: string;
  description: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  yield: number;
  salePrice: number;
  experience: number;
  requiredLevel: number;
  icon: string;
  storageSpace: number;
  category: 'drink' | 'breakfast' | 'main' | 'soup';
}

export interface StationDefinition {
  id: StationId;
  name: string;
  icon: string;
  position: GridPoint;
  size: GridPoint;
  interaction: GridPoint;
  color: number;
}

export interface StationRuntime extends StationDefinition {
  state: StationState;
  queue: string[];
  currentStep?: string;
  remaining: number;
  workerId?: string;
  level: number;
}

export interface ChairRuntime {
  id: string;
  position: GridPoint;
  approach: GridPoint;
  state: ChairState;
}

export interface TableRuntime {
  id: string;
  label: string;
  position: GridPoint;
  size: GridPoint;
  waiterApproach: GridPoint;
  chairs: ChairRuntime[];
  maxCustomers: number;
  state: TableState;
  customerId?: string;
  accessible: boolean;
}

export interface CharacterAppearance {
  presentation: Presentation;
  skin: string;
  hairStyle: string;
  hairColor: string;
  face: string;
  outfit: string;
  outfitColor: string;
}

export interface ProfessionProgress { xp: number; level: number; tasksCompleted: number }
export interface PlayerProfile {
  id: string;
  name: string;
  appearance: CharacterAppearance;
  level: number;
  xp: number;
  helpRole: HelpRole;
  professions: Record<ProfessionId, ProfessionProgress>;
  taskHistory: Record<TaskKind, number>;
}

export interface ProductionQueueItem {
  id: string;
  recipeId: RecipeId;
  quantity: number;
  completed: number;
  progressSeconds: number;
  status: 'queued' | 'producing' | 'blocked_ingredients' | 'blocked_storage';
  ingredientsCommitted: boolean;
}

export interface UpgradeState { inventory: number; dishStorage: number; stationSpeed: number }

export interface GameState {
  schemaVersion: number;
  gameVersion: string;
  playerId: string;
  restaurantId: string;
  profile?: PlayerProfile;
  coins: number;
  restaurantXp: number;
  restaurantLevel: number;
  reputation: number;
  inventory: Record<IngredientId, number>;
  readyDishes: Record<RecipeId, number>;
  productionQueue: ProductionQueueItem[];
  upgrades: UpgradeState;
  lastActiveAt: number;
  offlineClaimId: string;
  stats: { customersServed: number; customersLost: number; dishesProduced: number; coinsEarned: number };
}

export interface OfflineReport {
  absentSeconds: number;
  calculatedSeconds: number;
  capped: boolean;
  produced: Partial<Record<RecipeId, number>>;
  sold: Partial<Record<RecipeId, number>>;
  ingredientsConsumed: Partial<Record<IngredientId, number>>;
  coins: number;
  experience: number;
  characterRole: HelpRole;
  characterTasks: number;
  characterGeneralXp: number;
  characterProfessionXp: number;
  bonusPercent: number;
  idleSeconds: number;
  stoppedReasons: string[];
}

export interface RestaurantSnapshot {
  restaurantId: string;
  owner: { id: string; name: string; appearance: CharacterAppearance };
  level: number;
  reputation: number;
  mapId: string;
  furnitureIds: string[];
  stationIds: StationId[];
}
