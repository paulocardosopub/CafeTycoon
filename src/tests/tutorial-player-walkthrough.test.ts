import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../game/save/defaultState';
import { ConstructionEditor } from '../game/systems/construction/ConstructionEditor';
import { hireStaff } from '../game/staff/StaffService';
import { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';
import { completeProductionTask, createProductionPlan, prepareNextProductionTask } from '../game/cooking/ProductionPlanningService';
import { acknowledgeTutorialStep, reconcileTutorial } from '../game/tutorial/Tutorial008Service';

describe('jornada do tutorial como jogador', () => {
  it('percorre compra, edição, contratação, produção e abertura sem trava econômica ou estrutural', () => {
    const state = createDefaultState(0);
    acknowledgeTutorialStep(state, 'welcome');

    const shop = new ConstructionEditor(state);
    for (const id of ['service.c1.isolated','washing.b5.sink','cooking.a8.coffee','dining.table.basic','dining.chair.basic','dining.chair.basic']) expect(shop.purchase(id).ok).toBe(true);
    expect(shop.draft.construction.placedFurniture).toHaveLength(0);
    expect(shop.confirmPurchases().ok).toBe(true);

    acknowledgeTutorialStep(state, 'open-editor');
    const editor = new ConstructionEditor(state);
    const place = (definitionId: string, x: number, y: number, orientation: 'sw'|'se'|'nw'|'ne'='sw') => {
      const stored = editor.draft.construction.storedFurniture.find((item) => item.definitionId === definitionId)!;
      const result = editor.place(definitionId, x, y, orientation, undefined, stored.id);
      expect(result.ok, `${definitionId}: ${result.reason}`).toBe(true);
    };
    place('service.c1.isolated', 3, 3);
    place('washing.b5.sink', 7, 3);
    place('cooking.a8.coffee', 11, 3);
    place('dining.table.basic', 9, 11);
    place('dining.chair.basic', 8, 11, 'se');
    place('dining.chair.basic', 10, 11, 'nw');
    const saved = editor.confirm();
    expect(saved.ok, saved.reason).toBe(true);

    const hired = hireStaff(state, 'cook-0', undefined, 1);
    expect(hired.ok, hired.reason).toBe(true);
    const cleaner = hireStaff(state, 'cleaner-0', undefined, 1);
    expect(cleaner.ok, cleaner.reason).toBe(true);
    expect(state.staff.instances).toHaveLength(2);
    state.profile = { id: state.playerId, name: 'Jogador', appearance: { presentation: 'masculina', skin: 'honey', hairStyle: 'short', hairColor: 'espresso', face: 'soft', outfit: 'casual', outfitColor: 'green' }, level: 1, xp: 0, helpRole: 'service', professions: { cook:{xp:0,level:1,tasksCompleted:0}, waiter:{xp:0,level:1,tasksCompleted:0}, cleaner:{xp:0,level:1,tasksCompleted:0}, stocker:{xp:0,level:1,tasksCompleted:0} }, taskHistory: { take_order:0,cook_step:0,deliver:0,payment:0,clean:0,stock_support:0,restock_purchase:0,production_batch:0 } };

    const simulation = new RestaurantSimulation(state);
    const plan = createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 12 }, 2);
    expect(plan.ok, plan.reason).toBe(true);
    const prepared = prepareNextProductionTask(state, simulation.stations, simulation.counterModules, 3);
    expect(prepared).toBeDefined();
    expect(completeProductionTask(state, prepared!.task.id, simulation.counterModules, 4)).toBe(true);
    expect(simulation.counterModules.reduce((sum, counter) => sum + counter.currentQuantity, 0)).toBeGreaterThan(0);
    state.restaurantOpen = true;
    reconcileTutorial(state);
    expect(state.tutorial008.completedSteps).toEqual(expect.arrayContaining(['buy-counter','buy-sink','buy-dining','buy-coffee-machine','place-setup','hire-barista','hire-cleaner','first-production','player-waiter','understand-counter','open-restaurant']));
    expect(state.coins).toBeGreaterThanOrEqual(0);
  });
});
