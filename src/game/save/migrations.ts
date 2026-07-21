import { GAME_VERSION, SAVE_SCHEMA_VERSION } from '../../config/balance';
import type { ConstructionSaveState, GameState, GraphicsSaveState, PlacedFurniture, RecipeId } from '../../core/types';
import { sanitizeInventory } from '../inventory/InventoryService';
import { createInitialConstructionState } from '../map/initialConstruction';
import { FURNITURE_BY_ID } from '../data/furniture/catalog';
import { modulesFromFurniture } from '../systems/service-counter/ServiceCounterSystem';
import { createDefaultState } from './defaultState';
import { sanitizeStaffState } from '../staff/StaffService';
import { createInitialStorageState, releaseStorageAllocation, reserveStorageAllocation } from '../inventory/StorageService';
import { sanitizeProcurementState } from '../inventory/ProcurementService';
import { sanitizeProductionState } from '../cooking/ProductionPlanningService';
import { orientedFootprint, resolvedWorkSlots } from '../systems/furniture/FurniturePlacement';
import { getApproachSlotCells, getSpriteAnchor, getVisualScale } from '../grid/SpatialLayoutService';
import { seatFacingTowardTable } from '../map/initialMap';

export function migrateAndSanitizeSave(raw: GameState | null, now = Date.now()): GameState {
  if (!raw || typeof raw !== 'object') return createDefaultState(now);
  const fallback = createDefaultState(now);
  const containsQaResidue = hasQaResidue(raw.construction?.placedFurniture)
    || (raw.operation?.tables ?? []).some((table) => String(table.id ?? '').includes(':qa-'));
  const construction = sanitizeConstruction(raw.construction, raw.graphics, raw.readyDishes, fallback.construction);
  const inventory = sanitizeInventory(raw.inventory ?? {});
  const sourceVersion = typeof raw.gameVersion === 'string' ? raw.gameVersion : '0.0.5';
  const migrationAdjustments: string[] = [];
  const state: GameState = {
    ...fallback,
    ...raw,
    schemaVersion: SAVE_SCHEMA_VERSION,
    gameVersion: GAME_VERSION,
    coins: Math.max(0, Number(raw.coins) || 0),
    restaurantXp: Math.max(0, Number(raw.restaurantXp) || 0),
    restaurantLevel: Math.max(1, Math.min(3, Number(raw.restaurantLevel) || 1)),
    reputation: Math.max(0, Math.min(100, Number(raw.reputation) || 0)),
    inventory,
    inventoryReserved: sanitizeReservations(raw.inventoryReserved, inventory),
    readyDishes: { ...fallback.readyDishes, ...(raw.readyDishes ?? {}) },
    productionQueue: Array.isArray(raw.productionQueue) ? raw.productionQueue.slice(0, 20) : [],
    upgrades: { ...fallback.upgrades, ...(raw.upgrades ?? {}) },
    stats: { ...fallback.stats, ...(raw.stats ?? {}) },
    graphics: raw.graphics?.dataVersion === 2 && Array.isArray(raw.graphics.objects) ? raw.graphics : fallback.graphics,
    construction,
    staff: fallback.staff,
    storage: fallback.storage,
    procurement: fallback.procurement,
    production: fallback.production,
    tutorial006: fallback.tutorial006,
    operation: containsQaResidue ? undefined : sanitizeOperation(raw.operation),
  };
  state.staff = sanitizeStaffState(raw.staff, state, now);
  state.storage = createInitialStorageState(state, now, raw.storage);
  state.procurement = sanitizeProcurementState(raw.procurement, now);
  state.production = sanitizeProductionState(raw.production);
  state.tutorial006 = raw.tutorial006 && typeof raw.tutorial006 === 'object'
    ? { ...fallback.tutorial006, ...raw.tutorial006, automationUnlocked: Boolean(raw.tutorial006.automationUnlocked), completed: Boolean(raw.tutorial006.completed) }
    : fallback.tutorial006;
  for (const request of state.procurement.requests.filter((item) => !['completed', 'cancelled', 'failed', 'blocked'].includes(item.status))) {
    const restoredLines = [] as typeof request.lines;
    const restored = request.lines.every((line) => {
      const ok = reserveStorageAllocation(state, line.ingredientId, line.storageAllocations);
      if (ok) restoredLines.push(line); return ok;
    });
    if (!restored) {
      for (const line of restoredLines) releaseStorageAllocation(state, line.ingredientId, line.storageAllocations);
      request.status = 'blocked'; request.blockedReason = 'Reserva de armazenamento foi reavaliada ao carregar.'; migrationAdjustments.push(`Solicitação ${request.id} reavaliada por falta de espaço.`);
    }
  }
  if (!raw.staff) migrationAdjustments.push(`${state.staff.instances.length} funcionários existentes convertidos para StaffInstance.`);
  if (state.storage.migrationPending) migrationAdjustments.push('Ingredientes acima da capacidade foram preservados em estoque legado seguro.');
  else if (!raw.storage) migrationAdjustments.push('Estoque existente distribuído entre os móveis físicos compatíveis.');
  if (!raw.procurement) migrationAdjustments.push('Automação de compras criada desligada e com saldo protegido.');
  if (!raw.production) migrationAdjustments.push('Central de produção inicializada sem duplicar a fila antiga.');
  state.migration006 = raw.migration006 ?? { sourceVersion, migratedAt: now, adjustments: migrationAdjustments };
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
  if (!input || ![1, 2, 3].includes(input.dataVersion)) return undefined;
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
  const spatialMigrationLog = normalizeDiningFurniture(placedFurniture, storedFurniture, builtAreas);
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
      ...spatialMigrationLog,
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
  const normalized: PlacedFurniture = { ...item, gridX: Math.round(Number(item.gridX) || 0), gridY: Math.round(Number(item.gridY) || 0), orientation, skinId: definition?.skinIds.includes(item.skinId) ? item.skinId : definition?.skinIds[0] ?? item.skinId, level: Math.max(1, Math.floor(Number(item.level) || 1)), state: item.state && typeof item.state === 'object' ? { ...item.state } : {} };
  if (!definition) return normalized;
  normalized.footprint = orientedFootprint(definition, orientation);
  normalized.anchor = getSpriteAnchor(definition);
  normalized.visualScale = getVisualScale(definition);
  normalized.heightCategory = definition.heightCategory;
  normalized.workSlotIds = resolvedWorkSlots(normalized, definition).map((slot) => slot.id);
  normalized.seatSlotIds = definition.functionId === 'chair' ? [`${normalized.id}:seat`] : [];
  return normalized;
}

