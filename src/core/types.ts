export type GridPoint = { x: number; y: number };
export type Direction = 'ne' | 'nw' | 'se' | 'sw';
export type Orientation = Direction;
export type ScreenFacing = 'front' | 'back' | 'left' | 'right';
export type FurnitureHeightCategory = 'LOW' | 'STANDARD_COUNTER' | 'TALL';
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
  visualScale: number;
  heightCategory: FurnitureHeightCategory;
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
  footprint?: { width: number; depth: number };
  anchor?: GridPoint;
  visualScale?: number;
  heightCategory?: FurnitureHeightCategory;
  attachedFurnitureIds?: string[];
  workSlotIds?: string[];
  seatSlotIds?: string[];
  approachSlotIds?: string[];
}

export interface FurnitureEditSession {
  furnitureId: string;
  originalGridPosition: GridPoint;
  originalRotation: Direction;
  originalAttachedFurniture: PlacedFurniture[];
  originalWorkSlots: FurnitureWorkSlot[];
  previewGridPosition: GridPoint;
  previewRotation: Direction;
  previewAttachedFurniture: PlacedFurniture[];
  validationState: 'valid' | 'invalid';
  validationErrors: string[];
  startedAt: number;
}

export interface CharacterFacingState {
  currentFacing: Direction;
  screenFacing: ScreenFacing;
  movementVectorGrid: GridPoint;
  movementVectorScreen: GridPoint;
  targetFacing: Direction;
  action: 'walking' | 'idle' | 'seated' | 'ordering' | 'cooking' | 'serving' | 'carrying' | 'cleaning' | 'stocking' | 'talking' | 'waiting' | 'exiting';
  animationKey: PixelAnimationName;
  lastDirectionChangeAt: number;
  reason: string;
}

export interface ServiceCounterModule {
  id: string;
  gridX: number;
  gridY: number;
  orientation: Direction;
  assignedRecipeId?: RecipeId;
  currentQuantity: number;
  reservedQuantity: number;
  incomingReservedQuantity?: number;
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
  linkedFurnitureId?: string;
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
export type HelpRole = 'manager' | 'kitchen' | 'service' | 'cleaning' | 'stock';
export type ProfessionId = 'cook' | 'waiter' | 'cleaner' | 'stocker';
export type StaffRole = ProfessionId;
export type StaffState = 'idle' | 'movingToTask' | 'working' | 'carrying' | 'waitingForWorkSlot' |
  'waitingForResource' | 'waitingForCounterSpace' | 'resting' | 'offShift' | 'blocked' | 'recovering' | 'training';
export type StorageType = 'dry' | 'refrigerated' | 'frozen' | 'general';
export type IngredientId = string;
export type RecipeId = string;
export type StationId = string;
export type TableState = 'free' | 'reserved' | 'occupied' | 'waiting_order' | 'waiting_food' | 'eating' | 'waiting_payment' | 'dirty' | 'cleaning' | 'unavailable';
export type ChairState = 'free' | 'reserved' | 'approaching' | 'occupied' | 'waiting_order' | 'waiting_food' | 'eating' | 'waiting_payment' | 'dirty' | 'cleaning' | 'blocked' | 'inaccessible';
export type StationState = 'free' | 'reserved' | 'in_use' | 'waiting_worker' | 'complete' | 'blocked' | 'no_ingredients';
export type CustomerState = 'arriving' | 'entering' | 'seeking_table' | 'queueing' | 'walking_to_seat' | 'sitting' | 'waiting_order' | 'waiting_food' | 'eating' | 'paying' | 'standing' | 'leaving' | 'gone' | 'gave_up';
export type TaskKind = 'take_order' | 'cook_step' | 'deliver' | 'payment' | 'clean' | 'stock_support' | 'restock_purchase' | 'production_batch';
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
  storageType: StorageType;
  compatibleStorageTypes: StorageType[];
  storageSize: number;
}

export interface StaffDefinition {
  id: string;
  name: string;
  role: StaffRole;
  visualModelId: string;
  level: number;
  experience: number;
  movementSpeed: number;
  taskSpeed: number;
  quality: number;
  carryingCapacity: number;
  salary: number;
  hiringCost: number;
  stamina: number;
  traits: string[];
  specialties: string[];
  primaryProfession: string;
  minimumLevel: number;
  compatibleStationId: string;
  allowedTasks: TaskKind[];
  scheduleId: string;
  startPosition: GridPoint;
  returnWhenIdle: boolean;
  includedByDefault: boolean;
  actorId: string;
  label: string;
  assetId: string;
  hireCost: number;
  suggestedStart: GridPoint;
  facing: Direction;
}

