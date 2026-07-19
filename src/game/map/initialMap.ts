import type { ChairRuntime, Direction, GraphicsSaveState, GridPoint, PersistedWorldObject, StationRuntime, TableRuntime } from '../../core/types';
import { STATIONS } from '../../content/stations/stations';
import { RestaurantGrid } from '../grid/Grid';

export const RESTAURANT_SIZE = { width: 18, height: 18 } as const;
export const MAP_SIZE = { width: 18, height: 22 } as const;
export const ENTRANCE: GridPoint = { x: 9, y: 17 };
export const EXIT: GridPoint = { x: 10, y: 17 };
export const STREET_ENTRY_POINTS: GridPoint[] = [{ x: 3, y: 21 }, { x: 7, y: 21 }, { x: 13, y: 21 }];
export const STREET_EXIT: GridPoint = { x: 16, y: 21 };
export const CUSTOMER_QUEUE: GridPoint[] = [{ x: 9, y: 16 }, { x: 10, y: 16 }, { x: 11, y: 16 }, { x: 12, y: 16 }];
export const PICKUP_KITCHEN_POINT: GridPoint = { x: 7, y: 6 };
export const PICKUP_SERVICE_POINT: GridPoint = { x: 7, y: 8 };

const decoration = (id: string, asset: PersistedWorldObject['asset'], position: GridPoint, visualHeight: number, blocksMovement = true): PersistedWorldObject => ({
  id, asset, position, footprint: { width: 1, depth: 1 }, orientation: 'sw', occupiedCells: blocksMovement ? [{ ...position }] : [],
  front: 'sw', interactionPoints: [], requiredFreeCells: [], rotatable: false, anchor: { x: .5, y: asset === 'door' || asset === 'shelf' ? 1 : .85 }, visualHeight, blocksMovement,
});

export const DECORATIONS: PersistedWorldObject[] = [
  decoration('decor:plant-a', 'plant', { x: 0, y: 6 }, 62),
  decoration('decor:plant-b', 'plant', { x: 0, y: 13 }, 62),
  decoration('decor:bin', 'bin', { x: 16, y: 7 }, 39),
];

const towardTable = (chair: GridPoint, table: GridPoint): Direction => {
  if (chair.x < table.x) return 'se';
  if (chair.x > table.x) return 'nw';
  if (chair.y < table.y) return 'sw';
  return 'ne';
};

function createChair(tableId: string, suffix: string, position: GridPoint, tablePosition: GridPoint, approach: GridPoint): ChairRuntime {
  return {
    id: `${tableId}-chair-${suffix}`, tableId, position, approach, sitPoint: { ...position },
    state: 'free', orientation: towardTable(position, tablePosition),
  };
}

function table(id: string, label: string, position: GridPoint, seats: 2 | 4, waiterApproach: GridPoint): TableRuntime {
  const chairSpecs = seats === 2
    ? [
      { suffix: 'west', position: { x: position.x - 1, y: position.y }, approach: { x: position.x - 1, y: position.y - 1 } },
      { suffix: 'east', position: { x: position.x + 1, y: position.y }, approach: { x: position.x + 1, y: position.y + 1 } },
    ]
    : [
      { suffix: 'north', position: { x: position.x, y: position.y - 1 }, approach: { x: position.x - 1, y: position.y - 1 } },
      { suffix: 'south', position: { x: position.x, y: position.y + 1 }, approach: { x: position.x + 1, y: position.y + 1 } },
      { suffix: 'west', position: { x: position.x - 1, y: position.y }, approach: { x: position.x - 1, y: position.y + 1 } },
      { suffix: 'east', position: { x: position.x + 1, y: position.y }, approach: { x: position.x + 1, y: position.y - 1 } },
    ];
  const chairs = chairSpecs.map((spec) => createChair(id, spec.suffix, spec.position, position, spec.approach));
  return {
    id, label, position, size: { x: 1, y: 1 }, waiterApproach, maxCustomers: seats, state: 'free', accessible: true,
    chairs, orientation: 'sw', asset: 'table', occupiedCells: [{ ...position }, ...chairs.map((chair) => ({ ...chair.position }))],
  };
}

