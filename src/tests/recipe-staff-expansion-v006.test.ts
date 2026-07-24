import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { RECIPES, RECIPE_BY_ID } from '../content/recipes/recipes';
import type { GameState, PlacedFurniture } from '../core/types';
import { completeProductionTask, createProductionPlan, markProductionTaskStarted, prepareNextProductionTask } from '../game/cooking/ProductionPlanningService';
import { EXPANSION_BY_ID } from '../game/data/expansions';
import { STAFF_BY_ID } from '../game/data/staff';
import { createInitialGrid, createStations } from '../game/map/initialMap';
import { calculateOfflineProgress } from '../game/offline/OfflineService';
import { recipeIsOperational, recipeRequirements } from '../game/recipes/RecipeAvailability';
import { createDefaultState } from '../game/save/defaultState';
import { migrateAndSanitizeSave } from '../game/save/migrations';
import { createStaffInstance, hireStaff, processPayrollClock } from '../game/staff/StaffService';
import { ConstructionEditor } from '../game/systems/construction/ConstructionEditor';
import { occupiedCells, validateFurniturePlacement } from '../game/systems/furniture/FurniturePlacement';
import { modulesFromFurniture } from '../game/systems/service-counter/ServiceCounterSystem';

function furniture(id: string, definitionId: string, gridX: number, gridY: number, state: Record<string, unknown> = {}): PlacedFurniture {
  return { id, definitionId, gridX, gridY, orientation: 'sw', skinId: definitionId.includes('chair') ? 'chair-wood' : definitionId.includes('table') ? 'table-oak' : 'steel-standard', level: 1, state };
}

function operationalState(now = 0): GameState {
  const state = createDefaultState(now);
  state.coins = 20_000;
  state.construction.placedFurniture.push(
    furniture('machine:coffee', 'cooking.a8.coffee', 12, 8),
    furniture('sink:base', 'washing.b5.sink', 4, 4),
    furniture('counter:base', 'service.c1.isolated', 8, 6),
    furniture('table:base', 'dining.table.basic', 9, 11),
    furniture('chair:left', 'dining.chair.basic', 8, 11, { linkedTableId: 'table:base' }),
    furniture('chair:right', 'dining.chair.basic', 10, 11, { linkedTableId: 'table:base' }),
  );
  state.construction.serviceCounters = modulesFromFurniture(state.construction.placedFurniture);
  state.staff.instances = [createStaffInstance(STAFF_BY_ID['cook-0'], now)];
  return state;
}

