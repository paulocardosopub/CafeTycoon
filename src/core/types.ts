export type GridPoint = { x: number; y: number };
export type Direction = 'ne' | 'nw' | 'se' | 'sw';
export type Orientation = Direction;
export type FurnitureCode = `A${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}` |
  `B${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}` |
  `C${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10}` | 'T1' | 'CH1' | 'D1';
export type FurnitureCategory = 'tables' | 'chairs' | 'cooking' | 'refrigeration' | 'preparation' |
  'washing' | 'service' | 'storage' | 'decoration';
export type WorkSlotRole = 'cook' | 'waiter' | 'cleaner' | 'stocker' | 'player' | 'any';
export type ServiceCounterConnection = 'isolated' | 'left' | 'middle' | 'right' | 'corner';
export type PixelAnimationName = 'idle' | 'walk' | 'sit-down' | 'seated-idle' | 'seated-waiting' | 'seated-eating' |
  'stand-up' | 'carry-plate' | 'carry-ingredients' | 'cook' | 'use-appliance' | 'serve' | 'clean' | 'receive-payment';
export type VisualSkinId = 'floor-terracotta' | 'floor-cream' | 'wall-cream-green' | 'wall-cream-wood' |
  'table-oak' | 'table-green' | 'chair-wood' | 'chair-upholstered' | 'chair-bistro' |
  'counter-oak' | 'counter-green' | 'equipment-steel-level-1' | 'decor-bloom';
export interface VisualBounds { widthCells: number; depthCells: number; heightBlocks: number; overhangCells: number }

export interface FurnitureWorkSlot {
  id: string;
  offset: GridPoint;
  role: WorkSlotRole;
  facing: Direction;
  purpose: 'work' | 'ingredients' | 'output' | 'kitchen-drop' | 'waiter-pickup';
  required: boolean;
}

export interface FurnitureDefinition {
  id: string;
  code: FurnitureCode;
  category: FurnitureCategory;
  name: string;
  footprintWidth: number;
  footprintDepth: number;
  allowedOrientations: Direction[];
  spriteSet: Record<Direction, string>;
  blenderSource: string;
  baseAnchor: GridPoint;
  visualBounds: VisualBounds;
  collisionCells: GridPoint[];
  workSlots: FurnitureWorkSlot[];
  frontDirection: Direction;
  skinIds: string[];
  level: number;
  price: number;
  resaleValue: number;
  functionId?: StationId | 'table' | 'chair' | 'decoration';
  rotatable: boolean;
  essential?: boolean;
}

export interface PlacedFurniture {
  id: string;
  definitionId: string;
  gridX: number;
  gridY: number;
  orientation: Direction;
  skinId: string;
  level: number;
  state: Record<string, unknown>;
}

export interface ServiceCounterModule {
  id: string;
  gridX: number;
  gridY: number;
  orientation: Direction;
  assignedRecipeId?: RecipeId;
  currentQuantity: number;
  reservedQuantity: number;
  maxCapacity: number;
  skinId: string;
  level: number;
  connectionVariant: ServiceCounterConnection;
  kitchenDropSlot: GridPoint;
  waiterPickupSlot: GridPoint;
}

export interface FurnitureSkin {
  id: string;
  furnitureDefinitionId: string;
  name: string;
  spriteSet: Record<Direction, string>;
  palette: string;
  unlockLevel: number;
  price: number;
}

export interface ExpansionDefinition {
  id: string;
  width: number;
  depth: number;
  unlockLevel: number;
  coinCost: number;
  premiumCostOptional?: number;
  allowedSides: ('north' | 'east' | 'south' | 'west')[];
  prerequisites: string[];
}

export interface BuiltAreaRect {
  id: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  kind: 'base' | 'expansion';
  expansionDefinitionId?: string;
}

export interface StaffStartPosition {
  staffId: string;
  gridX: number;
  gridY: number;
  facing: Direction;
  returnWhenIdle: boolean;
}

export interface ConstructionSaveState {
  dataVersion: 1;
  placedFurniture: PlacedFurniture[];
  storedFurniture: PlacedFurniture[];
  serviceCounters: ServiceCounterModule[];
  builtAreas: BuiltAreaRect[];
  floorSkinId: string;
  wallSkinId: string;
  doorSkinId: string;
  windowSkinId: string;
  staffStartPositions: StaffStartPosition[];
  migrationLog: string[];
}
export type WorldAssetId = 'floor_dining' | 'floor_kitchen' | 'floor_outside' | 'floor_grass_alt' | 'floor_road' | 'wall_nw' | 'wall_ne' | 'door' |
  'table' | 'chair_ne' | 'chair_nw' | 'chair_se' | 'chair_sw' | 'prep' | 'stove' | 'grill' | 'cauldron' |
  'coffee_machine' | 'assembly' | 'pickup' | 'fridge' | 'oven' | 'sink' | 'storage' | 'plant' | 'shelf' | 'bin' | 'dish';
export type Presentation = 'masculina' | 'feminina';
export type HelpRole = 'kitchen' | 'service' | 'cleaning' | 'stock';
export type ProfessionId = 'cook' | 'waiter' | 'cleaner' | 'stocker';
export type IngredientId = 'bread' | 'beef' | 'cheese' | 'egg' | 'tomato' | 'coffee' | 'water' | 'vegetables' | 'seasoning';
export type RecipeId = 'coffee' | 'omelette' | 'burger' | 'soup';
export type StationId = 'prep' | 'stove' | 'grill' | 'cauldron' | 'coffee_machine' | 'assembly' | 'pickup' | 'fridge' | 'oven' | 'sink' | 'storage' | `${string}:${string}`;
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
  primaryWorkSlot: GridPoint;
  optionalWorkSlots: GridPoint[];
  ingredientSlot: GridPoint;
  outputSlot: GridPoint;
  clearanceCells: GridPoint[];
  asset: WorldAssetId;
  anchor: GridPoint;
  visualHeight: number;
  blocksMovement: boolean;
  rotatable: boolean;
  visualSkinId: VisualSkinId;
  visualBounds: VisualBounds;
  depthOffset: number;
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
  visualPosition: GridPoint;
  approach: GridPoint;
  state: ChairState;
  orientation: Direction;
  tableId: string;
  sitPoint: GridPoint;
  seatAnchor: GridPoint;
  footprint: { width: 1; depth: 1 };
  depthOffset: number;
  visualSkinId: Extract<VisualSkinId, 'chair-wood' | 'chair-upholstered' | 'chair-bistro'>;
  layerAssetIds: { back: string; front: string };
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
  visualSkinId: VisualSkinId;
  visualBounds: VisualBounds;
  depthOffset: number;
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
  construction: ConstructionSaveState;
  operation?: OperationSaveState;
}

export interface OperationSaveState {
  dataVersion: 1 | 2;
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
  counterModules?: Record<string, unknown>[];
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
