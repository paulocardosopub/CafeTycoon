import type { ChairRuntime, ConstructionSaveState, Direction, GraphicsSaveState, GridPoint, PersistedWorldObject, PlacedFurniture, StationId, StationRuntime, TableRuntime, WorldAssetId } from '../../core/types';
import { STATIONS } from '../../content/stations/stations';
import { applyEquipmentAsset, EQUIPMENT_BY_FAMILY, type EquipmentFamilyId } from '../../content/equipment/equipment';
import { RestaurantGrid } from '../grid/Grid';
import { createInitialConstructionState } from './initialConstruction';
import { FURNITURE_BY_ID } from '../data/furniture/catalog';
import { orientedFootprint, resolvedWorkSlots, rotateDirection, orientationTurns } from '../systems/furniture/FurniturePlacement';
import { facingBetweenTargets } from '../systems/animation/CharacterFacing';

export const RESTAURANT_SIZE = { width: 18, height: 18 } as const;
export const MAP_SIZE = { width: 60, height: 38 } as const;
export const ENTRANCE: GridPoint = { x: 9, y: 17 };
export const EXIT: GridPoint = { x: 10, y: 17 };
export const RESTAURANT_ENTRY_ZONE: GridPoint[] = [ENTRANCE, EXIT];
export const STREET_ENTRY_POINTS: GridPoint[] = [{ x: 3, y: 21 }, { x: 7, y: 21 }, { x: 13, y: 21 }];
export const STREET_EXIT_ZONE: GridPoint[] = [{ x: 14, y: 21 }, { x: 15, y: 21 }, { x: 16, y: 21 }, { x: 17, y: 21 }, { x: 13, y: 20 }];
export const STREET_EXIT: GridPoint = STREET_EXIT_ZONE[2];
export const CUSTOMER_QUEUE: GridPoint[] = [
  { x: 9, y: 16 }, { x: 7, y: 16 }, { x: 5, y: 16 }, { x: 3, y: 16 }, { x: 1, y: 16 },
  { x: 8, y: 18 }, { x: 6, y: 18 }, { x: 4, y: 18 }, { x: 2, y: 18 },
];
export const PICKUP_KITCHEN_POINT: GridPoint = { x: 7, y: 6 };
export const PICKUP_SERVICE_POINT: GridPoint = { x: 7, y: 8 };

// Decorative furniture now lives entirely in ConstructionSaveState so every
// visible plant and bin can be selected, moved, rotated, stored or sold.
export const DECORATIONS: PersistedWorldObject[] = [];

export const seatFacingTowardTable = (chair: GridPoint, table: GridPoint): Direction => {
  return facingBetweenTargets(chair, table, 'se');
};

const chairServicePoint = (chair: GridPoint, table: GridPoint): GridPoint => {
  const dx = Math.sign(chair.x - table.x);
  const dy = Math.sign(chair.y - table.y);
  // Orders and delivery happen behind the chair. This remains accessible when
  // adjacent tables are joined into one long table.
  return { x: chair.x + dx, y: chair.y + dy };
};

function createChair(tableId: string, suffix: string, position: GridPoint, tablePosition: GridPoint, approach: GridPoint, _skinIndex: number): ChairRuntime {
  const id = `${tableId}-chair-${suffix}`;
  const visualSkinId = 'chair-wood' as const;
  const assetStem = visualSkinId.replace('chair-', 'chair_');
  const visualPosition = { ...position };
  return {
    id, seatId: `${tableId}-seat-${suffix}`, chairId: id, tableId, position, visualPosition, approach, sitPoint: { ...position },
    seatAnchor: { ...visualPosition }, footprint: { width: 1, depth: 1 }, depthOffset: 0, visualSkinId,
    layerAssetIds: { back: `${assetStem}_back`, front: `${assetStem}_front` },
    servicePoint: chairServicePoint(position, tablePosition), platePosition: { ...tablePosition }, dirtPosition: { ...tablePosition },
    state: 'free', orientation: seatFacingTowardTable(position, tablePosition), enabled: true, accessible: true,
  };
}

function table(id: string, label: string, position: GridPoint, seats: 2, waiterApproach: GridPoint): TableRuntime {
  const chairSpecs = [
      { suffix: 'west', position: { x: position.x - 1, y: position.y }, approach: { x: position.x - 1, y: position.y - 1 } },
      { suffix: 'east', position: { x: position.x + 1, y: position.y }, approach: { x: position.x + 1, y: position.y + 1 } },
    ];
  const tableSkinIndex = id.includes('garden') ? 0 : id.includes('sun') ? 1 : 2;
  const chairs = chairSpecs.map((spec) => createChair(id, spec.suffix, spec.position, position, spec.approach, tableSkinIndex));
  return {
    id, label, position, size: { x: 1, y: 1 }, waiterApproach, maxCustomers: seats, state: 'free', accessible: true,
    chairs, orientation: 'sw', asset: 'table', occupiedCells: [{ ...position }, ...chairs.map((chair) => ({ ...chair.position }))],
  };
}