describe('contratos 0.0.10 de receitas, equipe e expansões', () => {
  it('mantém 52 receitas únicas e exige a estação canônica antes de liberar a produção', () => {
    const state = createDefaultState(0);
    expect(RECIPES).toHaveLength(52);
    expect(new Set(RECIPES.map((recipe) => recipe.id)).size).toBe(52);
    expect(recipeIsOperational(state, RECIPE_BY_ID.coffee)).toBe(false);
    expect(recipeRequirements(state, RECIPE_BY_ID.coffee)).toContainEqual(expect.objectContaining({ id: 'station:coffee_machine', satisfied: false }));
    state.construction.placedFurniture.push(furniture('machine:coffee', 'cooking.a8.coffee', 12, 8));
    expect(recipeIsOperational(state, RECIPE_BY_ID.coffee)).toBe(true);
  });

  it('debita o lote uma vez, reserva estação compatível e agrupa sua saída no balcão', () => {
    const state = operationalState();
    const before = state.coins;
    const created = createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 12 }, 10);
    expect(created.ok).toBe(true);
    expect(state.coins).toBe(before - RECIPE_BY_ID.coffee.batchCost);
    expect(state.production.tasks).toHaveLength(1);
    const prepared = prepareNextProductionTask(state, createStations(state.construction), state.construction.serviceCounters, 11)!;
    expect(prepared.task).toMatchObject({ recipeId: 'coffee', state: 'reserved', reservedIngredients: {}, workstationId: 'coffee_machine' });
    expect(markProductionTaskStarted(state, prepared.task.id, state.staff.instances[0].id, 12)).toBe(true);
    expect(completeProductionTask(state, prepared.task.id, state.construction.serviceCounters, 13)).toBe(true);
    expect(state.construction.serviceCounters[0]).toMatchObject({ assignedRecipeId: 'coffee', currentQuantity: RECIPE_BY_ID.coffee.batchYield });
    expect(completeProductionTask(state, prepared.task.id, state.construction.serviceCounters, 14)).toBe(false);
    expect(state.coins).toBe(before - RECIPE_BY_ID.coffee.batchCost);
  });

  it('aceita 300 e rejeita saldo insuficiente ou quantidade acima do limite sem débito parcial', () => {
    const accepted = operationalState();
    expect(createProductionPlan(accepted, { recipeId: 'coffee', targetQuantity: 300 }).ok).toBe(true);
    expect(BALANCE.production.maximumQuantity).toBe(300);
    expect(createProductionPlan(accepted, { recipeId: 'coffee', targetQuantity: 301 })).toMatchObject({ ok: false, reason: expect.stringContaining('300') });

    const rejected = operationalState();
    rejected.coins = RECIPE_BY_ID.coffee.batchCost - 1;
    const before = rejected.coins;
    expect(createProductionPlan(rejected, { recipeId: 'coffee', targetQuantity: 12 }).ok).toBe(false);
    expect(rejected.coins).toBe(before);
    expect(rejected.production.plans).toHaveLength(0);
  });

  it('preserva lote parcial no save e não duplica custo ou produção offline', () => {
    const state = operationalState(0);
    const plan = createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 12 }, 1).plan!;
    const prepared = prepareNextProductionTask(state, createStations(state.construction), state.construction.serviceCounters, 2)!;
    markProductionTaskStarted(state, prepared.task.id, state.staff.instances[0].id, 3);
    const coins = state.coins;
    const restored = migrateAndSanitizeSave(JSON.parse(JSON.stringify(state)), 4);
    const reloaded = migrateAndSanitizeSave(JSON.parse(JSON.stringify(restored)), 5);
    expect(reloaded.coins).toBe(coins);
    expect(reloaded.production.plans.find((item) => item.id === plan.id)?.chargedCost).toBe(plan.chargedCost);
    expect(reloaded.production.tasks).toEqual(restored.production.tasks);

    const now = 8 * 3_600_000;
    reloaded.lastActiveAt = 0;
    const first = calculateOfflineProgress(reloaded, now);
    const afterFirst = reloaded.coins;
    expect(calculateOfflineProgress(reloaded, now).calculatedSeconds).toBe(0);
    expect(reloaded.coins).toBe(afterFirst);
    expect(first.calculatedSeconds).toBe(8 * 3_600);
  });

  it('contrata somente a Barista elegível, cobrando uma vez e usando um ponto inicial seguro', () => {
    const state = operationalState(10);
    state.staff.instances = [];
    const before = state.coins;
    expect(hireStaff(state, 'cook-1', undefined, 10).ok).toBe(false);
    const hired = hireStaff(state, 'cook-0', undefined, 10);
    expect(hired.ok).toBe(true);
    expect(state.coins).toBe(before - STAFF_BY_ID['cook-0'].hiringCost);
    expect(state.staff.instances).toHaveLength(1);
    expect(hired.instance).toMatchObject({ definitionId: 'cook-0', role: 'cook', automationSettings: { allowedTasks: expect.arrayContaining(['cook_step', 'production_batch']) } });
    const machine = state.construction.placedFurniture.find((item) => item.id === 'machine:coffee')!;
    expect(occupiedCells(machine)).not.toContainEqual(hired.instance!.startPosition);
    expect(Number.isFinite(hired.instance!.startPosition.x) && Number.isFinite(hired.instance!.startPosition.y)).toBe(true);
    expect(hireStaff(state, 'cook-0', undefined, 11).ok).toBe(false);
    expect(state.coins).toBe(before - STAFF_BY_ID['cook-0'].hiringCost);
  });

  it('mantém carência individual, ledger idempotente e folha estável após save/load', () => {
    const state = operationalState(0);
    const worker = state.staff.instances[0];
    const interval = BALANCE.staff.payrollIntervalSeconds * 1000;
    state.staff.nextPayrollAt = interval;
    const before = state.coins;
    expect(processPayrollClock(state, interval - 1).charged).toBe(0);
    expect(processPayrollClock(state, interval).charged).toBe(worker.salary);
    expect(state.coins).toBe(before - worker.salary);
    expect(processPayrollClock(state, interval).charged).toBe(0);
    expect(state.staff.payrollLedger).toContain(`payroll:${interval}:${worker.id}`);
    const restored = migrateAndSanitizeSave(JSON.parse(JSON.stringify(state)), interval + 1);
    const coins = restored.coins;
    expect(processPayrollClock(restored, interval).charged).toBe(0);
    expect(restored.coins).toBe(coins);
  });

  it('rejeita expansão bloqueada ou sem saldo sem alterar área, moedas ou móveis', () => {
    const state = operationalState();
    const beforeAreas = structuredClone(state.construction.builtAreas);
    const beforeFurniture = structuredClone(state.construction.placedFurniture);
    const editor = new ConstructionEditor(state);
    expect(editor.buyExpansion('restaurant-expansion-1', 'east').ok).toBe(false);
    expect(editor.draft.coins).toBe(state.coins);
    expect(editor.draft.construction.builtAreas).toEqual(beforeAreas);

    state.restaurantLevel = EXPANSION_BY_ID['restaurant-expansion-1'].unlockLevel;
    state.coins = EXPANSION_BY_ID['restaurant-expansion-1'].coinCost - 1;
    const poor = new ConstructionEditor(state);
    expect(poor.buyExpansion('restaurant-expansion-1', 'east').ok).toBe(false);
    expect(poor.draft.coins).toBe(state.coins);
    expect(poor.draft.construction.placedFurniture).toEqual(beforeFurniture);
  });

  it('compra expansão uma vez, libera a área canônica e a preserva no save', () => {
    const state = operationalState();
    const definition = EXPANSION_BY_ID['restaurant-expansion-1'];
    state.restaurantLevel = definition.unlockLevel;
    state.coins = definition.coinCost + 500;
    const editor = new ConstructionEditor(state);
    expect(editor.buyExpansion(definition.id, 'east').ok).toBe(true);
    expect(editor.draft.coins).toBe(500);
    const area = editor.draft.construction.builtAreas.find((item) => item.expansionDefinitionId === definition.id)!;
    expect(area).toMatchObject({ x: 18, y: 0, width: definition.width, depth: definition.depth, kind: 'expansion' });
    expect(editor.buyExpansion(definition.id, 'east').ok).toBe(false);
    expect(editor.confirm().ok).toBe(true);
    expect(state.coins).toBe(500);
    expect(createInitialGrid(undefined, undefined, state.construction).isWalkable({ x: 20, y: 5 })).toBe(true);
    expect(validateFurniturePlacement(furniture('new-table', 'dining.table.basic', 20, 5), state.construction.placedFurniture, state.construction.builtAreas).valid).toBe(true);
    const restored = migrateAndSanitizeSave(JSON.parse(JSON.stringify(state)), 50);
    expect(restored.coins).toBe(500);
    expect(restored.construction.builtAreas.filter((item) => item.expansionDefinitionId === definition.id)).toHaveLength(1);
  });
});
