import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PlacedFurniture } from '../core/types';
import { createDefaultState } from '../game/save/defaultState';
import { ConstructionEditor } from '../game/systems/construction/ConstructionEditor';
import { occupiedCells, orientedFootprint, resolvedWorkSlots, validateFurniturePlacement } from '../game/systems/furniture/FurniturePlacement';
import { FURNITURE_BY_ID } from '../game/data/furniture/catalog';
import { calculateCounterConnections, modulesFromFurniture, ServiceCounterStore } from '../game/systems/service-counter/ServiceCounterSystem';
import { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';
import { INGREDIENTS } from '../content/ingredients/ingredients';

const item = (id: string, definitionId: string, gridX: number, gridY: number, orientation: PlacedFurniture['orientation'] = 'sw'): PlacedFurniture => ({
  id, definitionId, gridX, gridY, orientation, skinId: definitionId.includes('chair') ? 'chair-wood' : definitionId.includes('table') ? 'table-oak' : 'steel-standard', level: 1, state: {},
});

describe('editor isometrico ao vivo', () => {
  it('move os moveis diretamente sobre a cena sem mapa separado', () => {
    const shop = readFileSync(resolve(import.meta.dirname, '../ui/ConstructionShop.ts'), 'utf8');
    const scene = readFileSync(resolve(import.meta.dirname, '../scenes/RestaurantScene.ts'), 'utf8');
    const css = readFileSync(resolve(import.meta.dirname, '../styles.css'), 'utf8');
    expect(shop).toContain("gameEvents.on<{ x: number; y: number }>('construction:world-cell'");
    expect(shop).toContain("gameEvents.emit('construction:preview'");
    expect(shop).not.toContain('construction-grid-scroll');
    expect(scene).toContain('private renderConstructionPreview');
    expect(scene).toContain("gameEvents.emit('construction:world-item'");
    expect(scene).toContain("gameEvents.emit('construction:world-cell'");
    expect(css).toContain('.construction-live-overlay{background:transparent');
  });
});

describe('editor físico e loja da 0.0.5', () => {
  it('respeita footprint 1×1, 2×1 e rotação para 1×2', () => {
    const sink = FURNITURE_BY_ID['washing.b5.sink'];
    const stove = FURNITURE_BY_ID['cooking.a1.stove'];
    expect(orientedFootprint(sink, 'sw')).toEqual({ width: 1, depth: 1 });
    expect(orientedFootprint(stove, 'sw')).toEqual({ width: 2, depth: 1 });
    expect(orientedFootprint(stove, 'se')).toEqual({ width: 1, depth: 2 });
    expect(occupiedCells(item('a1', stove.id, 5, 5, 'se'))).toEqual(expect.arrayContaining([{ x: 5, y: 5 }, { x: 5, y: 6 }]));
  });

  it('rejeita colisão e preserva entrada, saída e workSlots', () => {
    const state = createDefaultState(0);
    const table = item('table:new', 'dining.table.basic', 8, 11);
    expect(validateFurniturePlacement(table, state.construction.placedFurniture, state.construction.builtAreas).valid).toBe(false);
    const entrance = item('table:door', 'dining.table.basic', 9, 17);
    expect(validateFurniturePlacement(entrance, state.construction.placedFurniture, state.construction.builtAreas).errors).toContain('A entrada e a saída precisam ficar livres.');
    expect(resolvedWorkSlots(state.construction.placedFurniture.find((entry) => entry.id === 'furniture:a1')!)).toHaveLength(2);
  });

  it('compra, liga cadeira à mesa, move, gira, guarda, vende, desfaz e refaz', () => {
    const state = createDefaultState(0); state.coins = 2_000;
    const editor = new ConstructionEditor(state);
    expect(editor.place('dining.table.basic', 12, 12).ok).toBe(true);
    const table = editor.draft.construction.placedFurniture.at(-1)!;
    expect(editor.place('dining.chair.basic', 11, 12).ok).toBe(true);
    const chair = editor.draft.construction.placedFurniture.at(-1)!;
    expect(chair.state.linkedTableId).toBe(table.id);
    expect(chair.state.seatFacing).toBe('se');
    expect(editor.move(chair.id, 13, 12).ok).toBe(true);
    expect(chair.state.linkedTableId).toBe(table.id);
    expect(chair.state.seatFacing).toBe('nw');
    expect(editor.rotate(table.id).ok).toBe(true);
    expect(editor.store(chair.id).ok).toBe(true);
    expect(editor.undo().ok).toBe(true);
    expect(editor.draft.construction.placedFurniture.some((entry) => entry.id === chair.id)).toBe(true);
    expect(editor.redo().ok).toBe(true);
    expect(editor.draft.construction.storedFurniture.some((entry) => entry.id === chair.id)).toBe(true);
    expect(editor.place('dining.chair.basic', 13, 12, 'sw', undefined, chair.id).ok).toBe(true);
    expect(editor.sell(chair.id).ok).toBe(true);
  });

  it('cancela transacionalmente e confirma apenas um restaurante operável', () => {
    const cancelledState = createDefaultState(0); cancelledState.coins = 2_000;
    const original = JSON.stringify(cancelledState.construction);
    const cancelled = new ConstructionEditor(cancelledState);
    expect(cancelled.place('decor.plant.basic', 14, 14).ok).toBe(true);
    expect(cancelled.cancel().ok).toBe(true);
    expect(JSON.stringify(cancelledState.construction)).toBe(original);

    const confirmedState = createDefaultState(0); confirmedState.coins = 2_000;
    const confirmed = new ConstructionEditor(confirmedState);
    expect(confirmed.place('decor.plant.basic', 14, 14).ok).toBe(true);
    expect(confirmed.confirm().ok).toBe(true);
    expect(confirmedState.construction.placedFurniture.some((entry) => entry.definitionId === 'decor.plant.basic' && entry.gridX === 14)).toBe(true);
  });

  it('compra expansões 4×4, 6×6 e 8×8 com pré-requisitos', () => {
    const state = createDefaultState(0); state.coins = 10_000; state.restaurantLevel = 3;
    const editor = new ConstructionEditor(state);
    expect(editor.buyExpansion('expansion-large-8x8', 'east').ok).toBe(false);
    expect(editor.buyExpansion('expansion-small-4x4', 'east').ok).toBe(true);
    expect(editor.buyExpansion('expansion-medium-6x6', 'east').ok).toBe(true);
    expect(editor.buyExpansion('expansion-large-8x8', 'east').ok).toBe(true);
    expect(editor.draft.construction.builtAreas.map((area) => [area.width, area.depth])).toEqual(expect.arrayContaining([[4, 4], [6, 6], [8, 8]]));
  });

  it('reposiciona a equipe somente em célula segura', () => {
    const state = createDefaultState(0);
    const editor = new ConstructionEditor(state);
    expect(editor.setStaffStart({ staffId: 'cook-0', gridX: 4, gridY: 2, facing: 'ne', returnWhenIdle: true }).ok).toBe(false);
    expect(editor.setStaffStart({ staffId: 'cook-0', gridX: 14, gridY: 14, facing: 'ne', returnWhenIdle: true }).ok).toBe(true);
  });

  it('contrata novos funcionários, cobra uma vez e permite direcioná-los no salão', () => {
    const state = createDefaultState(0); state.coins = 2_000;
    const editor = new ConstructionEditor(state);
    expect(editor.hireStaff('cook-1').ok).toBe(true);
    expect(editor.draft.coins).toBe(1_550);
    expect(editor.hireStaff('cook-1').ok).toBe(false);
    expect(editor.setStaffStart({ staffId: 'cook-1', gridX: 14, gridY: 14, facing: 'sw', returnWhenIdle: true }).ok).toBe(true);
    expect(editor.confirm().ok).toBe(true);
    const simulation = new RestaurantSimulation(state);
    expect(simulation.actors.filter((actor) => actor.kind === 'cook')).toHaveLength(2);
    expect(simulation.actors.find((actor) => actor.assetId === 'cook-1')?.position).toEqual({ x: 14, y: 14 });
  });

  it('mantém módulos 1×1 conectados e estoque reservado atomicamente sem negativo', () => {
    const furniture = [item('c1', 'service.c1.isolated', 5, 8), item('c2', 'service.c2.left', 6, 8), item('c3', 'service.c3.middle', 7, 8), item('c4', 'service.c4.right', 8, 8)];
    const modules = calculateCounterConnections(modulesFromFurniture(furniture)).map((module) => ({ ...module, assignedRecipeId: 'omelette' as const, currentQuantity: 5 }));
    expect(modules.every((module) => FURNITURE_BY_ID[furniture.find((entry) => entry.id === module.id)!.definitionId].footprintWidth === 1)).toBe(true);
    expect(modules.map((module) => module.connectionVariant)).toEqual(['left', 'middle', 'middle', 'right']);
    const store = new ServiceCounterStore(modules);
    expect(store.total('omelette')).toBe(20);
    const reservation = store.reserve('omelette', 12)!;
    expect(reservation.reduce((sum, part) => sum + part.quantity, 0)).toBe(12);
    expect(store.reserve('omelette', 9)).toBeUndefined();
    expect(store.consume(reservation)).toBe(true);
    expect(modules.every((module) => module.currentQuantity >= 0 && module.reservedQuantity >= 0)).toBe(true);
  });

  it('oferece somente receitas possíveis com os equipamentos e balcões instalados', () => {
    const state = createDefaultState(0);
    for (const ingredient of INGREDIENTS) state.inventory[ingredient.id] = ingredient.maxStock;
    const simulation = new RestaurantSimulation(state); simulation.debugSetAutoSpawn(false);
    simulation.debugSeatGroupAtFirstTable(1); simulation.debugRunFor(10);
    expect(simulation.orders.length).toBeGreaterThan(0);
    expect(new Set(simulation.orders.map((order) => order.recipeId))).toEqual(new Set(['omelette']));
  });
});