export function createTables(): TableRuntime[] {
  return createTablesFromConstruction(createInitialConstructionState());
}

export function createTablesFromConstruction(construction: ConstructionSaveState): TableRuntime[] {
  const tables = construction.placedFurniture.filter((item) => FURNITURE_BY_ID[item.definitionId]?.functionId === 'table');
  const chairs = construction.placedFurniture.filter((item) => FURNITURE_BY_ID[item.definitionId]?.functionId === 'chair');
  return tables.map((placed, index) => {
    const position = { x: placed.gridX, y: placed.gridY };
    const linked = chairs.filter((chair) => chair.state.linkedTableId === placed.id).slice(0, FURNITURE_BY_ID[placed.definitionId]?.footprintWidth === 2 ? 4 : 2);
    const runtimeChairs = linked.map((chair, chairIndex) => createPlacedChair(placed, chair, chairIndex));
    const waiterApproach = nearestTableServicePoint(position, linked);
    return {
      id: placed.id, label: `Mesa ${index + 1}`, position, size: { x: FURNITURE_BY_ID[placed.definitionId]?.footprintWidth ?? 1, y: FURNITURE_BY_ID[placed.definitionId]?.footprintDepth ?? 1 }, waiterApproach,
      maxCustomers: runtimeChairs.length, state: 'free', accessible: true, chairs: runtimeChairs,
      orientation: placed.orientation, asset: 'table', occupiedCells: [position, ...runtimeChairs.map((chair) => ({ ...chair.position }))],
    };
  });
}

export function createStations(construction: ConstructionSaveState = createInitialConstructionState()): StationRuntime[] {
  const placedStations = construction.placedFurniture.filter((item) => {
    const functionId = FURNITURE_BY_ID[item.definitionId]?.functionId;
    return functionId && !['table', 'chair', 'decoration'].includes(functionId);
  });
  const sequence = new Map<string, number>();
  return placedStations.map((item) => {
    const definition = FURNITURE_BY_ID[item.definitionId];
    const baseId = definition.functionId as StationId;
    const index = sequence.get(baseId) ?? 0; sequence.set(baseId, index + 1);
    const id = (index === 0 ? baseId : `${baseId}:${item.id}`) as StationId;
    const size = orientedFootprint(definition, item.orientation);
    const slots = resolvedWorkSlots(item, definition);
    const kitchenSlot = slots.find((slot) => slot.purpose === 'kitchen-drop');
    const waiterSlot = slots.find((slot) => slot.purpose === 'waiter-pickup');
    const workSlots = slots.filter((slot) => !['kitchen-drop', 'waiter-pickup'].includes(slot.purpose));
    const primary = kitchenSlot?.point ?? workSlots[0]?.point ?? { x: item.gridX, y: item.gridY + size.depth };
    const serviceInteraction = waiterSlot?.point;
    const asset = worldAssetForStation(baseId);
    const counterVariant = construction.serviceCounters.find((module) => module.id === item.id)?.connectionVariant;
    const renderDefinition = baseId === 'pickup' && counterVariant
      ? FURNITURE_BY_ID[{ isolated: 'service.c1.isolated', left: 'service.c2.left', middle: 'service.c3.middle', right: 'service.c4.right', corner: 'service.c1.isolated' }[counterVariant]]
      : definition;
    const renderedAssetId = renderDefinition.spriteSet[item.orientation];
    const interactionPoints = [...new Map(slots.map((slot) => [`${slot.point.x},${slot.point.y}`, slot.point])).values()];
    return {
      id, name: definition.name, icon: definition.code, position: { x: item.gridX, y: item.gridY }, size: { x: size.width, y: size.depth }, interaction: primary,
      color: 0x72817f, orientation: item.orientation, front: rotateDirection(definition.frontDirection, orientationTurns(item.orientation)),
      interactionPoints, primaryWorkSlot: primary, optionalWorkSlots: workSlots.slice(1).map((slot) => slot.point), ingredientSlot: primary,
      outputSlot: serviceInteraction ?? primary, clearanceCells: interactionPoints, serviceInteraction,
      asset, anchor: definition.baseAnchor, visualHeight: Math.round(definition.visualBounds.heightBlocks * 48), blocksMovement: true, rotatable: definition.rotatable,
      visualSkinId: definition.category === 'service' ? 'counter-green' : 'equipment-steel-level-1', visualBounds: definition.visualBounds, depthOffset: 0,
      visualScale: definition.visualScale, heightCategory: definition.heightCategory,
      renderedAssetId, equipmentFamilyId: baseId, visualLevel: item.level, gameplayLevel: item.level, thumbnailId: renderedAssetId,
      interactionSlots: slots.map((slot) => slot.id), animationSet: 'equipment-basic-v1', nextLevelAssetId: `${renderedAssetId}_level_2`,
      unlockRequirement: { restaurantLevel: 1 }, statsConfigId: `${definition.id}:level:${item.level}`,
      state: 'free', queue: [], remaining: 0, level: item.level,
    };
  });
}

