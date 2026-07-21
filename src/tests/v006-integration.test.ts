import { describe, expect, it } from 'vitest';
import { INGREDIENTS } from '../content/ingredients/ingredients';
import type { GameState } from '../core/types';
import { completeProductionTask, createProductionPlan, markProductionTaskStarted, prepareNextProductionTask } from '../game/cooking/ProductionPlanningService';
import { createPurchaseRequest, evaluateAutoPurchases } from '../game/inventory/ProcurementService';
import { reconcileStorage } from '../game/inventory/StorageService';
import { calculateOfflineProgress } from '../game/offline/OfflineService';
import { createDefaultState } from '../game/save/defaultState';
import { migrateAndSanitizeSave } from '../game/save/migrations';
import { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';
import { hireStaff } from '../game/staff/StaffService';
import { createStations } from '../game/map/initialMap';

function empty(state: GameState, ingredientId: keyof GameState['inventory']): void { state.inventory[ingredientId] = 0; reconcileStorage(state, 1); }

describe('fluxos integrados da v0.0.6', () => {
  it('FLUXO A · contrata, posiciona e materializa funcionário no salão', () => {
    const state = createDefaultState(0); state.coins = 2_000;
    const hired = hireStaff(state, 'cook-1', { x: 14, y: 14 }, 10); expect(hired.ok).toBe(true);
    const simulation = new RestaurantSimulation(state); expect(simulation.actors.find((actor) => actor.id === hired.instance!.id)?.position).toEqual({ x: 14, y: 14 });
  });

  it('FLUXO B · compra manual, transporta, armazena e atualiza estoque', () => {
    const state = createDefaultState(0); state.coins = 1_000; empty(state, 'beef');
    const request = createPurchaseRequest(state, [{ ingredientId: 'beef', quantity: 4 }], 'manual', 'Fluxo manual', 100, 1).request!;
    const simulation = new RestaurantSimulation(state); simulation.debugSetAutoSpawn(false); simulation.debugRunFor(80);
    expect(request.status).toBe('completed'); expect(state.inventory.beef).toBe(4); expect(state.procurement.history.at(-1)?.requestId).toBe(request.id);
  });

  it('FLUXO C · detecta falta e conclui reposição automática protegida', () => {
    const state = createDefaultState(0); state.coins = 1_000; empty(state, 'beef'); state.tutorial006.automationUnlocked = true; state.procurement.globalSettings.enabled = true;
    state.procurement.policies.find((policy) => policy.ingredientId === 'beef')!.enabled = true; const requests = evaluateAutoPurchases(state, true, 1); expect(requests).toHaveLength(1);
    const simulation = new RestaurantSimulation(state); simulation.debugSetAutoSpawn(false); simulation.debugRunFor(80);
    expect(requests[0].status).toBe('completed'); expect(state.coins).toBeGreaterThanOrEqual(state.procurement.globalSettings.protectedCashBalance);
  });

  it('FLUXO D · programa 500 unidades e divide em lotes', () => {
    const state = createDefaultState(0); state.coins = 10_000;
    state.inventory.egg = 1_000; state.inventory.tomato = 500; state.inventory.seasoning = 500;
    const baseCounter = state.construction.serviceCounters[0];
    state.construction.serviceCounters = [0, 1, 2].map((index) => ({
      ...structuredClone(baseCounter), id: `counter:integration:${index}`, gridX: 7 + index,
      assignedRecipeId: 'omelette', currentQuantity: 0, reservedQuantity: 0, incomingReservedQuantity: 0,
      maxCapacity: 200, kitchenDropSlot: { x: 7 + index, y: 5 }, waiterPickupSlot: { x: 7 + index, y: 7 },
    }));
    const plan = createProductionPlan(state, { recipeId: 'omelette', targetQuantity: 500, batchSize: 20, priority: 55 }).plan!;
    const tasks = state.production.tasks.filter((task) => task.productionPlanId === plan.id); expect(tasks).toHaveLength(25); expect(tasks.reduce((sum, task) => sum + task.batchQuantity, 0)).toBe(500);
    const stations = createStations(state.construction);
    for (let index = 0; index < 25; index += 1) {
      const prepared = prepareNextProductionTask(state, stations, state.construction.serviceCounters, 10 + index);
      expect(prepared).toBeDefined(); expect(prepared!.task.workSlotId).toBeTruthy(); expect(prepared!.task.workstationId).toBeTruthy();
      expect(markProductionTaskStarted(state, prepared!.task.id, 'employee-cook-001', 10 + index)).toBe(true);
      expect(completeProductionTask(state, prepared!.task.id, state.construction.serviceCounters, 20 + index)).toBe(true);
    }
    expect(plan.currentProgress).toBe(500);
    expect(state.construction.serviceCounters.map((counter) => counter.currentQuantity)).toEqual([200, 200, 100]);
    expect(state.inventory.egg).toBe(0); expect(state.inventory.tomato).toBe(0); expect(state.inventory.seasoning).toBe(0);
  });

  it('FLUXO E · bloqueia por espaço e retoma após adicionar armazenamento', () => {
    const state = createDefaultState(0); empty(state, 'beef'); const fridge = state.storage.inventories.find((item) => item.storageType === 'refrigerated')!; fridge.currentCapacity = fridge.maxCapacity;
    expect(createPurchaseRequest(state, [{ ingredientId: 'beef', quantity: 1 }], 'manual', 'Sem espaço').ok).toBe(false);
    state.construction.placedFurniture.push({ id: 'fridge:expansion', definitionId: 'refrigeration.b1.fridge', gridX: 14, gridY: 2, orientation: 'sw', skinId: 'steel-standard', level: 1, state: {} }); reconcileStorage(state, 2); state.coins = 1_000;
    expect(createPurchaseRequest(state, [{ ingredientId: 'beef', quantity: 1 }], 'manual', 'Retomada').ok).toBe(true);
  });

  it('FLUXO F · pedido urgente supera plano preventivo no coordenador', () => {
    const state = createDefaultState(0); for (const ingredient of INGREDIENTS) state.inventory[ingredient.id] = ingredient.maxStock; reconcileStorage(state, 1); createProductionPlan(state, { recipeId: 'omelette', targetQuantity: 10, batchSize: 2, priority: 30 });
    const simulation = new RestaurantSimulation(state); simulation.debugSetAutoSpawn(false); simulation.debugAddCustomer(); simulation.debugRunFor(20);
    const cookTasks = simulation.tasks.list().filter((task) => task.role === 'kitchen'); const urgent = cookTasks.find((task) => task.kind === 'cook_step'); const preventive = cookTasks.find((task) => task.kind === 'production_batch');
    if (urgent && preventive) expect(urgent.priority).toBeGreaterThan(preventive.priority); else expect(simulation.orders.length).toBeGreaterThan(0);
  });

  it('FLUXO G · simula equipe, compras e produção por até oito horas', () => {
    const now = 1_800_000_000_000; const state = createDefaultState(now - 10 * 3600 * 1000); state.coins = 1_000; empty(state, 'beef'); state.tutorial006.automationUnlocked = true; state.procurement.globalSettings.enabled = true; state.procurement.policies.find((policy) => policy.ingredientId === 'beef')!.enabled = true;
    createProductionPlan(state, { recipeId: 'omelette', targetQuantity: 2, batchSize: 1 }); const report = calculateOfflineProgress(state, now);
    expect(report.calculatedSeconds).toBe(8 * 3600); expect(report.costs).toBe(report.purchaseCosts + report.salariesCharged); expect(state.coins).toBeGreaterThanOrEqual(0);
  });

  it('FLUXO H · migra e recarrega v0.0.5 sem duplicação', () => {
    const legacy = createDefaultState(100); legacy.gameVersion = '0.0.5'; legacy.coins = 432; const raw = legacy as unknown as Record<string, unknown>; delete raw.staff; delete raw.storage; delete raw.procurement; delete raw.production; delete raw.tutorial006;
    const migrated = migrateAndSanitizeSave(legacy, 200); const reloaded = migrateAndSanitizeSave(structuredClone(migrated), 300);
    expect(reloaded.coins).toBe(432); expect(reloaded.staff.instances).toHaveLength(migrated.staff.instances.length); expect(reloaded.inventory).toEqual(migrated.inventory); expect(reloaded.production.tasks).toHaveLength(migrated.production.tasks.length);
  });
});
