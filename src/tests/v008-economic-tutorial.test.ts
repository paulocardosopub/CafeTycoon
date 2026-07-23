import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../game/save/defaultState';
import { RECIPES, RECIPE_BY_ID } from '../content/recipes/recipes';
import { createProductionPlan, sanitizeProductionState } from '../game/cooking/ProductionPlanningService';
import { enqueueProduction, tickProduction } from '../game/cooking/ProductionService';
import { INITIAL_TUTORIAL_STEPS, JOURNEY_CHAPTER_LEVELS, acknowledgeJourneyChapter, acknowledgeTutorialStep, pendingJourneyChapter, pendingTutorialStep, reconcileTutorial } from '../game/tutorial/Tutorial008Service';
import { ConstructionEditor } from '../game/systems/construction/ConstructionEditor';
import { FURNITURE_BY_ID } from '../game/data/furniture/catalog';
import { STAFF_BY_ID } from '../game/data/staff';
import { createStaffInstance } from '../game/staff/StaffService';
import { BALANCE } from '../config/balance';

describe('0.0.8 econômica sem ingredientes', () => {
  it('novo jogo começa vazio, sem equipe e fechado', () => {
    const state=createDefaultState(0); expect(state.staff.instances).toHaveLength(0); expect(state.construction.placedFurniture).toHaveLength(0); expect(state.restaurantOpen).toBe(false);
  });
  it('não concede kit ou pratos prontos', () => {
    const state=createDefaultState(0); expect(Object.keys(state.inventory)).toHaveLength(0); expect(Object.values(state.readyDishes).every((value)=>value===0)).toBe(true);
  });
  it('nenhuma receita depende de ingredientes', () => expect(RECIPES.every((recipe)=>recipe.ingredients.length===0)).toBe(true));
  it('cobra um lote uma única vez na criação do plano', () => {
    const state=createDefaultState(0); state.staff.instances.push(createStaffInstance(STAFF_BY_ID['cook-0'],0)); const before=state.coins; const result=createProductionPlan(state,{recipeId:'coffee',targetQuantity:12}); expect(result.ok).toBe(true); expect(before-state.coins).toBe(result.plan!.chargedCost); sanitizeProductionState(state.production); expect(before-state.coins).toBe(result.plan!.chargedCost);
  });
  it('informa exatamente quanto falta quando o saldo é insuficiente', () => {
    const state=createDefaultState(0); state.staff.instances.push(createStaffInstance(STAFF_BY_ID['cook-0'],0)); state.coins=1; const result=createProductionPlan(state,{recipeId:'coffee',targetQuantity:12}); expect(result.ok).toBe(false); expect(result.reason).toContain(String(RECIPE_BY_ID.coffee.batchCost-1));
  });
  it('fila legada cobra apenas ao começar e não após reload lógico', () => {
    const state=createDefaultState(0); const item=enqueueProduction(state,'coffee',1); const before=state.coins; tickProduction(state,.1); expect(before-state.coins).toBe(RECIPE_BY_ID.coffee.batchCost); const after=state.coins; tickProduction(state,.1); expect(state.coins).toBe(after); expect(item.costPaid).toBe(true);
  });
  it('comprar não posiciona e posicionar sem comprar é recusado', () => {
    const state=createDefaultState(0); const editor=new ConstructionEditor(state); expect(editor.purchase('cooking.a8.coffee').ok).toBe(true); expect(editor.draft.construction.placedFurniture).toHaveLength(0); expect(editor.draft.construction.storedFurniture).toHaveLength(1); const fresh=new ConstructionEditor(createDefaultState(0)); expect(fresh.place('cooking.a8.coffee',2,2).reason).toContain('Loja');
  });
  it('móveis de armazenamento não participam do conjunto inicial obrigatório', () => {
    expect(Boolean(FURNITURE_BY_ID['storage.c5.pantry'].essential)).toBe(false); expect(Boolean(FURNITURE_BY_ID['refrigeration.b1.fridge'].essential)).toBe(false); expect(FURNITURE_BY_ID['cooking.a8.coffee'].essential).toBe(true);
  });
  it('primeiro candidato é a Barista iniciante', () => { const state=createDefaultState(0); expect(state.staff.candidateDefinitionIds[0]).toBe('cook-0'); expect(STAFF_BY_ID['cook-0'].specialties).toContain('Barista'); });
  it('tutorial possui 16 etapas, atendimento contratado e etapa econômica', () => { const ids = INITIAL_TUTORIAL_STEPS.map((step) => step.id as string); expect(INITIAL_TUTORIAL_STEPS).toHaveLength(16); expect(INITIAL_TUTORIAL_STEPS[10].id).toBe('cost-and-time'); expect(INITIAL_TUTORIAL_STEPS[10].objective).not.toMatch(/ingrediente/i); expect(ids).toContain('hire-waiter'); expect(ids).not.toContain('player-waiter'); });
  it('tutorial é idempotente', () => { const state=createDefaultState(0); acknowledgeTutorialStep(state,'welcome'); acknowledgeTutorialStep(state,'welcome'); expect(state.tutorial008.completedSteps.filter((id)=>id==='welcome')).toHaveLength(1); });
  it('tutorial desaparece quando não há uma nova etapa pendente', () => {
    const state=createDefaultState(0); state.tutorial008.completedSteps=INITIAL_TUTORIAL_STEPS.map((step)=>step.id); reconcileTutorial(state); expect(pendingTutorialStep(state)).toBeUndefined(); expect(state.tutorial008.currentStep).toBe(INITIAL_TUTORIAL_STEPS.length);
  });
  it('Jornada contém apenas níveis com mudança real', () => { for (const level of [1,2,3,5,7,10,20,25,30,82,89,92,100]) expect(JOURNEY_CHAPTER_LEVELS).toContain(level); expect(JOURNEY_CHAPTER_LEVELS).not.toContain(4); });
  it('dinheiro inicial cobre móveis, Barista e dois lotes de café', () => {
    const ids=['service.c1.isolated','washing.b5.sink','cooking.a8.coffee','dining.table.basic','dining.chair.basic','dining.chair.basic']; const total=ids.reduce((sum,id)=>sum+FURNITURE_BY_ID[id].price,0)+STAFF_BY_ID['cook-0'].hireCost+RECIPE_BY_ID.coffee.batchCost*2; expect(createDefaultState(0).coins).toBeGreaterThanOrEqual(total);
  });
  it('capítulos liberam conforme o nível sem duplicar', () => { const state=createDefaultState(0); state.restaurantLevel=10; reconcileTutorial(state); reconcileTutorial(state); expect(state.tutorial008.availableChapters.filter((id)=>id==='level-10')).toHaveLength(1); });
  it('novo capítulo aparece automaticamente ao chegar no nível e pode ser concluído', () => { const state=createDefaultState(0); state.tutorial008.completedSteps=INITIAL_TUTORIAL_STEPS.map((step)=>step.id); state.restaurantLevel=2; reconcileTutorial(state); expect(pendingJourneyChapter(state)).toBe(2); acknowledgeJourneyChapter(state,2); expect(pendingJourneyChapter(state)).toBeUndefined(); });
  it('exige mais experiência para desacelerar a progressão', () => { expect(BALANCE.restaurantLevels[1]).toBeGreaterThanOrEqual(140); expect(BALANCE.restaurantLevels[9]).toBeGreaterThan(7000); });
});