export interface StaffSchedule {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  workingDays: number[];
  breakRules: { afterHours: number; durationMinutes: number }[];
  overtimeAllowed: boolean;
}

export interface StaffInstance {
  id: string;
  definitionId: string;
  customName: string;
  role: StaffRole;
  level: number;
  experience: number;
  hiredAt: number;
  currentState: StaffState;
  currentTaskId?: string;
  currentPosition: GridPoint;
  currentFacing: Direction;
  startPosition: GridPoint;
  salary: number;
  scheduleId: string;
  enabled: boolean;
  automationSettings: { returnWhenIdle: boolean; allowedTasks: TaskKind[] };
  stats: { tasksCompleted: number; distanceWalked: number; blockedRecoveries: number; qualityTotal: number; salaryPaid: number };
  lastProgressAt: number;
  recoveryAttempts: number;
}

export interface StaffTrainingSession {
  id: string;
  staffId: string;
  startedAt: number;
  durationSeconds: number;
  elapsedSeconds: number;
  cost: number;
  status: 'active' | 'completed' | 'cancelled';
}

export interface StaffSystemState {
  instances: StaffInstance[];
  schedules: StaffSchedule[];
  candidateDefinitionIds: string[];
  candidateRefreshAt: number;
  maxStaff: number;
  nextPayrollAt: number;
  salaryArrears: number;
  payrollWarnings: string[];
  training: StaffTrainingSession[];
  eventLog: { at: number; staffId?: string; message: string }[];
}

export interface StorageDefinition {
  furnitureDefinitionId: string;
  storageType: StorageType;
  baseCapacity: number;
  allowedIngredientTags: StorageType[];
  workSlots: string[];
  levelCapacityMultiplier: number;
}

export interface StorageInventory {
  placedFurnitureId: string;
  storageType: StorageType;
  items: Partial<Record<IngredientId, number>>;
  reservedCapacity: number;
  currentCapacity: number;
  maxCapacity: number;
}

export interface StorageSystemState {
  inventories: StorageInventory[];
  legacyOverflow: Partial<Record<IngredientId, number>>;
  migrationPending: boolean;
  lastReconciledAt: number;
}

export interface AutoPurchasePolicy {
  id: string;
  enabled: boolean;
  ingredientId: IngredientId;
  minimumStock: number;
  targetStock: number;
  maximumPurchasePerCycle: number;
  maximumSpendPerCycle: number;
  protectedCashBalance: number;
  priority: number;
  preferredPackageId?: string;
  requireStorageSpace: boolean;
  pauseWhenRestaurantClosed: boolean;
}

export interface AutoPurchaseGlobalSettings {
  enabled: boolean;
  protectedCashBalance: number;
  maximumSpendPerCycle: number;
  maximumSpendPerPeriod: number;
  authorizedIngredients: IngredientId[];
  checkIntervalSeconds: number;
  allowWhenRestaurantClosed: boolean;
  confirmationThreshold: number;
  pauseAtCriticalCash: number;
  periodSeconds: number;
}

export interface PurchaseRequestLine {
  ingredientId: IngredientId;
  quantity: number;
  cost: number;
  storageAllocations: { placedFurnitureId: string; quantity: number }[];
}

export type PurchaseRequestStatus = 'pending' | 'approved' | 'purchasing' | 'delivering' | 'storing' |
  'completed' | 'blocked' | 'cancelled' | 'failed';

export interface PurchaseRequest {
  id: string;
  lines: PurchaseRequestLine[];
  totalCost: number;
  origin: 'manual' | 'automatic' | 'recipe' | 'tutorial';
  reason: string;
  priority: number;
  status: PurchaseRequestStatus;
  createdAt: number;
  updatedAt: number;
  responsibleStaffId?: string;
  blockedReason?: string;
  dedupeKey: string;
}

export interface PurchaseHistoryEntry {
  id: string;
  requestId: string;
  at: number;
  lines: { ingredientId: IngredientId; quantity: number }[];
  totalValue: number;
  origin: PurchaseRequest['origin'];
  responsibleStaffId?: string;
  reason: string;
  result: 'completed' | 'cancelled' | 'failed';
}

export interface ProcurementState {
  globalSettings: AutoPurchaseGlobalSettings;
  policies: AutoPurchasePolicy[];
  requests: PurchaseRequest[];
  history: PurchaseHistoryEntry[];
  spentThisPeriod: number;
  periodStartedAt: number;
  nextCheckAt: number;
}

