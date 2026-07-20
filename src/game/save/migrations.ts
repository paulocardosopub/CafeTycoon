import { GAME_VERSION, SAVE_SCHEMA_VERSION } from '../../config/balance';
import type { ConstructionSaveState, GameState, GraphicsSaveState, PlacedFurniture, RecipeId } from '../../core/types';
import { sanitizeInventory } from '../inventory/InventoryService';
import { createInitialConstructionState } from '../map/initialConstruction';
import { FURNITURE_BY_ID } from '../data/furniture/catalog';
import { modulesFromFurniture } from '../systems/service-counter/ServiceCounterSystem';
import { createDefaultState } from './defaultState';

export function migrateAndSanitizeSave(raw: GameState | null, now = Date.now()): GameState {
  if (!raw || typeof raw !== 'object') return createDefaultState(now);
  const fallback = createDefaultState(now);
  const containsQaResidue = hasQaResidue(raw.construction?.placedFurniture)
    || (raw.operation?.tables ?? []).some((table) => String(table.id ?? '').includes(':qa-'));
  const construction = sanitizeConstruction(raw.construction, raw.graphics, raw.readyDishes, fallback.construction);
  const state: GameState = {
    ...fallback,
    ...raw,
    schemaVersion: SAVE_SCHEMA_VERSION,
    gameVersion: GAME_VERSION,
    coins: Math.max(0, Number(raw.coins) || 0),
    restaurantXp: Math.max(0, Number(raw.restaurantXp) || 0),
    restaurantLevel: Math.max(1, Math.min(3, Number(raw.restaurantLevel) || 1)),
    reputation: Math.max(0, Math.min(100, Number(raw.reputation) || 0)),
    inventory: sanitizeInventory(raw.inventory ?? {}),
    inventoryReserved: sanitizeReservations(raw.inventoryReserved, sanitizeInventory(raw.inventory ?? {})),
    readyDishes: { ...fallback.readyDishes, ...(raw.readyDishes ?? {}) },
    productionQueue: Array.isArray(raw.productionQueue) ? raw.productionQueue.slice(0, 20) : [],
    upgrades: { ...fallback.upgrades, ...(raw.upgrades ?? {}) },
    stats: { ...fallback.stats, ...(raw.stats ?? {}) },
    graphics: raw.graphics?.dataVersion === 2 && Array.isArray(raw.graphics.objects) ? raw.graphics : fallback.graphics,
    construction,
    operation: containsQaResidue ? undefined : sanitizeOperation(raw.operation),
  };
  for (const key of Object.keys(state.readyDishes) as (keyof typeof state.readyDishes)[]) state.readyDishes[key] = Math.max(0, Math.floor(Number(state.readyDishes[key]) || 0));
  return state;
}

function sanitizeReservations(input: GameState['inventoryReserved'] | undefined, inventory: GameState['inventory']): GameState['inventoryReserved'] {
  const fallback = createDefaultState(0).inventoryReserved;
  for (const id of Object.keys(fallback) as (keyof typeof fallback)[]) {
    fallback[id] = Math.max(0, Math.min(inventory[id], Math.floor(Number(input?.[id]) || 0)));
  }
  return fallback;
}

function sanitizeOperation(input: GameState['operation']): GameState['operation'] {
  if (!input || ![1, 2].includes(input.dataVersion)) return undefined;
  const arrays = ['actors', 'customers', 'orders', 'tables', 'stations', 'tasks', 'counterSlots'] as const;
  if (arrays.some((key) => !Array.isArray(input[key]))) return undefined;
  return { ...input, simulationTime: Math.max(0, Number(input.simulationTime) || 0), customerSequence: Math.max(0, Math.floor(Number(input.customerSequence) || 0)), spawnCountdown: Math.max(0, Number(input.spawnCountdown) || 0) };
}

function sanitizeConstruction(
  input: GameState['construction'] | undefined,
  graphics: GraphicsSaveState | undefined,
  readyDishes: GameState['readyDishes'] | undefined,
  fallback: ConstructionSaveState,
): ConstructionSaveState {
  if (!input || input.dataVersion !== 1 || !Array.isArray(input.placedFurniture) || !Array.isArray(input.builtAreas)) {
    return migrateGraphics004ToConstruction(graphics, readyDishes, fallback);
  }
  const qaResidueRemoved = hasQaResidue(input.placedFurniture) || hasQaResidue(input.storedFurniture);
  const placedFurniture = input.placedFurniture.filter((item) => item && FURNITURE_BY_ID[item.definitionId] && !isQaFurniture(item)).map(sanitizePlaced);
  const storedFurniture = Array.isArray(input.storedFurniture) ? input.storedFurniture.filter((item) => item && FURNITURE_BY_ID[item.definitionId] && !isQaFurniture(item)).map(sanitizePlaced) : [];
  if (qaResidueRemoved && !placedFurniture.some((item) => FURNITURE_BY_ID[item.definitionId]?.functionId === 'table')) {
    const initialDining = fallback.placedFurniture.filter((item) => ['table', 'chair'].includes(FURNITURE_BY_ID[item.definitionId]?.functionId ?? ''));
    const occupied = new Set(placedFurniture.map((item) => `${item.gridX},${item.gridY}`));
    if (initialDining.every((item) => !occupied.has(`${item.gridX},${item.gridY}`))) placedFurniture.push(...initialDining.map((item) => sanitizePlaced({ ...item, state: { ...item.state } })));
  }
  const builtAreas = input.builtAreas.filter((area) => area && Number(area.width) > 0 && Number(area.depth) > 0).map((area) => ({ ...area, x: Math.floor(Number(area.x) || 0), y: Math.floor(Number(area.y) || 0), width: Math.max(1, Math.floor(Number(area.width) || 1)), depth: Math.max(1, Math.floor(Number(area.depth) || 1)) }));
  const serviceCounters = modulesFromFurniture(placedFurniture, Array.isArray(input.serviceCounters) ? input.serviceCounters : []);
  const staffStartPositions = Array.isArray(input.staffStartPositions) ? input.staffStartPositions.filter((position) => position && typeof position.staffId === 'string') : [];
  for (const defaultStart of fallback.staffStartPositions) {
    if (!staffStartPositions.some((position) => position.staffId === defaultStart.staffId)) staffStartPositions.push({ ...defaultStart });
  }
  return {
    ...fallback, ...input, placedFurniture, storedFurniture, serviceCounters,
    builtAreas: builtAreas.length ? builtAreas : fallback.builtAreas,
    staffStartPositions,
    migrationLog: [
      ...(Array.isArray(input.migrationLog) ? input.migrationLog.slice(-99) : []),
      ...(qaResidueRemoved ? ['Cenário interno de QA removido; progresso e compras preservados.'] : []),
    ],
  };
}

