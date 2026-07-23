import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../game/save/defaultState';
import { RestaurantGrid } from '../game/grid/Grid';
import { advanceTileMover, type TileMover } from '../game/navigation/TileMovement';
import { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';
import { FURNITURE_BY_ID } from '../game/data/furniture/catalog';
import { resolvedWorkSlots, validateLayout } from '../game/systems/furniture/FurniturePlacement';
import { productionBatchDuration } from '../game/cooking/ProductionService';
import { prepareNextProductionTask, createProductionPlan } from '../game/cooking/ProductionPlanningService';
import { createStations } from '../game/map/initialMap';
import { JOURNEY_CHAPTER_LEVELS } from '../game/tutorial/Tutorial008Service';
import type { GameState, PlacedFurniture } from '../core/types';
import { createStaffInstance } from '../game/staff/StaffService';
import { STAFF_BY_ID } from '../game/data/staff';

function addProfile(state: GameState): void {
  state.profile = {
    id: state.playerId, name: 'Jogador', appearance: { presentation:'masculina', skin:'honey', hairStyle:'short', hairColor:'espresso', face:'soft', outfit:'casual', outfitColor:'green' },
    level:1, xp:0, helpRole:'manager', professions: { cook:{xp:0,level:1,tasksCompleted:0}, waiter:{xp:0,level:1,tasksCompleted:0}, cleaner:{xp:0,level:1,tasksCompleted:0}, stocker:{xp:0,level:1,tasksCompleted:0} },
    taskHistory: { take_order:0, cook_step:0, deliver:0, payment:0, clean:0, stock_support:0, restock_purchase:0, production_batch:0 },
  };
}

describe('correções integradas de operação e layout', () => {
  it('gerente aceita qualquer setor e uma especialização aceita somente o setor escolhido', () => {
    const state=createDefaultState(0); addProfile(state); const simulation=new RestaurantSimulation(state);
    const service=simulation.tasks.add({ key:'test-service', kind:'take_order', role:'service', target:{x:9,y:16}, duration:1, priority:10, payload:{} });
    const kitchen=simulation.tasks.add({ key:'test-kitchen', kind:'cook_step', role:'kitchen', target:{x:8,y:16}, duration:1, priority:10, payload:{} });
    expect(simulation.prioritizeForPlayer(service.id)).toBe(true);
    expect(simulation.prioritizeForPlayer(kitchen.id)).toBe(true);
    simulation.setPlayerRole('service');
    expect(simulation.prioritizeForPlayer(service.id)).toBe(true);
    expect(simulation.prioritizeForPlayer(kitchen.id)).toBe(false);
  });

  it('nunca permite que dois NPCs ocupem ou atravessem o mesmo tile', () => {
    const grid=new RestaurantGrid(4,2);
    expect(grid.occupy({x:1,y:0},'a')).toBe(true);
    expect(grid.occupy({x:2,y:0},'b')).toBe(true);
    expect(grid.occupy({x:2,y:0},'a')).toBe(false);
    const a:TileMover={id:'a',position:{x:1,y:0},visual:{x:1,y:0},path:[{x:2,y:0}],moveProgress:0,direction:'se'};
    expect(advanceTileMover(grid,a,1,2)).toMatchObject({blocked:true,moved:false});
    expect(a.position).toEqual({x:1,y:0});
    expect(grid.get({x:2,y:0})?.occupiedBy).toBe('b');
  });

  it('balcão de serviço usa entrega e retirada pelo mesmo lado livre', () => {
    const item:PlacedFurniture={ id:'counter:test', definitionId:'service.c1.isolated', gridX:5, gridY:5, orientation:'sw', skinId:'counter-forest', level:1, state:{} };
    const slots=resolvedWorkSlots(item,FURNITURE_BY_ID[item.definitionId]);
    expect(slots.map((slot)=>slot.point)).toEqual([{x:5,y:6},{x:5,y:6}]);
    expect(new Set(slots.map((slot)=>slot.purpose))).toEqual(new Set(['kitchen-drop','waiter-pickup']));
  });

  it('permite unir mesas e encostar balcões quando o lado de trabalho fica livre', () => {
    const table=(id:string,x:number):PlacedFurniture=>({id,definitionId:'dining.table.basic',gridX:x,gridY:2,orientation:'sw',skinId:'cream-green',level:1,state:{}});
    const room={id:'test-room',kind:'base' as const,x:0,y:0,width:8,depth:8};
    expect(validateLayout([table('table:a',2),table('table:b',3)],[room],{x:7,y:7}).valid).toBe(true);
    const counter:PlacedFurniture={id:'counter:wall',definitionId:'service.c1.isolated',gridX:3,gridY:0,orientation:'sw',skinId:'counter-forest',level:1,state:{}};
    expect(validateLayout([counter],[room],{x:7,y:7}).valid).toBe(true);
  });

  it('o tempo mostrado para o lote é exatamente o tempo entregue ao cronômetro', () => {
    const state=createDefaultState(0); addProfile(state); state.restaurantLevel=3; state.coins=9999;
    state.staff.instances.push(createStaffInstance(STAFF_BY_ID['cook-0'],0));
    state.construction.placedFurniture.push({id:'coffee:test',definitionId:'cooking.a8.coffee',gridX:3,gridY:3,orientation:'sw',skinId:'steel-standard',level:1,state:{}});
    expect(createProductionPlan(state,{recipeId:'cappuccino',targetQuantity:10}).ok).toBe(true);
    const prepared=prepareNextProductionTask(state,createStations(state.construction),state.construction.serviceCounters,0);
    expect(prepared?.duration).toBe(productionBatchDuration(state,'cappuccino'));
    expect(prepared?.duration).not.toBe(45);
  });

  it('não cria tutorial para nível que concede somente dinheiro', () => {
    expect(JOURNEY_CHAPTER_LEVELS).toContain(2);
    expect(JOURNEY_CHAPTER_LEVELS).not.toContain(4);
  });
});
