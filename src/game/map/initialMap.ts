import type { GridPoint, StationRuntime, TableRuntime } from '../../core/types';
import { STATIONS } from '../../content/stations/stations';
import { RestaurantGrid } from '../grid/Grid';

export const MAP_SIZE = { width: 18, height: 18 } as const;
export const ENTRANCE: GridPoint = { x: 9, y: 17 };
export const EXIT: GridPoint = { x: 10, y: 17 };
export const CUSTOMER_QUEUE: GridPoint[] = [{ x: 9, y: 16 }, { x: 10, y: 16 }, { x: 11, y: 16 }, { x: 12, y: 16 }];

export function createTables(): TableRuntime[] {
  return [
    {
      id: 'table-garden-2', label: 'Mesa Jardim', position: { x: 4, y: 11 }, size: { x: 2, y: 2 },
      waiterApproach: { x: 6, y: 11 }, maxCustomers: 2, state: 'free', accessible: true,
      chairs: [
        { id: 'chair-garden-a', position: { x: 4, y: 10 }, approach: { x: 3, y: 10 }, state: 'free' },
        { id: 'chair-garden-b', position: { x: 5, y: 13 }, approach: { x: 6, y: 13 }, state: 'free' },
      ],
    },
    {
      id: 'table-sun-4', label: 'Mesa Sol', position: { x: 11, y: 10 }, size: { x: 2, y: 2 },
      waiterApproach: { x: 10, y: 11 }, maxCustomers: 4, state: 'free', accessible: true,
      chairs: [
        { id: 'chair-sun-a', position: { x: 11, y: 9 }, approach: { x: 10, y: 9 }, state: 'free' },
        { id: 'chair-sun-b', position: { x: 13, y: 10 }, approach: { x: 14, y: 10 }, state: 'free' },
        { id: 'chair-sun-c', position: { x: 12, y: 12 }, approach: { x: 13, y: 13 }, state: 'free' },
        { id: 'chair-sun-d', position: { x: 10, y: 10 }, approach: { x: 9, y: 10 }, state: 'free' },
      ],
    },
  ];
}

export function createStations(): StationRuntime[] {
  return STATIONS.map((station) => ({ ...station, state: 'free', queue: [], remaining: 0, level: 1 }));
}

export function createInitialGrid(tables = createTables()): RestaurantGrid {
  const grid = new RestaurantGrid(MAP_SIZE.width, MAP_SIZE.height);
  for (let x = 0; x < MAP_SIZE.width; x += 1) {
    grid.set({ x, y: 0 }, { kind: 'wall', walkable: false });
    if (x !== ENTRANCE.x && x !== EXIT.x) grid.set({ x, y: MAP_SIZE.height - 1 }, { kind: 'wall', walkable: false });
  }
  for (let y = 0; y < MAP_SIZE.height; y += 1) {
    grid.set({ x: 0, y }, { kind: 'wall', walkable: false });
    grid.set({ x: MAP_SIZE.width - 1, y }, { kind: 'wall', walkable: false });
  }
  grid.set(ENTRANCE, { kind: 'entrance', walkable: true });
  grid.set(EXIT, { kind: 'exit', walkable: true });

  STATIONS.forEach((station) => {
    grid.setRect(station.position, station.size, { kind: 'blocked', walkable: false, stationPart: station.id });
    grid.set(station.interaction, { reservedFor: `station:${station.id}` });
  });
  tables.forEach((table) => {
    grid.setRect(table.position, table.size, { kind: 'blocked', walkable: false, furniturePart: table.id });
    table.chairs.forEach((chair) => grid.set(chair.position, { kind: 'blocked', walkable: false, furniturePart: chair.id }));
    grid.set(table.waiterApproach, { reservedFor: `table:${table.id}:waiter` });
  });
  return grid;
}