export function createInitialGrid(tables = createTables(), stations = createStations(), construction: ConstructionSaveState = createInitialConstructionState()): RestaurantGrid {
  const builtMaxX = Math.max(...construction.builtAreas.map((area) => area.x + area.width));
  const builtMaxY = Math.max(...construction.builtAreas.map((area) => area.y + area.depth));
  const grid = new RestaurantGrid(Math.max(34, builtMaxX + 6), Math.max(38, builtMaxY + 2));
  const built = (x: number, y: number) => construction.builtAreas.some((area) => x >= area.x && y >= area.y && x < area.x + area.width && y < area.y + area.depth);
  for (let y = 0; y < grid.height; y += 1) for (let x = 0; x < grid.width; x += 1) {
    if (built(x, y)) continue;
    // A parede vive na aresta externa do losango, não ocupa o próprio tile.
    // Mantemos somente o corredor externo de chegada transitável.
    const streetAccess = x >= 1 && x <= 17 && y >= RESTAURANT_SIZE.height && y <= 21;
    if (!streetAccess) grid.set({ x, y }, { kind: 'outside', walkable: false });
  }
  grid.set(ENTRANCE, { kind: 'entrance', walkable: true });
  grid.set(EXIT, { kind: 'exit', walkable: true });

  stations.forEach((item) => {
    grid.setRect(item.position, item.size, { kind: 'blocked', walkable: false, stationPart: item.id });
    item.interactionPoints.forEach((point, index) => grid.set(point, { reservedFor: `station:${item.id}:${index}` }));
  });
  tables.forEach((item) => {
    grid.set(item.position, { kind: 'blocked', walkable: false, furniturePart: item.id });
    item.chairs.forEach((chair) => grid.set(chair.position, { kind: 'blocked', walkable: false, furniturePart: chair.id }));
    grid.set(item.waiterApproach, { reservedFor: `table:${item.id}:waiter` });
  });
  construction.placedFurniture.filter((item) => FURNITURE_BY_ID[item.definitionId]?.functionId === 'decoration').forEach((item) => {
    const footprint = orientedFootprint(FURNITURE_BY_ID[item.definitionId], item.orientation);
    grid.setRect({ x: item.gridX, y: item.gridY }, { x: footprint.width, y: footprint.depth }, { kind: 'blocked', walkable: false, furniturePart: item.id });
  });
  DECORATIONS.filter((item) => item.blocksMovement).forEach((item) => grid.set(item.position, { kind: 'blocked', walkable: false, furniturePart: item.id }));
  for (let y = 0; y < grid.height; y += 1) for (let x = 0; x < grid.width; x += 1) {
    if (!built(x, y) && y < RESTAURANT_SIZE.height) grid.set({ x, y }, { kind: 'outside', walkable: false });
  }
  return grid;
}

function createPlacedChair(tableItem: PlacedFurniture, chairItem: PlacedFurniture, index: number): ChairRuntime {
  const tablePosition = { x: tableItem.gridX, y: tableItem.gridY };
  const position = { x: chairItem.gridX, y: chairItem.gridY };
  const delta = { x: Math.sign(position.x - tablePosition.x), y: Math.sign(position.y - tablePosition.y) };
  const approach = { x: position.x + delta.x, y: position.y + delta.y };
  const visualPosition = { ...position };
  // Old saves may contain a stale facing. Seating direction is always derived
  // from the current chair/table geometry so rotations and moves stay correct.
  const orientation = seatFacingTowardTable(position, tablePosition);
  const visualSkinId = 'chair-wood' as ChairRuntime['visualSkinId'];
  const assetStem = visualSkinId.replace('chair-', 'chair_');
  return {
    id: chairItem.id, seatId: `${chairItem.id}:seat`, chairId: chairItem.id, tableId: tableItem.id, position, visualPosition, approach,
    sitPoint: position, seatAnchor: visualPosition, footprint: { width: 1, depth: 1 }, depthOffset: index * .001, visualSkinId,
    layerAssetIds: { back: `${assetStem}_back`, front: `${assetStem}_front` }, servicePoint: chairServicePoint(position, tablePosition), platePosition: tablePosition,
    dirtPosition: tablePosition, state: 'free', orientation, enabled: true, accessible: true,
  };
}

