import { describe, expect, it } from 'vitest';
import { RestaurantGrid } from '../game/grid/Grid';
import { findPath } from '../game/navigation/AStar';
import { createInitialGrid, createStations, createTables, ENTRANCE } from '../game/map/initialMap';
import { validateRestaurantMap } from '../game/map/validateMap';

describe('A* e mapa', () => {
  it('encontra caminho ao redor de bloqueios e nunca atravessa paredes', () => {
    const grid = new RestaurantGrid(6, 6);
    grid.setRect({ x: 2, y: 0 }, { x: 1, y: 5 }, { walkable: false, kind: 'wall' });
    const path = findPath(grid, { x: 0, y: 0 }, { x: 5, y: 0 });
    expect(path.length).toBeGreaterThan(0);
    expect(path.some((point) => point.x === 2 && point.y < 5)).toBe(false);
  });

  it('retorna vazio quando o destino é inalcançável', () => {
    const grid = new RestaurantGrid(3, 3);
    grid.set({ x: 1, y: 0 }, { walkable: false });
    grid.set({ x: 0, y: 1 }, { walkable: false });
    expect(findPath(grid, { x: 0, y: 0 }, { x: 2, y: 2 })).toEqual([]);
  });

  it('valida mesas, cadeiras, estações e ligação da entrada', () => {
    const tables = createTables();
    const stations = createStations();
    const grid = createInitialGrid(tables, stations);
    const result = validateRestaurantMap(grid, tables, stations);
    expect(result.errors).toEqual([]);
    expect(tables).toHaveLength(1);
    expect(tables.flatMap((table) => table.chairs)).toHaveLength(2);
    expect(tables.every((table) => table.accessible)).toBe(true);
    expect(findPath(grid, ENTRANCE, tables[0].waiterApproach).length).toBeGreaterThan(0);
  });

  it('marca mesa sem cadeira alcançável como inválida', () => {
    const tables = createTables();
    const stations = createStations();
    const grid = createInitialGrid(tables, stations);
    tables[0].chairs.forEach((chair) => grid.set(chair.approach, { walkable: false, kind: 'blocked' }));
    const result = validateRestaurantMap(grid, tables, stations);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('cadeira acessível'))).toBe(true);
  });
});
