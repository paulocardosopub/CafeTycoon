import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VISUAL_METRICS, depthAtBase } from '../assets/pixel/VisualMetrics';
import type { Direction, GameState, PlacedFurniture } from '../core/types';
import { FURNITURE_BY_ID, FURNITURE_DEFINITIONS } from '../game/data/furniture/catalog';
import { gridToScreen, gridToWorld, screenToGrid, worldToGrid } from '../game/grid/IsoGrid';
import {
  FURNITURE_VISUAL_METRICS, canPlaceAt, getApproachSlotCells, getAttachedChairCells, getDepthOrder,
  getFootprintCells, getFootprintCenter, getRotatedFootprint, getSeatSlotCells, getSpriteAnchor,
  getFootprintFloorAnchorWorld, getVisualBounds, getVisualScale, getWorkSlotCells, isIntegerGridPosition, snapToGrid,
} from '../game/grid/SpatialLayoutService';
import { createInitialConstructionState } from '../game/map/initialConstruction';
import { createTablesFromConstruction, seatFacingTowardTable } from '../game/map/initialMap';
import { migrateAndSanitizeSave } from '../game/save/migrations';
import { createDefaultState } from '../game/save/defaultState';
import { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';
import { characterMotionState } from '../game/systems/animation/CharacterAnimationState';
import { characterFacingState, facingBetweenTargets, facingFromScreenVector, movementVectors, screenFacingFromVector } from '../game/systems/animation/CharacterFacing';
import { ConstructionEditor } from '../game/systems/construction/ConstructionEditor';
import { occupiedCells, orientedFootprint, resolvedWorkSlots, validateFurniturePlacement } from '../game/systems/furniture/FurniturePlacement';

const item = (id: string, definitionId: string, x: number, y: number, orientation: Direction = 'sw', state: Record<string, unknown> = {}): PlacedFurniture => ({
  id, definitionId, gridX: x, gridY: y, orientation, skinId: definitionId.includes('chair') ? 'chair-wood' : definitionId.includes('table') ? 'table-oak' : 'steel-standard', level: 1, state,
});
const initial = () => createDefaultState(1_000);
const tableItem = (state: GameState) => state.construction.placedFurniture.find((entry) => entry.definitionId === 'dining.table.basic')!;
const chairItems = (state: GameState) => state.construction.placedFurniture.filter((entry) => entry.definitionId === 'dining.chair.basic');

describe('correção estrutural — 60 requisitos unitários', () => {
  it('01 converte grid → mundo → grid', () => { const point = { x: 7, y: 12 }; expect(worldToGrid(gridToWorld(point))).toEqual(point); });
  it('02 faz snap para coordenadas inteiras', () => expect(snapToGrid({ x: 4.49, y: 8.51 })).toEqual({ x: 4, y: 9 }));
  it('03 mantém mesa pequena em 1×1', () => expect(getRotatedFootprint(FURNITURE_BY_ID['dining.table.basic'], 'sw')).toEqual({ width: 1, depth: 1 }));
  it('04 mantém cadeira em 1×1', () => expect(getRotatedFootprint(FURNITURE_BY_ID['dining.chair.basic'], 'ne')).toEqual({ width: 1, depth: 1 }));
  it('05 limita cada mesa a duas cadeiras', () => expect(createTablesFromConstruction(initial().construction)[0].chairs).toHaveLength(2));
  it('06 liga cadeiras em lados opostos', () => { const table = createTablesFromConstruction(initial().construction)[0]; expect(table.chairs[0].position.x + table.chairs[1].position.x).toBe(table.position.x * 2); expect(table.chairs[0].position.y + table.chairs[1].position.y).toBe(table.position.y * 2); });
  it('07 reconhece conjunto horizontal', () => { const state = initial(); const table = tableItem(state); expect(chairItems(state).map((chair) => chair.gridY)).toEqual([table.gridY, table.gridY]); });
  it('08 reconhece conjunto vertical', () => { const state = initial(); const table = tableItem(state); const editor = new ConstructionEditor(state); editor.beginFurnitureEdit(table.id); expect(editor.previewFurnitureRotation(table.id).ok).toBe(true); expect(new Set(editor.draft.construction.placedFurniture.filter((entry) => entry.state.linkedTableId === table.id).map((chair) => chair.gridX))).toEqual(new Set([table.gridX])); });
  it('09 rotaciona o conjunto de forma atômica', () => { const state = initial(); const table = tableItem(state); const editor = new ConstructionEditor(state); editor.beginFurnitureEdit(table.id); editor.previewFurnitureRotation(table.id); expect(editor.editSession?.previewAttachedFurniture).toHaveLength(2); });
  it('10 calcula cliente sentado olhando para a mesa', () => expect(seatFacingTowardTable({ x: 7, y: 11 }, { x: 8, y: 11 })).toBe('se'));
  it('11 nunca usa facing oposto ao vetor para a mesa', () => expect(facingBetweenTargets({ x: 9, y: 11 }, { x: 8, y: 11 })).toBe('nw'));
  it('12 centraliza o SeatSlot no tile da cadeira', () => { const chair = createTablesFromConstruction(initial().construction)[0].chairs[0]; expect(chair.seatAnchor).toEqual(chair.position); });
  it('12b mantém pratos sujos dos dois lados sobre o tampo da mesa', () => { const state = initial(); state.construction.placedFurniture = [item('t','dining.table.basic',9,11), item('c1','dining.chair.basic',8,11,'se',{linkedTableId:'t'}), item('c2','dining.chair.basic',10,11,'nw',{linkedTableId:'t'})]; const table = createTablesFromConstruction(state.construction)[0]; expect(table.chairs.every((chair) => chair.dirtPosition.x === table.position.x && chair.dirtPosition.y === table.position.y)).toBe(true); });
  it('13 libera SeatSlot ao levantar', () => { const sim = new RestaurantSimulation(initial()); sim.debugSetAutoSpawn(false); const customer = sim.debugSeatGroupAtFirstTable(1)[0]; const seat = sim.tables[0].chairs[0]; sim.debugBeginDeparture(customer); expect(seat.customerId).toBeUndefined(); });
  it('14 inicia a saída a partir do ApproachSlot lógico', () => { const sim = new RestaurantSimulation(initial()); sim.debugSetAutoSpawn(false); const customer = sim.debugSeatGroupAtFirstTable(1)[0]; const approach = { ...sim.tables[0].chairs[0].approach }; sim.debugBeginDeparture(customer); expect(customer.position).toEqual(approach); });
  it('15 movimento para baixo usa frente', () => expect(screenFacingFromVector({ x: 0, y: 10 })).toBe('front'));
  it('16 movimento para cima usa costas', () => expect(screenFacingFromVector({ x: 0, y: -10 })).toBe('back'));
  it('17 movimento à esquerda usa esquerda', () => expect(screenFacingFromVector({ x: -10, y: 0 })).toBe('left'));
  it('18 movimento à direita usa direita', () => expect(screenFacingFromVector({ x: 10, y: 0 })).toBe('right'));
  it('19 converte primeiro o vetor isométrico', () => expect(movementVectors({ x: 4, y: 4 }, { x: 4, y: 5 }).screen).toEqual({ x: -32, y: 16 }));
  it('20 mantém timestamp sem flicker quando a direção não muda', () => expect(characterFacingState({ currentFacing: 'se', from: { x: 1, y: 1 }, target: { x: 2, y: 1 }, action: 'walking', lastDirectionChangeAt: 44, now: 99 }).lastDirectionChangeAt).toBe(44));
  it('21 impede moonwalk ao derivar facing do vetor visual', () => expect(facingFromScreenVector({ x: -32, y: 16 })).toBe('sw'));
  it('22 personagem parado não usa walk', () => expect(characterMotionState({ pathStatus: 'arrived', motionState: 'walk' })).toBe('idle'));
  it('23 cooking olha para o equipamento', () => expect(characterFacingState({ currentFacing: 'sw', from: { x: 4, y: 3 }, target: { x: 4, y: 2 }, action: 'cooking', animationKey: 'cook' }).currentFacing).toBe('ne'));
  it('24 serving olha para o destino', () => expect(characterFacingState({ currentFacing: 'ne', from: { x: 7, y: 10 }, target: { x: 8, y: 11 }, action: 'serving', animationKey: 'serve' }).screenFacing).toBe('front'));
  it('25 talking produz facings recíprocos', () => { const a = facingBetweenTargets({ x: 4, y: 4 }, { x: 5, y: 4 }); const b = facingBetweenTargets({ x: 5, y: 4 }, { x: 4, y: 4 }); expect([a, b]).toEqual(['se', 'nw']); });
  it('26 define fogão 1×1', () => expect(orientedFootprint(FURNITURE_BY_ID['cooking.a1.stove'], 'sw')).toEqual({ width: 1, depth: 1 }));
  it('27 mantém fogão 1×1 rotacionado', () => expect(orientedFootprint(FURNITURE_BY_ID['cooking.a1.stove'], 'se')).toEqual({ width: 1, depth: 1 }));
  it('28 define pia 1×1', () => expect(orientedFootprint(FURNITURE_BY_ID['washing.b5.sink'], 'sw')).toEqual({ width: 1, depth: 1 }));
  it('29 mantém pia 1×1 rotacionada', () => expect(orientedFootprint(FURNITURE_BY_ID['washing.b5.sink'], 'se')).toEqual({ width: 1, depth: 1 }));
  it('30 mantém balcão modular 1×1', () => expect(orientedFootprint(FURNITURE_BY_ID['service.c1.isolated'], 'nw')).toEqual({ width: 1, depth: 1 }));
  it('31 iguala altura de STANDARD_COUNTER', () => expect(new Set(FURNITURE_DEFINITIONS.filter((definition) => definition.heightCategory === 'STANDARD_COUNTER').map((definition) => definition.visualBounds.heightBlocks))).toEqual(new Set([FURNITURE_VISUAL_METRICS.standardCounterHeight])));
  it('32 classifica geladeira como TALL', () => expect(FURNITURE_BY_ID['refrigeration.b1.fridge'].heightCategory).toBe('TALL'));
  it('33 classifica despensa como TALL', () => expect(FURNITURE_BY_ID['storage.c5.pantry'].heightCategory).toBe('TALL'));
  it('34 preserva proporção com escala uniforme', () => expect(getVisualScale(FURNITURE_BY_ID['cooking.a1.stove'])).toBe(FURNITURE_VISUAL_METRICS.categoryScale.STANDARD_COUNTER));
  it('35 alinha o topo lógico das bancadas', () => expect(getVisualBounds(item('a','cooking.a1.stove',2,2), FURNITURE_BY_ID['cooking.a1.stove']).heightPixels).toBe(getVisualBounds(item('b','washing.b5.sink',5,2), FURNITURE_BY_ID['washing.b5.sink']).heightPixels));
  it('36 valida footprint inteiro', () => { const state = initial(); const candidate = item('new','decor.plant.basic',15,15); expect(validateFurniturePlacement(candidate, state.construction.placedFurniture, state.construction.builtAreas).valid).toBe(true); });
  it('37 bloqueia fora da área', () => { const state = initial(); expect(validateFurniturePlacement(item('new','decor.plant.basic',30,30), state.construction.placedFurniture, state.construction.builtAreas).valid).toBe(false); });
  it('38 bloqueia colisão', () => { const state = initial(); expect(validateFurniturePlacement(item('new','decor.plant.basic',8,11), state.construction.placedFurniture, state.construction.builtAreas).errors.some((error) => error.includes('sobrepõe'))).toBe(true); });
  it('39 bloqueia cadeira sem vínculo válido ao confirmar', () => { const state = initial(); const editor = new ConstructionEditor(state); expect(editor.place('dining.chair.basic', 15, 15).ok).toBe(true); expect(editor.confirm().ok).toBe(false); });
  it('40 bloqueia WorkSlot inacessível', () => { const state = initial(); const candidate = item('new','preparation.b3.counter',16,16); expect(validateFurniturePlacement(candidate, state.construction.placedFurniture, state.construction.builtAreas).valid).toBe(false); });
  it('41 movimento por clique cria prévia', () => { const state = initial(); const editor = new ConstructionEditor(state); const table = tableItem(state); editor.beginFurnitureEdit(table.id); editor.previewFurnitureMove(table.id, 8, 13); expect(editor.editSession?.previewGridPosition).toEqual({ x: 8, y: 13 }); });
  it('42 movimento por arraste usa a mesma prévia snapped', () => { const state = initial(); const editor = new ConstructionEditor(state); const table = tableItem(state); editor.previewFurnitureMove(table.id, 8.2, 12.7); expect(editor.editSession?.previewGridPosition).toEqual({ x: 8, y: 13 }); });
  it('43 check confirma a sessão local', () => { const state = initial(); const editor = new ConstructionEditor(state); const table = tableItem(state); editor.previewFurnitureMove(table.id, 8, 13); expect(editor.confirmFurnitureEdit().ok).toBe(true); expect(editor.editSession).toBeUndefined(); });
  it('44 X restaura posição original', () => { const state = initial(); const editor = new ConstructionEditor(state); const table = tableItem(state); editor.previewFurnitureMove(table.id, 8, 13); editor.cancelFurnitureEdit(); expect(editor.draft.construction.placedFurniture.find((entry) => entry.id === table.id)?.gridY).toBe(11); });
  it('45 Escape cancela e ✓/× desselecionam o móvel', () => { const source=readFileSync('src/ui/ConstructionShop.ts','utf8'); expect(source).toContain("event.key === 'Escape'"); expect(source.match(/this\.selectedItemId = undefined/g)?.length).toBeGreaterThanOrEqual(2); });
  it('45b impede o clique dos controles inferiores de atravessar para o mapa', () => { const source=readFileSync('src/ui/ConstructionShop.ts','utf8'); expect(source).toContain("addEventListener('pointerdown'"); expect(source).toContain('lastEditorUiPointerAt'); expect(source).toContain('event.stopPropagation()'); });
  it('46 arraste interrompido não confirma', () => { const state = initial(); const editor = new ConstructionEditor(state); const table = tableItem(state); editor.previewFurnitureMove(table.id, 8, 13); expect(state.construction.placedFurniture.find((entry) => entry.id === table.id)?.gridY).toBe(11); });
  it('47 preserva conteúdo genérico do móvel', () => { const state = initial(); const table = tableItem(state); table.state.note = 'preservar'; const editor = new ConstructionEditor(state); editor.previewFurnitureMove(table.id,8,13); editor.confirmFurnitureEdit(); expect(editor.draft.construction.placedFurniture.find((entry) => entry.id === table.id)?.state.note).toBe('preservar'); });
  it('48 preserva pratos ao mover balcão', () => { const state = initial(); const counter = state.construction.serviceCounters[0]; counter.currentQuantity = 9; const editor = new ConstructionEditor(state); editor.previewFurnitureMove(counter.id,10,6); editor.confirmFurnitureEdit(); expect(editor.draft.construction.serviceCounters.find((entry) => entry.id === counter.id)?.currentQuantity).toBe(9); });
  it('49 preserva ingredientes ao mover armazenamento', () => { const state = initial(); const storage=state.storage.inventories.find((entry)=>entry.placedFurnitureId==='furniture:c5')!; storage.items.seasoning = 7; const editor = new ConstructionEditor(state); editor.previewFurnitureMove('furniture:c5',2,4); editor.confirmFurnitureEdit(); expect(storage.items.seasoning).toBe(7); });
  it('50 rotação não desloca a origem lógica', () => { const state = initial(); const editor = new ConstructionEditor(state); editor.previewFurnitureRotation('furniture:a1'); expect(editor.editSession?.previewGridPosition).toEqual({ x: 4, y: 2 }); });
  it('51 quatro rotações retornam ao estado original', () => { const state = initial(); const editor = new ConstructionEditor(state); for (let turn=0;turn<4;turn+=1) editor.previewFurnitureRotation('furniture:a1'); expect(editor.editSession?.previewRotation).toBe('sw'); expect(editor.editSession?.previewGridPosition).toEqual({x:4,y:2}); });
  it('52 pathfinding persistido só muda no confirmar global', () => { const state = initial(); const editor = new ConstructionEditor(state); editor.previewFurnitureMove('table:tutorial',8,13); editor.confirmFurnitureEdit(); expect(state.construction.placedFurniture.find((entry) => entry.id === 'table:tutorial')?.gridY).toBe(11); });
  it('53 migra posições antigas para inteiros', () => { const raw = initial(); tableItem(raw).gridX = 8.7; expect(tableItem(migrateAndSanitizeSave(raw)).gridX).toBe(9); });
  it('54 migração é idempotente', () => { const once = migrateAndSanitizeSave(initial()); const twice = migrateAndSanitizeSave(once); expect(twice.construction.placedFurniture).toEqual(once.construction.placedFurniture); });
  it('55 preserva cadeiras excedentes no inventário', () => { const raw = initial(); const table = tableItem(raw); raw.construction.placedFurniture.push(item('extra-n','dining.chair.basic',table.gridX,table.gridY-1,'sw',{linkedTableId:table.id}),item('extra-s','dining.chair.basic',table.gridX,table.gridY+1,'ne',{linkedTableId:table.id})); const migrated=migrateAndSanitizeSave(raw); expect(migrated.construction.storedFurniture.filter((entry)=>entry.id.startsWith('extra-'))).toHaveLength(2); });
  it('56 mantém conversão correta nos três zooms', () => { for (const zoom of VISUAL_METRICS.zoomLevels) { const point={x:6,y:7}; expect(screenToGrid(gridToScreen(point,{offsetX:13,offsetY:21,zoom}),{offsetX:13,offsetY:21,zoom})).toEqual(point); } });
  it('57 seleção sobreposta usa profundidade da base', () => { const def=FURNITURE_BY_ID['refrigeration.b1.fridge']; expect(getDepthOrder(item('a',def.id,5,5),def)).toBeLessThan(getDepthOrder(item('b',def.id,5,6),def)); });
  it('58 lista lateral contém só itens da loja', () => { const source=readFileSync('src/ui/ConstructionShop.ts','utf8'); expect(source).not.toContain('live-placed-list'); expect(source).toContain('visibleCatalog.map'); });
  it('59 interface mobile mantém controles contextuais', () => { const css=readFileSync('src/styles.css','utf8'); expect(css).toContain('.construction-actions.contextual'); expect(css).toContain('min-width:44px'); });
  it('60 ordena e ancora a base no vértice inferior do chão', () => { expect(depthAtBase(getFootprintCenter({x:4,y:4},{width:2,depth:1}),30)).toBeLessThan(depthAtBase({x:5,y:5},50)); const center=gridToWorld({x:8,y:11}); expect(getFootprintFloorAnchorWorld({x:8,y:11},{width:1,depth:1})).toEqual({x:center.x,y:center.y+16}); });
});

describe('contrato espacial auxiliar', () => {
  it('expõe células, slots, anchor e ocupação pela mesma origem', () => {
    const state=initial(); const table=tableItem(state); const chairs=chairItems(state); const def=FURNITURE_BY_ID[table.definitionId];
    expect(getFootprintCells({x:table.gridX,y:table.gridY},getRotatedFootprint(def,table.orientation))).toEqual([{x:8,y:11}]);
    expect(getAttachedChairCells(table,state.construction.placedFurniture)).toHaveLength(2);
    expect(getSeatSlotCells(table,state.construction.placedFurniture)).toHaveLength(2);
    expect(getApproachSlotCells(table,chairs)).toHaveLength(2);
    expect(getSpriteAnchor(def)).toEqual(def.baseAnchor);
    expect(getWorkSlotCells(item('stove','cooking.a1.stove',4,2),FURNITURE_BY_ID['cooking.a1.stove'])).toHaveLength(1);
    expect(isIntegerGridPosition(table)).toBe(true);
    expect(canPlaceAt(item('plant','decor.plant.basic',15,15),FURNITURE_BY_ID['decor.plant.basic'],occupiedCells(table,def),state.construction.builtAreas)).toBe(true);
  });
});
