import { describe, expect, it } from 'vitest';
import { createInitialConstructionState } from '../game/map/initialConstruction';
import { createInitialGrid, ENTRANCE, STREET_ENTRY_POINTS } from '../game/map/initialMap';
import { validateFurniturePlacement } from '../game/systems/furniture/FurniturePlacement';
import type { PlacedFurniture } from '../core/types';

describe('paredes nas arestas externas', () => {
  it('mantém o tile de borda utilizável e bloqueia somente o exterior', () => {
    const construction = createInitialConstructionState();
    const grid = createInitialGrid([], [], construction);
    expect(grid.get({ x: 0, y: 0 })).toMatchObject({ kind: 'floor', walkable: true });
    expect(grid.get({ x: 17, y: 0 })).toMatchObject({ kind: 'floor', walkable: true });
    expect(grid.get({ x: 18, y: 0 })).toMatchObject({ kind: 'outside', walkable: false });
    expect(grid.get(ENTRANCE)?.walkable).toBe(true);
    expect(grid.get(STREET_ENTRY_POINTS[0])?.walkable).toBe(true);
  });

  it('remove a antiga parede lógica quando uma expansão incorpora a célula', () => {
    const construction = createInitialConstructionState();
    construction.builtAreas.push({ id: 'area:test', x: 18, y: 0, width: 18, depth: 18, kind: 'expansion' });
    const grid = createInitialGrid([], [], construction);
    expect(grid.get({ x: 18, y: 0 })).toMatchObject({ kind: 'floor', walkable: true });
  });

  it('permite posicionar móveis na primeira linha junto às duas paredes', () => {
    const construction = createInitialConstructionState();
    const table = (gridX: number, gridY: number): PlacedFurniture => ({
      id: `table:${gridX}:${gridY}`, definitionId: 'dining.table.basic', gridX, gridY,
      orientation: 'sw', skinId: 'table-oak', level: 1, state: {},
    });
    for (const point of [{ x: 0, y: 0 }, { x: 17, y: 0 }, { x: 0, y: 17 }]) {
      const result = validateFurniturePlacement(table(point.x, point.y), [], construction.builtAreas);
      expect(result.valid, result.errors.join('; ')).toBe(true);
    }
  });
});
