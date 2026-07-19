export type GridPoint = { x: number; y: number };
export type Direction = 'ne' | 'nw' | 'se' | 'sw';
export type Orientation = Direction;
export type PixelAnimationName = 'idle' | 'walk' | 'carry-dish' | 'carry-ingredients' | 'work' | 'sit' | 'seated' | 'eat';
export type WorldAssetId = 'floor_dining' | 'floor_kitchen' | 'floor_outside' | 'floor_grass_alt' | 'floor_road' | 'wall_nw' | 'wall_ne' | 'door' |
  'table' | 'chair_ne' | 'chair_nw' | 'chair_se' | 'chair_sw' | 'prep' | 'stove' | 'grill' | 'cauldron' |
  'coffee_machine' | 'assembly' | 'pickup' | 'fridge' | 'oven' | 'sink' | 'storage' | 'plant' | 'shelf' | 'bin' | 'dish';
export type Presentation = 'masculina' | 'feminina';
export type HelpRole = 'kitchen' | 'service' | 'cleaning' | 'stock';
export type ProfessionId = 'cook' | 'waiter' | 'cleaner' | 'stocker';
export type IngredientId = 'bread' | 'beef' | 'cheese' | 'egg' | 'tomato' | 'coffee' | 'water' | 'vegetables' | 'seasoning';
export type RecipeId = 'coffee' | 'omelette' | 'burger' | 'soup';
export type StationId = 'prep' | 'stove' | 'grill' | 'cauldron' | 'coffee_machine' | 'assembly' | 'pickup' | 'fridge' | 'oven' | 'sink' | 'storage';
export type TableState = 'free' | 'reserved' | 'occupied' | 'waiting_order' | 'waiting_food' | 'eating' | 'waiting_payment' | 'dirty' | 'cleaning' | 'unavailable';
export type ChairState = 'free' | 'reserved' | 'approaching' | 'occupied' | 'waiting_order' | 'waiting_food' | 'eating' | 'waiting_payment' | 'dirty' | 'cleaning' | 'blocked' | 'inaccessible';
export type StationState = 'free' | 'reserved' | 'in_use' | 'waiting_worker' | 'complete' | 'blocked' | 'no_ingredients';
export type CustomerState = 'arriving' | 'entering' | 'seeking_table' | 'queueing' | 'walking_to_seat' | 'sitting' | 'waiting_order' | 'waiting_food' | 'eating' | 'paying' | 'standing' | 'leaving' | 'gone' | 'gave_up';
export type TaskKind = 'take_order' | 'cook_step' | 'deliver' | 'payment' | 'clean' | 'stock_support';
export type ActorKind = 'player' | 'cook' | 'waiter' | 'cleaner' | 'stocker';

export interface IngredientDefinition {
  id: IngredientId;
  name: string;
  category: 'fresh' | 'pantry' | 'drink';
  startingAmount: number;
  maxAmount: number;
  purchaseCost: number;
  purchaseAmount: number;
  reorderPoint: number;
  targetStock: number;
  quickBuyPackSize: number;
  maxStock: number;
  purchasePrice: number;
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
  orientation: Orientation;
  front: Direction;
  interactionPoints: GridPoint[];
  asset: WorldAssetId;
  anchor: GridPoint;
  visualHeight: number;
  blocksMovement: boolean;
  rotatable: boolean;
  serviceInteraction?: GridPoint;
  equipmentFamilyId?: string;
  visualLevel?: number;
  gameplayLevel?: number;
  renderedAssetId?: string;
  thumbnailId?: string;
  interactionSlots?: readonly string[];
  animationSet?: string;
  nextLevelAssetId?: string;
  unlockRequirement?: { restaurantLevel: number };
  statsConfigId?: string;
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
  seatId: string;
  chairId: string;
  position: GridPoint;
  approach: GridPoint;
  state: ChairState;
  orientation: Direction;
  tableId: string;
  sitPoint: GridPoint;
  customerId?: string;
  orderId?: string;
  enabled: boolean;
  accessible: boolean;
  reservationId?: string;
  servicePoint: GridPoint;
  platePosition: GridPoint;
  dirtPosition: GridPoint;
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
  orientation: Orientation;
  asset: WorldAssetId;
  occupiedCells: GridPoint[];
}

export interface PersistedWorldObject {
  id: string;
  position: GridPoint;
  footprint: { width: number; depth: number };
  orientation: Orientation;
  occupiedCells: GridPoint[];
  front: Direction;
  interactionPoints: GridPoint[];
  requiredFreeCells: GridPoint[];
  rotatable: boolean;
  asset: WorldAssetId;
  anchor: GridPoint;
  visualHeight: number;
  blocksMovement: boolean;
  linkedTableId?: string;
}

export interface GraphicsSaveState { dataVersion: 2; objects: PersistedWorldObject[] }

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
  inventoryReserved: Record<IngredientId, number>;
  readyDishes: Record<RecipeId, number>;
  productionQueue: ProductionQueueItem[];
  upgrades: UpgradeState;
  lastActiveAt: number;
  offlineClaimId: string;
  stats: { customersServed: number; customersLost: number; dishesProduced: number; coinsEarned: number };
  graphics: GraphicsSaveState;
  operation?: OperationSaveState;
}

export interface OperationSaveState {
  dataVersion: 1;
  savedAt: number;
  simulationTime: number;
  customerSequence: number;
  spawnCountdown: number;
  actors: Record<string, unknown>[];
  customers: Record<string, unknown>[];
  orders: Record<string, unknown>[];
  tables: Record<string, unknown>[];
  stations: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  counterSlots: Record<string, unknown>[];
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