function isQaFurniture(item: PlacedFurniture): boolean {
  return String(item.id ?? '').includes(':qa-');
}

function hasQaResidue(items: PlacedFurniture[] | undefined): boolean {
  return Array.isArray(items) && items.some(isQaFurniture);
}

export function migrateGraphics004ToConstruction(
  graphics: GraphicsSaveState | undefined,
  readyDishes: GameState['readyDishes'] | undefined,
  fallback = createInitialConstructionState(),
): ConstructionSaveState {
  if (!graphics?.objects?.length) return fallback;
  const mapping: Record<string, string> = {
    'station:stove': 'cooking.a1.stove', 'station:oven': 'cooking.a2.convection', 'station:grill': 'cooking.a6.grill',
    'station:cauldron': 'cooking.a5.kettle', 'station:coffee_machine': 'cooking.a8.coffee', 'station:fridge': 'refrigeration.b1.fridge',
    'station:prep': 'preparation.b3.counter', 'station:assembly': 'preparation.b4.ingredients', 'station:sink': 'washing.b5.sink',
    'station:storage': 'storage.c5.pantry',
  };
  const placedFurniture: PlacedFurniture[] = [];
  for (const object of graphics.objects) {
    const definitionId = mapping[object.id] ?? (object.asset === 'table' ? 'dining.table.basic' : object.asset.startsWith('chair_') ? 'dining.chair.basic' : object.asset === 'plant' ? 'decor.plant.basic' : undefined);
    if (!definitionId) continue;
    const item = sanitizePlaced({ id: object.id, definitionId, gridX: object.position.x, gridY: object.position.y, orientation: object.orientation, skinId: object.visualSkinId, level: 1, state: object.linkedTableId ? { linkedTableId: object.linkedTableId, seatFacing: object.front } : {} });
    placeNearestFree(item, placedFurniture);
  }
  const oldPickup = graphics.objects.find((object) => object.id === 'station:pickup');
  const pickupOrigin = oldPickup?.position ?? { x: 7, y: 7 };
  const recipeIds: RecipeId[] = ['coffee', 'omelette', 'burger', 'soup'];
  for (let index = 0; index < recipeIds.length; index += 1) placedFurniture.push({
    id: `counter:migrated-${index + 1}`, definitionId: index === 0 ? 'service.c2.left' : index === recipeIds.length - 1 ? 'service.c4.right' : 'service.c3.middle',
    gridX: pickupOrigin.x + index, gridY: pickupOrigin.y, orientation: oldPickup?.orientation ?? 'sw', skinId: 'counter-forest', level: 1, state: {},
  });
  const serviceCounters = modulesFromFurniture(placedFurniture).map((module, index) => ({
    ...module, assignedRecipeId: recipeIds[index], currentQuantity: Math.max(0, Math.floor(Number(readyDishes?.[recipeIds[index]]) || 0)),
  }));
  return {
    ...fallback, placedFurniture, serviceCounters,
    migrationLog: ['v0.0.4 → v0.0.5: balcão 6×1 convertido em quatro módulos 1×1.', 'Móveis antigos normalizados para os footprints A1–C10 sem excluir compras.'],
  };
}

function sanitizePlaced(item: PlacedFurniture): PlacedFurniture {
  const definition = FURNITURE_BY_ID[item.definitionId];
  const orientation = definition?.allowedOrientations.includes(item.orientation) ? item.orientation : definition?.allowedOrientations[0] ?? 'sw';
  return { ...item, gridX: Math.floor(Number(item.gridX) || 0), gridY: Math.floor(Number(item.gridY) || 0), orientation, skinId: definition?.skinIds.includes(item.skinId) ? item.skinId : definition?.skinIds[0] ?? item.skinId, level: Math.max(1, Math.floor(Number(item.level) || 1)), state: item.state && typeof item.state === 'object' ? item.state : {} };
}

function placeNearestFree(item: PlacedFurniture, placed: PlacedFurniture[]): void {
  const occupied = new Set(placed.map((entry) => `${entry.gridX},${entry.gridY}`));
  for (let radius = 0; radius < 10; radius += 1) for (let y = item.gridY - radius; y <= item.gridY + radius; y += 1) for (let x = item.gridX - radius; x <= item.gridX + radius; x += 1) {
    if (!occupied.has(`${x},${y}`)) { placed.push({ ...item, gridX: x, gridY: y }); return; }
  }
  placed.push(item);
}
