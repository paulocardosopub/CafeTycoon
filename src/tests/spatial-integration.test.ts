import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PlacedFurniture } from '../core/types';
import { FURNITURE_BY_ID } from '../game/data/furniture/catalog';
import { createDefaultState } from '../game/save/defaultState';
import { createTablesFromConstruction, seatFacingTowardTable } from '../game/map/initialMap';
import { migrateAndSanitizeSave } from '../game/save/migrations';
import { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';
import { ConstructionEditor } from '../game/systems/construction/ConstructionEditor';
import { directionBetween } from '../game/navigation/TileMovement';

describe('correção estrutural — 10 fluxos de integração', () => {
  it('FLUXO A — mover, confirmar, salvar e recarregar', () => { const state=createDefaultState(0); const editor=new ConstructionEditor(state); editor.previewFurnitureMove('table:tutorial',8,13); editor.confirmFurnitureEdit(); expect(editor.confirm().ok).toBe(true); const restored=migrateAndSanitizeSave(state); expect(restored.construction.placedFurniture.find((item)=>item.id==='table:tutorial')?.gridY).toBe(13); });
  it('FLUXO B — mover, girar e cancelar restaura tudo', () => { const state=createDefaultState(0); const editor=new ConstructionEditor(state); editor.previewFurnitureMove('table:tutorial',8,13); editor.previewFurnitureRotation('table:tutorial'); editor.cancelFurnitureEdit(); const table=editor.draft.construction.placedFurniture.find((item)=>item.id==='table:tutorial')!; expect([table.gridX,table.gridY,table.orientation]).toEqual([8,11,'sw']); expect(table.attachedFurnitureIds).toEqual(['chair:tutorial-west','chair:tutorial-east']); });
  it('FLUXO C — dois clientes sentam, olham, levantam e liberam assentos', () => { const sim=new RestaurantSimulation(createDefaultState(0)); sim.debugSetAutoSpawn(false); const customers=sim.debugSeatGroupAtFirstTable(2); expect(new Set(customers.map((customer)=>customer.direction))).toEqual(new Set(['se','nw'])); customers.forEach((customer)=>sim.debugBeginDeparture(customer)); expect(sim.tables[0].chairs.every((chair)=>!chair.customerId)).toBe(true); });
  it('FLUXO D — percurso usa as quatro direções', () => { const center={x:8,y:8}; expect([directionBetween(center,{x:9,y:8}),directionBetween(center,{x:7,y:8}),directionBetween(center,{x:8,y:9}),directionBetween(center,{x:8,y:7})]).toEqual(['se','nw','sw','ne']); });
  it('FLUXO E — cadeira fora do lado oposto bloqueia check e X restaura', () => { const state=createDefaultState(0); const editor=new ConstructionEditor(state); const result=editor.previewFurnitureMove('chair:tutorial-east',8,10); expect(result.ok).toBe(false); expect(editor.editSession?.validationState).toBe('invalid'); editor.cancelFurnitureEdit(); const chair=editor.draft.construction.placedFurniture.find((item)=>item.id==='chair:tutorial-east')!; expect([chair.gridX,chair.gridY]).toEqual([9,11]); });
  it('FLUXO F — fogão gira e permanece 1×1 com um WorkSlot', () => { const state=createDefaultState(0); const editor=new ConstructionEditor(state); expect(editor.previewFurnitureRotation('furniture:a1').ok).toBe(true); const stove=editor.draft.construction.placedFurniture.find((item)=>item.id==='furniture:a1')!; expect(stove.footprint).toEqual({width:1,depth:1}); expect(FURNITURE_BY_ID[stove.definitionId].workSlots).toHaveLength(1); expect(editor.confirmFurnitureEdit().ok).toBe(true); });
  it('FLUXO G — cozinha separa bancadas e móveis altos', () => { const standard=['cooking.a1.stove','washing.b5.sink','preparation.b3.counter'].map((id)=>FURNITURE_BY_ID[id]); expect(new Set(standard.map((item)=>item.visualBounds.heightBlocks)).size).toBe(1); expect(FURNITURE_BY_ID['refrigeration.b1.fridge'].visualBounds.heightBlocks).toBeGreaterThan(standard[0].visualBounds.heightBlocks); });
  it('FLUXO H — balcão 1×1 preserva pratos após movimento', () => { const state=createDefaultState(0); state.construction.serviceCounters[0].currentQuantity=12; const editor=new ConstructionEditor(state); editor.previewFurnitureMove('counter:tutorial',10,6); editor.confirmFurnitureEdit(); expect(editor.draft.construction.serviceCounters[0].currentQuantity).toBe(12); });
  it('FLUXO I — mobile expõe toque, arraste, rotação, check e X', () => { const ui=readFileSync('src/ui/ConstructionShop.ts','utf8'); const scene=readFileSync('src/scenes/RestaurantScene.ts','utf8'); expect(ui).toContain('confirm-item'); expect(ui).toContain('cancel-item'); expect(ui).toContain('previewFurnitureRotation'); expect(scene).toContain('construction:world-drag'); });
  it('FLUXO J — migração normaliza, preserva e não repete deslocamentos', () => { const raw=createDefaultState(0); const table=raw.construction.placedFurniture.find((item)=>item.id==='table:tutorial')!; const extras:PlacedFurniture[]=[{id:'extra-a',definitionId:'dining.chair.basic',gridX:8,gridY:10,orientation:'sw',skinId:'chair-wood',level:1,state:{linkedTableId:table.id}},{id:'extra-b',definitionId:'dining.chair.basic',gridX:8,gridY:12,orientation:'ne',skinId:'chair-wood',level:1,state:{linkedTableId:table.id}}]; raw.construction.placedFurniture.push(...extras); const once=migrateAndSanitizeSave(raw); const twice=migrateAndSanitizeSave(once); expect(once.construction.storedFurniture.filter((item)=>item.id.startsWith('extra-'))).toHaveLength(2); expect(twice.construction).toEqual(once.construction); });
  it('FLUXO K — plantas e lixeira antigas viram móveis editáveis uma única vez', () => { const raw=createDefaultState(0); raw.construction.placedFurniture=raw.construction.placedFurniture.filter((item)=>!item.id.startsWith('decor:')); raw.construction.migrationLog=[]; const migrated=migrateAndSanitizeSave(raw); expect(migrated.construction.placedFurniture.filter((item)=>item.id.startsWith('decor:')).map((item)=>item.definitionId).sort()).toEqual(['decor.plant.basic','decor.plant.basic','service.c8.waste']); migrated.construction.placedFurniture=migrated.construction.placedFurniture.filter((item)=>item.id!=='decor:bin'); expect(migrateAndSanitizeSave(migrated).construction.placedFurniture.some((item)=>item.id==='decor:bin')).toBe(false); });
  it('FLUXO L — cena agrupa a receita correta e mostra quantidade sem nome sobre o balcão', () => { const scene=readFileSync('src/scenes/RestaurantScene.ts','utf8'); expect(scene).toContain('drawPlacedDecorations'); expect(scene).toContain('counter?.currentQuantity'); expect(scene).toContain('recipeFoodAssetId(counter?.assignedRecipeId)'); expect(scene).toContain('readyCount >= 2'); expect(scene).not.toContain('counterRecipe.name'); expect(scene).toContain("station.id.startsWith('pickup:')"); });
  it('FLUXO M — gira a mesa quatro vezes mantendo as cadeiras opostas e viradas para ela', () => {
    const state = createDefaultState(0); const editor = new ConstructionEditor(state); const tableId = 'table:tutorial';
    for (let turn = 0; turn < 4; turn += 1) {
      expect(editor.previewFurnitureRotation(tableId).ok).toBe(true);
      const table = editor.draft.construction.placedFurniture.find((item) => item.id === tableId)!;
      const chairs = editor.draft.construction.placedFurniture.filter((item) => item.state.linkedTableId === tableId);
      expect(chairs).toHaveLength(2);
      expect(chairs[0].gridX + chairs[1].gridX).toBe(table.gridX * 2);
      expect(chairs[0].gridY + chairs[1].gridY).toBe(table.gridY * 2);
      for (const chair of chairs) expect(chair.orientation).toBe(seatFacingTowardTable({ x: chair.gridX, y: chair.gridY }, { x: table.gridX, y: table.gridY }));
    }
    expect(editor.editSession?.previewRotation).toBe('sw');
  });
  it('FLUXO N — impede uma cadeira de ser compartilhada por mesas próximas', () => {
    const editor = new ConstructionEditor(createDefaultState(1_000));
    expect(editor.place('dining.table.basic', 9, 10).ok).toBe(true);
    const result = editor.confirm();
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('entre duas mesas');
  });
  it('FLUXO O — bloqueia mesa encostada no corredor atrás da cadeira', () => {
    const editor = new ConstructionEditor(createDefaultState(1_000));
    expect(editor.place('dining.table.basic', 10, 11).ok).toBe(true);
    const result = editor.confirm();
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('entre duas mesas');
  });
  it('FLUXO P — cadeira trocada de mesa mantém o novo vínculo ao salvar, jogar e recarregar', () => {
    const state = createDefaultState(1_000);
    const cleaner = state.construction.staffStartPositions.find((start) => start.staffId === 'cleaner-0')!;
    cleaner.gridX = 15; cleaner.gridY = 15;
    const editor = new ConstructionEditor(state);
    expect(editor.place('dining.table.basic', 13, 11).ok).toBe(true);
    const newTable = editor.draft.construction.placedFurniture.find((item) => item.definitionId === 'dining.table.basic' && item.id !== 'table:tutorial')!;
    expect(editor.place('dining.chair.basic', 14, 11).ok).toBe(true);
    expect(editor.previewFurnitureMove('chair:tutorial-east', 12, 11).ok).toBe(true);
    expect(editor.draft.construction.placedFurniture.find((item) => item.id === 'chair:tutorial-east')?.state.linkedTableId).toBe(newTable.id);
    expect(editor.confirmFurnitureEdit().ok).toBe(true);
    expect(editor.confirm().ok).toBe(true);

    const inGameChair = createTablesFromConstruction(state.construction).flatMap((table) => table.chairs).find((chair) => chair.id === 'chair:tutorial-east')!;
    expect(inGameChair.tableId).toBe(newTable.id);
    expect(inGameChair.orientation).toBe('se');

    const restored = migrateAndSanitizeSave(structuredClone(state));
    const restoredChair = createTablesFromConstruction(restored.construction).flatMap((table) => table.chairs).find((chair) => chair.id === 'chair:tutorial-east')!;
    expect(restoredChair.tableId).toBe(newTable.id);
    expect(restoredChair.orientation).toBe('se');
  });
});