function normalizeDiningFurniture(
  placed: PlacedFurniture[],
  stored: PlacedFurniture[],
  builtAreas: ConstructionSaveState['builtAreas'],
): string[] {
  const log: string[] = [];
  const tables = placed.filter((item) => FURNITURE_BY_ID[item.definitionId]?.functionId === 'table');
  const chairs = placed.filter((item) => FURNITURE_BY_ID[item.definitionId]?.functionId === 'chair');
  const assigned = new Set<string>();
  const inside = (point: { x: number; y: number }) => builtAreas.some((area) => point.x >= area.x && point.y >= area.y && point.x < area.x + area.width && point.y < area.y + area.depth);
  for (const table of tables) {
    const adjacent = chairs.filter((chair) => !assigned.has(chair.id) && Math.abs(chair.gridX - table.gridX) + Math.abs(chair.gridY - table.gridY) === 1)
      .sort((a, b) => Number(b.state.linkedTableId === table.id) - Number(a.state.linkedTableId === table.id) || a.id.localeCompare(b.id));
    let selected: PlacedFurniture[] = [];
    outer: for (let i = 0; i < adjacent.length; i += 1) for (let j = i + 1; j < adjacent.length; j += 1) {
      if (adjacent[i].gridX + adjacent[j].gridX === table.gridX * 2 && adjacent[i].gridY + adjacent[j].gridY === table.gridY * 2) {
        selected = [adjacent[i], adjacent[j]]; break outer;
      }
    }
    if (!selected.length && adjacent[0]) {
      selected = [adjacent[0]];
      const target = { x: table.gridX * 2 - adjacent[0].gridX, y: table.gridY * 2 - adjacent[0].gridY };
      const second = adjacent.slice(1).find((chair) => {
        const occupied = placed.some((item) => item.id !== chair.id && item.gridX === target.x && item.gridY === target.y);
        return inside(target) && !occupied;
      });
      if (second) { second.gridX = target.x; second.gridY = target.y; selected.push(second); log.push(`${table.id}: cadeiras antigas reposicionadas em lados opostos.`); }
    }
    for (const chair of selected.slice(0, 2)) {
      assigned.add(chair.id);
      const facing = seatFacingTowardTable({ x: chair.gridX, y: chair.gridY }, { x: table.gridX, y: table.gridY });
      chair.state = { ...chair.state, linkedTableId: table.id, seatFacing: facing };
      chair.orientation = facing;
      chair.seatSlotIds = [`${chair.id}:seat`];
      chair.approachSlotIds = [`${chair.id}:approach`];
    }
    table.attachedFurnitureIds = selected.slice(0, 2).map((chair) => chair.id);
    table.seatSlotIds = selected.slice(0, 2).map((chair) => `${chair.id}:seat`);
    table.approachSlotIds = getApproachSlotCells(table, selected.slice(0, 2)).map((point) => `${point.x},${point.y}`);
  }
  const extras = chairs.filter((chair) => !assigned.has(chair.id));
  if (extras.length) {
    const extraIds = new Set(extras.map((chair) => chair.id));
    for (const chair of extras) {
      const copy = sanitizePlaced({ ...chair, state: { ...chair.state, migrationReason: 'Cadeira excedente ou órfã preservada no inventário.' } });
      delete copy.state.linkedTableId; delete copy.state.seatFacing;
      if (!stored.some((item) => item.id === copy.id)) stored.push(copy);
    }
    for (let index = placed.length - 1; index >= 0; index -= 1) if (extraIds.has(placed[index].id)) placed.splice(index, 1);
    log.push(`${extras.length} cadeira(s) excedente(s) preservada(s) no inventário, sem exclusão.`);
  }
  return log;
}

function placeNearestFree(item: PlacedFurniture, placed: PlacedFurniture[]): void {
  const occupied = new Set(placed.map((entry) => `${entry.gridX},${entry.gridY}`));
  for (let radius = 0; radius < 10; radius += 1) for (let y = item.gridY - radius; y <= item.gridY + radius; y += 1) for (let x = item.gridX - radius; x <= item.gridX + radius; x += 1) {
    if (!occupied.has(`${x},${y}`)) { placed.push({ ...item, gridX: x, gridY: y }); return; }
  }
  placed.push(item);
}
