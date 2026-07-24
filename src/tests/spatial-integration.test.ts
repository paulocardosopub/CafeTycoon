import { describe, expect, it } from 'vitest';
import type { Direction, PlacedFurniture } from '../core/types';
import { FURNITURE_BY_ID } from '../game/data/furniture/catalog';
import { createDefaultState } from '../game/save/defaultState';
import { migrateAndSanitizeSave } from '../game/save/migrations';
import { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';
import { ConstructionEditor } from '../game/systems/construction/ConstructionEditor';
import { occupiedCells } from '../game/systems/furniture/FurniturePlacement';
import { modulesFromFurniture } from '../game/systems/service-counter/ServiceCounterSystem';

function stored(id: string, definitionId: string): PlacedFurniture { return { id, definitionId, gridX: 0, gridY: 0, orientation: 'sw', skinId: FURNITURE_BY_ID[definitionId].skinIds[0], level: 1, state: {} }; }
function editorWithStored() {
  const state = createDefaultState(0); state.construction.placedFurniture = [];
  state.construction.storedFurniture = [stored('table', 'dining.table.basic'), stored('chair-a', 'dining.chair.basic'), stored('chair-b', 'dining.chair.basic'), stored('coffee', 'cooking.a8.coffee'), stored('sink', 'washing.b5.sink'), stored('counter', 'service.c1.isolated')];
  return { state, editor: new ConstructionEditor(state) };
}
function place(editor: ConstructionEditor, definitionId: string, id: string, x: number, y: number, orientation: Direction = 'sw') { return editor.place(definitionId, x, y, orientation, undefined, id); }
function completeSetup(editor: ConstructionEditor) {
  place(editor, 'service.c1.isolated', 'counter', 7, 5); place(editor, 'washing.b5.sink', 'sink', 9, 5);
  place(editor, 'dining.table.basic', 'table', 9, 11); place(editor, 'dining.chair.basic', 'chair-a', 8, 11, 'se'); place(editor, 'dining.chair.basic', 'chair-b', 10, 11, 'nw');
}

describe('integração espacial 0.0.10', () => {
  it('posiciona dentro da área e confirma a posição válida', () => {
    const { state, editor } = editorWithStored();
    expect(place(editor, 'cooking.a8.coffee', 'coffee', 5, 5).ok).toBe(true);
    completeSetup(editor);
    expect(editor.confirm().ok).toBe(true);
    expect(state.construction.placedFurniture.find((entry) => entry.id === 'coffee')).toMatchObject({ gridX: 5, gridY: 5, orientation: 'sw' });
  });
  it('rejeita fora dos limites e colisão sem mutação parcial', () => {
    const { editor } = editorWithStored();
    expect(place(editor, 'cooking.a8.coffee', 'coffee', 5, 5).ok).toBe(true);
    const before = structuredClone(editor.draft.construction);
    expect(place(editor, 'service.c1.isolated', 'counter', 99, 99).ok).toBe(false);
    expect(place(editor, 'service.c1.isolated', 'counter', 5, 5).ok).toBe(false);
    expect(editor.draft.construction).toEqual(before);
  });
  it('move libera apenas o footprint anterior e não deixa tile fantasma', () => {
    const { editor } = editorWithStored(); place(editor, 'cooking.a8.coffee', 'coffee', 5, 5);
    expect(editor.move('coffee', 6, 5).ok).toBe(true);
    const coffee = editor.draft.construction.placedFurniture.find((entry) => entry.id === 'coffee')!;
    expect(occupiedCells(coffee)).toEqual([{ x: 6, y: 5 }]);
    expect(place(editor, 'service.c1.isolated', 'counter', 5, 5).ok).toBe(true);
  });
  it('callbacks espaciais repetidos não duplicam a ocupação', () => {
    const { editor } = editorWithStored(); place(editor, 'cooking.a8.coffee', 'coffee', 5, 5);
    expect(editor.move('coffee', 6, 5).ok).toBe(true); expect(editor.move('coffee', 6, 5).ok).toBe(true);
    expect(editor.draft.construction.placedFurniture.filter((entry) => entry.id === 'coffee')).toHaveLength(1);
  });
  it('confirma e cancela prévia sem alterar o estado salvo antes da confirmação', () => {
    const { state, editor } = editorWithStored(); place(editor, 'cooking.a8.coffee', 'coffee', 5, 5); completeSetup(editor); editor.confirm();
    editor.previewFurnitureMove('coffee', 6, 5); expect(state.construction.placedFurniture.find((entry) => entry.id === 'coffee')?.gridX).toBe(5);
    editor.cancelFurnitureEdit(); expect(editor.draft.construction.placedFurniture.find((entry) => entry.id === 'coffee')?.gridX).toBe(5);
  });
  it('save/load preserva posição e direção sem duplicação', () => {
    const { state, editor } = editorWithStored(); place(editor, 'cooking.a8.coffee', 'coffee', 5, 5, 'ne'); completeSetup(editor); editor.confirm();
    const restored = migrateAndSanitizeSave(JSON.parse(JSON.stringify(state)), 10);
    expect(restored.construction.placedFurniture.filter((entry) => entry.id === 'coffee')).toEqual([expect.objectContaining({ gridX: 5, gridY: 5, orientation: 'ne' })]);
  });
  it('expõe interação de estação e lados ativos do balcão', () => {
    const { state, editor } = editorWithStored(); place(editor, 'cooking.a8.coffee', 'coffee', 5, 5); completeSetup(editor); editor.confirm();
    const simulation = new RestaurantSimulation(state); const station = simulation.stations.find((entry) => entry.id.startsWith('coffee_machine'))!;
    expect(occupiedCells({ ...state.construction.placedFurniture.find((entry) => entry.id === 'coffee')! })).not.toContainEqual(station.interaction);
    expect(state.construction.serviceCounters = modulesFromFurniture(state.construction.placedFurniture)).toHaveLength(1);
  });
  it('clientes usam cadeiras reais, orientação coerente e fluxo individual', () => {
    const state = createDefaultState(0); state.construction.placedFurniture = [
      { ...stored('table', 'dining.table.basic'), gridX: 9, gridY: 11 },
      { ...stored('chair-a', 'dining.chair.basic'), gridX: 8, gridY: 11, orientation: 'se', state: { linkedTableId: 'table' } },
      { ...stored('chair-b', 'dining.chair.basic'), gridX: 10, gridY: 11, orientation: 'nw', state: { linkedTableId: 'table' } },
    ];
    const simulation = new RestaurantSimulation(state); simulation.debugSetAutoSpawn(false);
    const first = simulation.debugSeatCustomersAtFirstTable(1)[0]; const second = simulation.debugAddCustomer()!; simulation.debugRunFor(1);
    expect(first.seatId).toBeDefined(); expect(first.direction).toBe(simulation.tables[0].chairs.find((chair) => chair.seatId === first.seatId)?.orientation);
    expect(first.id).not.toBe(second.id); expect('partyId' in first).toBe(false);
  });
});
