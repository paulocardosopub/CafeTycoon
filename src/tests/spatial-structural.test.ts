import { describe, expect, it } from 'vitest';
import type { Direction, PlacedFurniture } from '../core/types';
import { FURNITURE_BY_ID } from '../game/data/furniture/catalog';
import { gridToWorld, worldToGrid } from '../game/grid/IsoGrid';
import { getFootprintCells, getSpriteAnchor, getWorkSlotCells, isIntegerGridPosition, snapToGrid } from '../game/grid/SpatialLayoutService';
import { createTablesFromConstruction, seatFacingTowardTable } from '../game/map/initialMap';
import { createDefaultState } from '../game/save/defaultState';
import { migrateAndSanitizeSave } from '../game/save/migrations';
import { orientedFootprint, occupiedCells, validateFurniturePlacement } from '../game/systems/furniture/FurniturePlacement';

function item(id: string, definitionId: string, gridX: number, gridY: number, orientation: Direction = 'sw', state: Record<string, unknown> = {}): PlacedFurniture {
  return { id, definitionId, gridX, gridY, orientation, skinId: 'default', level: 1, state };
}
function layout() {
  const state = createDefaultState(0);
  state.construction.placedFurniture = [
    item('table', 'dining.table.basic', 9, 11),
    item('chair:left', 'dining.chair.basic', 8, 11, 'se', { linkedTableId: 'table' }),
    item('chair:right', 'dining.chair.basic', 10, 11, 'nw', { linkedTableId: 'table' }),
    item('stove', 'cooking.a1.stove', 5, 5),
    item('counter', 'service.c1.isolated', 7, 5),
  ];
  return state;
}

describe('contrato espacial 0.0.10', () => {
  it('converte grid de forma determinística e normaliza coordenadas', () => {
    expect(worldToGrid(gridToWorld({ x: 7, y: 12 }))).toEqual({ x: 7, y: 12 });
    expect(snapToGrid({ x: 4.49, y: 8.51 })).toEqual({ x: 4, y: 9 });
  });
  it('mantém footprints lógicos canônicos, independentes do sprite', () => {
    expect(orientedFootprint(FURNITURE_BY_ID['dining.table.basic'], 'sw')).toEqual({ width: 1, depth: 1 });
    expect(orientedFootprint(FURNITURE_BY_ID['dining.chair.basic'], 'ne')).toEqual({ width: 1, depth: 1 });
    expect(orientedFootprint(FURNITURE_BY_ID['cooking.a1.stove'], 'se')).toEqual({ width: 1, depth: 1 });
    expect(getSpriteAnchor(FURNITURE_BY_ID['cooking.a1.stove'])).toEqual(FURNITURE_BY_ID['cooking.a1.stove'].baseAnchor);
  });
  it('deriva os tiles ocupados exatamente do footprint', () => {
    const stove = item('stove', 'cooking.a1.stove', 5, 5);
    expect(occupiedCells(stove)).toEqual([{ x: 5, y: 5 }]);
    expect(getFootprintCells({ x: 5, y: 5 }, orientedFootprint(FURNITURE_BY_ID['cooking.a1.stove'], 'sw'))).toEqual([{ x: 5, y: 5 }]);
  });
  it('rejeita posição fora da área e sobreposição sem alterar o layout', () => {
    const state = layout(); const before = structuredClone(state.construction.placedFurniture);
    expect(validateFurniturePlacement(item('outside', 'decor.plant.basic', 99, 99), state.construction.placedFurniture, state.construction.builtAreas).valid).toBe(false);
    expect(validateFurniturePlacement(item('collision', 'decor.plant.basic', 5, 5), state.construction.placedFurniture, state.construction.builtAreas).valid).toBe(false);
    expect(state.construction.placedFurniture).toEqual(before);
  });
  it('expõe work slot fora do interior lógico da estação', () => {
    const stove = item('stove', 'cooking.a1.stove', 5, 5);
    const slot = getWorkSlotCells(stove, FURNITURE_BY_ID['cooking.a1.stove'])[0];
    expect(slot).not.toEqual({ x: 5, y: 5 });
  });
  it('vincula capacidade da mesa a cadeiras reais e faces coerentes', () => {
    const table = createTablesFromConstruction(layout().construction)[0];
    expect(table.chairs).toHaveLength(2);
    expect(new Set(table.chairs.map((chair) => chair.id))).toEqual(new Set(['chair:left', 'chair:right']));
    expect(table.chairs.map((chair) => chair.orientation).sort()).toEqual(['nw', 'se']);
    expect(seatFacingTowardTable(table.chairs[0].position, table.position)).toBe(table.chairs[0].orientation);
  });
  it('não cria assento para cadeira inexistente', () => {
    const state = layout(); state.construction.placedFurniture = state.construction.placedFurniture.filter((entry) => entry.id !== 'chair:right');
    expect(createTablesFromConstruction(state.construction)[0].chairs).toHaveLength(1);
  });
  it('preserva tiles, direção e móveis sem duplicação após save/load', () => {
    const state = layout(); const once = migrateAndSanitizeSave(JSON.parse(JSON.stringify(state)), 10); const twice = migrateAndSanitizeSave(JSON.parse(JSON.stringify(once)), 20);
    expect(twice.construction.placedFurniture).toEqual(once.construction.placedFurniture);
    expect(once.construction.placedFurniture.every(isIntegerGridPosition)).toBe(true);
  });
});