export function createTables(): TableRuntime[] {
  return [
    table('table-garden-2', 'Mesa Jardim', { x: 4, y: 11 }, 2, { x: 4, y: 10 }),
    table('table-sun-4', 'Mesa Sol', { x: 11, y: 11 }, 4, { x: 13, y: 12 }),
    table('table-rose-2', 'Mesa Rosa', { x: 3, y: 15 }, 2, { x: 3, y: 14 }),
    table('table-moon-4', 'Mesa Lua', { x: 13, y: 14 }, 4, { x: 15, y: 14 }),
  ];
}

export function createStations(): StationRuntime[] {
  return STATIONS.map((item) => ({ ...item, interactionPoints: item.interactionPoints.map((point) => ({ ...point })), state: 'free', queue: [], remaining: 0, level: 1 }));
}

export function createInitialGrid(tables = createTables()): RestaurantGrid {
  const grid = new RestaurantGrid(MAP_SIZE.width, MAP_SIZE.height);
  for (let x = 0; x < RESTAURANT_SIZE.width; x += 1) {
    grid.set({ x, y: 0 }, { kind: 'wall', walkable: false });
    if (x !== ENTRANCE.x && x !== EXIT.x) grid.set({ x, y: RESTAURANT_SIZE.height - 1 }, { kind: 'wall', walkable: false });
  }
  for (let y = 0; y < RESTAURANT_SIZE.height; y += 1) {
    grid.set({ x: 0, y }, { kind: 'wall', walkable: false });
    grid.set({ x: RESTAURANT_SIZE.width - 1, y }, { kind: 'wall', walkable: false });
  }
  grid.set(ENTRANCE, { kind: 'entrance', walkable: true });
  grid.set(EXIT, { kind: 'exit', walkable: true });

  STATIONS.forEach((item) => {
    grid.setRect(item.position, item.size, { kind: 'blocked', walkable: false, stationPart: item.id });
    item.interactionPoints.forEach((point, index) => grid.set(point, { reservedFor: `station:${item.id}:${index}` }));
  });
  tables.forEach((item) => {
    grid.set(item.position, { kind: 'blocked', walkable: false, furniturePart: item.id });
    item.chairs.forEach((chair) => grid.set(chair.position, { kind: 'blocked', walkable: false, furniturePart: chair.id }));
    grid.set(item.waiterApproach, { reservedFor: `table:${item.id}:waiter` });
  });
  DECORATIONS.filter((item) => item.blocksMovement).forEach((item) => grid.set(item.position, { kind: 'blocked', walkable: false, furniturePart: item.id }));
  return grid;
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
  }));
  for (const item of createTables()) {
    objects.push({
      id: item.id, position: { ...item.position }, footprint: { width: 1, depth: 1 }, orientation: item.orientation,
      occupiedCells: [{ ...item.position }], front: 'sw', interactionPoints: [{ ...item.waiterApproach }], requiredFreeCells: [{ ...item.waiterApproach }],
      rotatable: true, asset: 'table', anchor: { x: .5, y: .85 }, visualHeight: 34, blocksMovement: true,
    });
    item.chairs.forEach((chair) => objects.push({
      id: chair.id, position: { ...chair.position }, footprint: { width: 1, depth: 1 }, orientation: chair.orientation,
      occupiedCells: [{ ...chair.position }], front: chair.orientation, interactionPoints: [{ ...chair.approach }], requiredFreeCells: [{ ...chair.approach }],
      rotatable: true, asset: `chair_${chair.orientation}`, anchor: { x: .5, y: .85 }, visualHeight: 38, blocksMovement: true, linkedTableId: item.id,
    }));
  }
  objects.push(...DECORATIONS.map((item) => ({ ...item, position: { ...item.position }, occupiedCells: item.occupiedCells.map((cell) => ({ ...cell })) })));
  return { dataVersion: 2, objects };
}