function nearestTableServicePoint(position: GridPoint, chairs: readonly PlacedFurniture[]): GridPoint {
  const occupied = new Set(chairs.map((chair) => `${chair.gridX},${chair.gridY}`));
  const candidates = [
    { x: position.x, y: position.y - 1 }, { x: position.x + 1, y: position.y },
    { x: position.x, y: position.y + 1 }, { x: position.x - 1, y: position.y },
    { x: position.x - 1, y: position.y - 1 }, { x: position.x + 1, y: position.y - 1 },
    { x: position.x + 1, y: position.y + 1 }, { x: position.x - 1, y: position.y + 1 },
    { x: position.x, y: position.y - 2 }, { x: position.x + 2, y: position.y },
    { x: position.x, y: position.y + 2 }, { x: position.x - 2, y: position.y },
  ];
  return candidates.find((point) => !occupied.has(`${point.x},${point.y}`)) ?? { x: position.x - 1, y: position.y - 1 };
}

function worldAssetForStation(id: StationId): WorldAssetId {
  const base = id.split(':')[0] as StationId;
  return ({ prep: 'prep', stove: 'stove', grill: 'grill', cauldron: 'cauldron', coffee_machine: 'coffee_machine', assembly: 'assembly', pickup: 'pickup', fridge: 'fridge', oven: 'oven', sink: 'sink', storage: 'storage' } as Record<string, WorldAssetId>)[base] ?? 'prep';
}

const cellsForRect = (origin: GridPoint, size: GridPoint): GridPoint[] => {
  const cells: GridPoint[] = [];
  for (let y = 0; y < size.y; y += 1) for (let x = 0; x < size.x; x += 1) cells.push({ x: origin.x + x, y: origin.y + y });
  return cells;
};

export function createGraphicsSaveState(): GraphicsSaveState {
  const objects: PersistedWorldObject[] = STATIONS.map((item) => ({
    id: `station:${item.id}`, position: { ...item.position }, footprint: { width: item.size.x, depth: item.size.y },
    orientation: item.orientation, occupiedCells: cellsForRect(item.position, item.size), front: item.front,
    interactionPoints: item.interactionPoints.map((point) => ({ ...point })), requiredFreeCells: item.interactionPoints.map((point) => ({ ...point })),
    rotatable: item.rotatable, asset: item.asset, anchor: { ...item.anchor }, visualHeight: item.visualHeight, blocksMovement: item.blocksMovement,
    visualSkinId: item.visualSkinId, visualBounds: item.visualBounds, depthOffset: item.depthOffset,
  }));
  for (const item of createTables()) {
    objects.push({
      id: item.id, position: { ...item.position }, footprint: { width: 1, depth: 1 }, orientation: item.orientation,
      occupiedCells: [{ ...item.position }], front: 'sw', interactionPoints: [{ ...item.waiterApproach }], requiredFreeCells: [{ ...item.waiterApproach }],
      rotatable: true, asset: 'table', anchor: { x: .5, y: .85 }, visualHeight: 34, blocksMovement: true,
      visualSkinId: item.id.includes('sun') ? 'table-green' : 'table-oak',
      visualBounds: { widthCells: 1, depthCells: 1, heightBlocks: .8, overhangCells: .18 }, depthOffset: 0,
    });
    item.chairs.forEach((chair) => objects.push({
      id: chair.id, position: { ...chair.position }, footprint: { width: 1, depth: 1 }, orientation: chair.orientation,
      occupiedCells: [{ ...chair.position }], front: chair.orientation, interactionPoints: [{ ...chair.approach }], requiredFreeCells: [{ ...chair.approach }],
      rotatable: true, asset: `chair_${chair.orientation}`, anchor: { x: .5, y: .85 }, visualHeight: 38, blocksMovement: true, linkedTableId: item.id,
      visualSkinId: chair.visualSkinId, visualBounds: { widthCells: 1, depthCells: 1, heightBlocks: .9, overhangCells: .18 }, depthOffset: chair.depthOffset,
    }));
  }
  objects.push(...DECORATIONS.map((item) => ({ ...item, position: { ...item.position }, occupiedCells: item.occupiedCells.map((cell) => ({ ...cell })) })));
  return { dataVersion: 2, objects };
}