export type ProductionPlanMode = 'singleBatch' | 'fixedQuantity' | 'maintainTarget' | 'repeatWhileResources';
export interface ProductionPlan {
  id: string;
  recipeId: RecipeId;
  mode: ProductionPlanMode;
  targetQuantity: number;
  batchSize: number;
  priority: number;
  preferredEquipmentIds: string[];
  preferredCounterIds: string[];
  enabled: boolean;
  repeat: boolean;
  currentProgress: number;
  createdAt: number;
  chargedCost?: number;
  refundedAt?: number;
}

export type ProductionTaskState = 'queued' | 'waitingForIngredients' | 'waitingForStorage' | 'waitingForStaff' |
  'waitingForWorkstation' | 'reserved' | 'inPreparation' | 'cooking' | 'waitingForCounterSpace' |
  'delivering' | 'completed' | 'cancelled' | 'failed';
export interface ProductionTask {
  id: string;
  productionPlanId: string;
  recipeId: RecipeId;
  batchQuantity: number;
  state: ProductionTaskState;
  requiredIngredients: Partial<Record<IngredientId, number>>;
  reservedIngredients: Partial<Record<IngredientId, number>>;
  workstationId?: string;
  workSlotId?: string;
  assignedStaffId?: string;
  outputCounterId?: string;
  outputReservations: { moduleId: string; quantity: number }[];
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  endsAt?: number;
  currentStepIndex?: number;
  completionClaimed?: boolean;
  blockedReason?: string;
}

export interface RecipeStockTarget {
  recipeId: RecipeId;
  enabled: boolean;
  minimumPrepared: number;
  targetPrepared: number;
  maximumPrepared: number;
  priority: number;
  allowedCounterIds: string[];
}

export interface ProductionSystemState {
  plans: ProductionPlan[];
  tasks: ProductionTask[];
  stockTargets: RecipeStockTarget[];
}

export interface Tutorial006State {
  currentStep: number;
  completed: boolean;
  automationUnlocked: boolean;
  dismissed: boolean;
}

export interface Migration006Report {
  sourceVersion: string;
  migratedAt: number;
  adjustments: string[];
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
  category: 'drink' | 'breakfast' | 'main' | 'soup' | 'snack' | 'dessert' | 'premium';
  aliases: string[];
  assetId: string;
  menuOrder: number;
  durationProfile: 'express' | 'quick' | 'medium' | 'long' | 'overnight' | 'premium' | 'legendary';
  baseDurationSeconds: number;
  batchYield: number;
  batchCost: number;
  grossRevenue: number;
  estimatedProfit: number;
  reputationReward: number;
  requiredSpecialties: string[];
  available: boolean;
}

export interface Tutorial008State {
  started: boolean;
  mandatory: boolean;
  minimized: boolean;
  currentStep: number;
  completedSteps: string[];
  availableChapters: string[];
  deferredChapters: string[];
  completedChapters: string[];
  rewardsReceived: string[];
  highlightsShown: string[];
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
  visualScale?: number;
  heightCategory?: FurnitureHeightCategory;
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
  assetId?: string;
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
  /** Persisted payment marker. Prevents charging a running batch again after save/load. */
  costPaid?: boolean;
}

export interface UpgradeState { inventory: number; dishStorage: number; stationSpeed: number }

export interface ProgressionState {
  appliedRewardIds: string[];
  notifiedLevels: number[];
  confirmedLevels: number[];
  pendingLevels: number[];
  unlockedProfessionIds: string[];
  unlockedCandidateIds: string[];
  unlockedFurnitureIds: string[];
  unlockedSystemIds: string[];
  restaurantStars: number;
  retroactiveSummaryPending: boolean;
  retroactiveSummaryLevels: number[];
}

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
  restaurantOpen: boolean;
  inventory: Record<IngredientId, number>;
  inventoryReserved: Record<IngredientId, number>;
  readyDishes: Record<RecipeId, number>;
  enabledRecipeIds: RecipeId[];
  productionQueue: ProductionQueueItem[];
  upgrades: UpgradeState;
  progression: ProgressionState;
  lastActiveAt: number;
  offlineClaimId: string;
  stats: { customersServed: number; customersLost: number; dishesProduced: number; coinsEarned: number };
  graphics: GraphicsSaveState;
  construction: ConstructionSaveState;
  staff: StaffSystemState;
  storage: StorageSystemState;
  procurement: ProcurementState;
  production: ProductionSystemState;
  tutorial006: Tutorial006State;
  tutorial008: Tutorial008State;
  migration006?: Migration006Report;
  operation?: OperationSaveState;
}

export interface OperationSaveState {
  dataVersion: 1 | 2 | 3;
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
  ingredientsPurchased: Partial<Record<IngredientId, number>>;
  salariesCharged: number;
  purchaseCosts: number;
  grossRevenue: number;
  costs: number;
  netProfit: number;
  blockedTasks: { kind: string; reason: string }[];
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
