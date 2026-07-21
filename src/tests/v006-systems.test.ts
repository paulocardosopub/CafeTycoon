import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { INGREDIENTS } from '../content/ingredients/ingredients';
import { RECIPE_BY_ID } from '../content/recipes/recipes';
import type { GameState, ServiceCounterModule } from '../core/types';
import { createProductionPlan, cancelProductionPlan, completeProductionTask, pauseProductionPlan, prepareNextProductionTask, refreshMaintainTargetPlans } from '../game/cooking/ProductionPlanningService';
import { createInitialProductionState } from '../game/cooking/ProductionPlanningService';
import { createPurchaseRequest, cancelPurchaseRequest, completePurchaseRequest, evaluateAutoPurchases } from '../game/inventory/ProcurementService';
import { planStorageAllocation, reconcileStorage, storageCapacity, storageTargetPoint } from '../game/inventory/StorageService';
import { availableIngredient, consumeReservation, reserveRecipe } from '../game/inventory/InventoryService';
import { calculateOfflineProgress } from '../game/offline/OfflineService';
import { migrateAndSanitizeSave } from '../game/save/migrations';
import { createDefaultState } from '../game/save/defaultState';
import { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';
import { awardStaffTaskExperience, cancelTraining, chargePayroll, hireStaff, setStaffEnabled, startTraining, tickTraining } from '../game/staff/StaffService';
import { validateStaffStartPosition } from '../game/systems/construction/StaffStartSystem';
import { ConstructionEditor } from '../game/systems/construction/ConstructionEditor';
import { occupiedCells } from '../game/systems/furniture/FurniturePlacement';
import { TaskManager } from '../game/tasks/TaskManager';

function stocked(now = 1_800_000_000_000): GameState {
  const state = createDefaultState(now);
  for (const ingredient of INGREDIENTS) state.inventory[ingredient.id] = ingredient.maxStock;
  reconcileStorage(state, now);
  state.coins = 10_000;
  return state;
}

function emptyIngredient(state: GameState, id: keyof GameState['inventory']): void {
  state.inventory[id] = 0; reconcileStorage(state, 1);
}

describe('v0.0.6 · funcionários, turnos e treinamento', () => {
  it('1. contrata com saldo suficiente', () => {
    const state = createDefaultState(0); state.coins = 1_000;
    const result = hireStaff(state, 'cook-1', { x: 14, y: 14 }, 10);
    expect(result.ok).toBe(true); expect(state.coins).toBe(550); expect(state.staff.instances).toContainEqual(expect.objectContaining({ definitionId: 'cook-1' }));
  });

  it('2. bloqueia contratação sem saldo', () => {
    const state = createDefaultState(0); state.coins = 10;
    expect(hireStaff(state, 'cook-1', { x: 14, y: 14 }, 10)).toEqual(expect.objectContaining({ ok: false }));
    expect(state.staff.instances).toHaveLength(4);
  });

  it('3. cobra salários em intervalo configurável', () => {
    const state = createDefaultState(0); state.coins = 1_000; const due = state.staff.instances.reduce((sum, item) => sum + item.salary, 0);
    const result = chargePayroll(state, 1, 100); expect(result.charged).toBe(due); expect(state.coins).toBe(1_000 - due);
  });

  it('4. nunca cria saldo negativo ao cobrar folha', () => {
    const state = createDefaultState(0); state.coins = 1;
    const result = chargePayroll(state, 1, 100); expect(result.charged).toBe(0); expect(state.coins).toBe(1); expect(state.staff.salaryArrears).toBeGreaterThan(0);
  });

  it('5. encerra turno sem abandonar tarefa crítica', () => {
    const state = createDefaultState(0); const member = state.staff.instances[0]; member.currentState = 'working'; member.currentTaskId = 'critical';
    setStaffEnabled(state, member.id, false, 100); expect(member.enabled).toBe(false); expect(member.currentState).toBe('working'); expect(member.currentTaskId).toBe('critical');
  });

  it('6. concede experiência por tarefa válida', () => {
    const state = createDefaultState(0); const cook = state.staff.instances.find((item) => item.role === 'cook')!;
    awardStaffTaskExperience(state, cook.id, 'cook_step', 100); expect(cook.experience).toBe(BALANCE.staff.experiencePerTask); expect(cook.stats.tasksCompleted).toBe(1);
  });

  it('7. conclui treinamento salvo', () => {
    const state = createDefaultState(0); state.coins = 1_000; const cook = state.staff.instances.find((item) => item.role === 'cook')!;
    expect(startTraining(state, cook.id, 100).ok).toBe(true); tickTraining(state, BALANCE.staff.trainingDurationSeconds, 200);
    expect(cook.level).toBe(2); expect(state.staff.training.at(-1)?.status).toBe('completed');
  });

  it('8. cancela treinamento sem permitir trabalho simultâneo', () => {
    const state = createDefaultState(0); state.coins = 1_000; const cook = state.staff.instances.find((item) => item.role === 'cook')!;
    startTraining(state, cook.id, 100); expect(cook.currentState).toBe('training'); expect(cancelTraining(state, cook.id, 200).ok).toBe(true); expect(cook.currentState).toBe('idle');
  });

  it('9. valida posição inicial fora de footprints e WorkSlots', () => {
    const state = createDefaultState(0);
    expect(validateStaffStartPosition({ staffId: 'x', gridX: 4, gridY: 2, facing: 'ne', returnWhenIdle: true }, state.construction.placedFurniture, state.construction.builtAreas).valid).toBe(false);
    expect(validateStaffStartPosition({ staffId: 'x', gridX: 14, gridY: 14, facing: 'ne', returnWhenIdle: true }, state.construction.placedFurniture, state.construction.builtAreas).valid).toBe(true);
  });
});

describe('v0.0.6 · armazenamento e reposição', () => {
  it('10. cria tarefa do estoquista com WorkSlot', () => {
    const state = createDefaultState(0); state.coins = 1_000; emptyIngredient(state, 'beef');
    expect(createPurchaseRequest(state, [{ ingredientId: 'beef', quantity: 2 }], 'manual', 'teste').ok).toBe(true);
    const simulation = new RestaurantSimulation(state); simulation.debugSetAutoSpawn(false); simulation.update(1);
    expect(simulation.tasks.list().find((task) => task.kind === 'restock_purchase')?.reservations.some((item) => item.type === 'workSlot')).toBe(true);
  });

  it('11. mantém estoquista diante do armazenamento, fora do footprint', () => {
    const state = createDefaultState(0); const storage = state.construction.placedFurniture.find((item) => item.id === 'furniture:b1')!;
    const target = storageTargetPoint(state.construction, storage.id)!;
    expect(occupiedCells(storage)).not.toContainEqual(target.point);
  });

  it('12. deriva capacidade dos móveis físicos', () => {
    const state = createDefaultState(0); expect(storageCapacity(state)).toBe(110);
    state.construction.placedFurniture = state.construction.placedFurniture.filter((item) => item.id !== 'furniture:c5'); reconcileStorage(state, 1); expect(storageCapacity(state)).toBe(50);
  });

  it('13. suporta tipos dry, refrigerated e frozen', () => {
    const state = createDefaultState(0);
    expect(state.storage.inventories.some((item) => item.storageType === 'dry')).toBe(true);
    expect(state.storage.inventories.some((item) => item.storageType === 'refrigerated')).toBe(true);
    state.construction.placedFurniture.push({ id: 'freezer:test', definitionId: 'refrigeration.b2.freezer', gridX: 14, gridY: 2, orientation: 'sw', skinId: 'steel-standard', level: 1, state: {} });
    reconcileStorage(state, 2); expect(state.storage.inventories.some((item) => item.storageType === 'frozen')).toBe(true);
  });

  it('14. bloqueia armazenamento incompatível', () => {
    const state = createDefaultState(0); emptyIngredient(state, 'beef');
    state.construction.placedFurniture = state.construction.placedFurniture.filter((item) => item.definitionId !== 'refrigeration.b1.fridge'); reconcileStorage(state, 2);
    expect(planStorageAllocation(state, 'beef', 1).ok).toBe(false);
  });

  it('15. preserva conteúdo ao mover móvel', () => {
    const state = createDefaultState(0); const before = structuredClone(state.storage.inventories.find((item) => item.placedFurnitureId === 'furniture:c5')!.items);
    const editor = new ConstructionEditor(state); expect(editor.move('furniture:c5', 2, 5).ok).toBe(true);
    expect(state.storage.inventories.find((item) => item.placedFurnitureId === 'furniture:c5')!.items).toEqual(before);
  });

  it('16. bloqueia venda de armazenamento com conteúdo sem confirmação', () => {
    const state = createDefaultState(0); const editor = new ConstructionEditor(state);
    expect(editor.sell('furniture:c5').ok).toBe(false); expect(editor.draft.construction.placedFurniture.some((item) => item.id === 'furniture:c5')).toBe(true);
  });

  it('17. conclui compra manual como transação atômica', () => {
    const state = createDefaultState(0); state.coins = 1_000; emptyIngredient(state, 'beef'); const before = state.coins;
    const request = createPurchaseRequest(state, [{ ingredientId: 'beef', quantity: 4 }], 'manual', 'manual').request!;
    expect(completePurchaseRequest(state, request.id, 'employee-stocker-001', 2).ok).toBe(true); expect(state.inventory.beef).toBe(4); expect(state.coins).toBe(before - request.totalCost);
  });

  it('18. gera compra automática abaixo do mínimo', () => {
    const state = createDefaultState(0); state.coins = 1_000; emptyIngredient(state, 'beef'); state.tutorial006.automationUnlocked = true; state.procurement.globalSettings.enabled = true;
    state.procurement.policies.find((item) => item.ingredientId === 'beef')!.enabled = true;
    expect(evaluateAutoPurchases(state, true, 10).some((request) => request.origin === 'automatic')).toBe(true);
  });

  it('19. respeita saldo protegido', () => {
    const state = createDefaultState(0); emptyIngredient(state, 'beef'); state.coins = BALANCE.procurement.protectedCashBalance;
    expect(createPurchaseRequest(state, [{ ingredientId: 'beef', quantity: 1 }], 'automatic', 'auto').reason).toContain('protegido'); expect(state.coins).toBe(BALANCE.procurement.protectedCashBalance);
  });

  it('20. respeita limite por ciclo', () => {
    const state = createDefaultState(0); state.coins = 1_000; emptyIngredient(state, 'beef'); state.tutorial006.automationUnlocked = true; state.procurement.globalSettings.enabled = true; state.procurement.globalSettings.maximumSpendPerCycle = 1;
    state.procurement.policies.find((item) => item.ingredientId === 'beef')!.enabled = true; evaluateAutoPurchases(state, true, 10);
    expect(state.procurement.requests.some((request) => request.blockedReason?.includes('ciclo'))).toBe(true);
  });

  it('21. respeita limite por período', () => {
    const state = createDefaultState(0); state.coins = 1_000; emptyIngredient(state, 'beef'); state.procurement.spentThisPeriod = state.procurement.globalSettings.maximumSpendPerPeriod;
    expect(createPurchaseRequest(state, [{ ingredientId: 'beef', quantity: 1 }], 'automatic', 'auto').reason).toContain('período');
  });

  it('22. bloqueia compra sem espaço físico', () => {
    const state = createDefaultState(0); const fridge = state.storage.inventories.find((item) => item.storageType === 'refrigerated')!; fridge.currentCapacity = fridge.maxCapacity;
    expect(createPurchaseRequest(state, [{ ingredientId: 'beef', quantity: 1 }], 'manual', 'lotado').ok).toBe(false);
  });

  it('23. previne solicitação duplicada', () => {
    const state = createDefaultState(0); state.coins = 1_000; emptyIngredient(state, 'beef');
    expect(createPurchaseRequest(state, [{ ingredientId: 'beef', quantity: 1 }], 'manual', 'x').ok).toBe(true);
    expect(createPurchaseRequest(state, [{ ingredientId: 'beef', quantity: 1 }], 'manual', 'x').reason).toContain('idêntica');
  });

  it('24. cancela compra pendente e libera capacidade', () => {
    const state = createDefaultState(0); state.coins = 1_000; emptyIngredient(state, 'beef'); const request = createPurchaseRequest(state, [{ ingredientId: 'beef', quantity: 1 }], 'manual', 'x').request!;
    expect(cancelPurchaseRequest(state, request.id).ok).toBe(true); expect(state.storage.inventories.reduce((sum, item) => sum + item.reservedCapacity, 0)).toBe(0);
  });

  it('25. registra histórico limitado da compra', () => {
    const state = createDefaultState(0); state.coins = 1_000; emptyIngredient(state, 'beef'); const request = createPurchaseRequest(state, [{ ingredientId: 'beef', quantity: 1 }], 'manual', 'x').request!;
    completePurchaseRequest(state, request.id, 'employee-stocker-001', 20); expect(state.procurement.history.at(-1)).toEqual(expect.objectContaining({ requestId: request.id, result: 'completed' }));
  });
});

describe('v0.0.6 · planos, lotes, reservas e prioridade', () => {
  it('26. cria plano de produção', () => { const state = stocked(); expect(createProductionPlan(state, { recipeId: 'omelette', targetQuantity: 20 }).ok).toBe(true); });
  it('27. aceita 999 unidades', () => { const state = stocked(); expect(createProductionPlan(state, { recipeId: 'omelette', targetQuantity: 999, batchSize: 50 }).plan?.targetQuantity).toBe(999); });
  it('28. divide solicitação em lotes executáveis', () => { const state = stocked(); const plan = createProductionPlan(state, { recipeId: 'omelette', targetQuantity: 105, batchSize: 20 }).plan!; expect(state.production.tasks.filter((task) => task.productionPlanId === plan.id).map((task) => task.batchQuantity)).toEqual([20, 20, 20, 20, 20, 5]); });

  it('29. reserva ingredientes atomicamente', () => {
    const state = stocked(); createProductionPlan(state, { recipeId: 'omelette', targetQuantity: 2, batchSize: 2 }); const before = availableIngredient(state, 'egg');
    expect(prepareNextProductionTask(state, new RestaurantSimulation(state).stations, state.construction.serviceCounters)).toBeTruthy(); expect(availableIngredient(state, 'egg')).toBe(before - 4);
  });

  it('30. impede estoque negativo e consumo duplicado', () => {
    const state = createDefaultState(0); const reservation = reserveRecipe(state, RECIPE_BY_ID.omelette, 1)!;
    expect(consumeReservation(state, reservation)).toBe(true); expect(consumeReservation(state, reservation)).toBe(false); expect(Object.values(state.inventory).every((amount) => amount >= 0)).toBe(true);
  });

  it('31. reserva equipamento compatível', () => {
    const state = stocked(); createProductionPlan(state, { recipeId: 'omelette', targetQuantity: 1 }); const prepared = prepareNextProductionTask(state, new RestaurantSimulation(state).stations, state.construction.serviceCounters)!;
    expect(prepared.task.workstationId).toBeTruthy(); expect(prepared.station.state).toBe('free');
  });

  it('32. reserva WorkSlot externo', () => {
    const state = stocked(); createProductionPlan(state, { recipeId: 'omelette', targetQuantity: 1 }); const prepared = prepareNextProductionTask(state, new RestaurantSimulation(state).stations, state.construction.serviceCounters)!;
    expect(prepared.task.workSlotId).toContain('primary'); expect(prepared.target).toEqual(prepared.station.interaction);
  });

  it('33. espera quando o balcão está cheio', () => {
    const state = stocked(); state.construction.serviceCounters[0].currentQuantity = state.construction.serviceCounters[0].maxCapacity; createProductionPlan(state, { recipeId: 'omelette', targetQuantity: 1 });
    expect(prepareNextProductionTask(state, new RestaurantSimulation(state).stations, state.construction.serviceCounters)).toBeUndefined(); expect(state.production.tasks[0].state).toBe('waitingForCounterSpace');
  });

  it('34. distribui lote entre vários balcões 1x1', () => {
    const state = stocked(); const first = state.construction.serviceCounters[0]; first.maxCapacity = 6;
    const second: ServiceCounterModule = { ...structuredClone(first), id: 'counter:second', gridX: 9, currentQuantity: 0, reservedQuantity: 0, incomingReservedQuantity: 0, maxCapacity: 6 };
    state.construction.serviceCounters.push(second); createProductionPlan(state, { recipeId: 'omelette', targetQuantity: 10, batchSize: 10 });
    const prepared = prepareNextProductionTask(state, new RestaurantSimulation(state).stations, state.construction.serviceCounters)!; expect(prepared.task.outputReservations).toHaveLength(2); expect(prepared.task.outputReservations.reduce((sum, item) => sum + item.quantity, 0)).toBe(10);
  });

  it('35. cria produção por estoque-alvo', () => {
    const state = stocked(); state.production.stockTargets.find((item) => item.recipeId === 'omelette')!.enabled = true; refreshMaintainTargetPlans(state, state.construction.serviceCounters, 10);
    expect(state.production.plans.some((plan) => plan.mode === 'maintainTarget')).toBe(true); expect(state.production.tasks.length).toBeGreaterThan(0);
  });

  it('36. não produz acima do alvo ao reavaliar', () => {
    const state = stocked(); const target = state.production.stockTargets.find((item) => item.recipeId === 'omelette')!; target.enabled = true; target.targetPrepared = 12;
    refreshMaintainTargetPlans(state, state.construction.serviceCounters, 10); const planned = state.production.tasks.reduce((sum, task) => sum + task.batchQuantity, 0); refreshMaintainTargetPlans(state, state.construction.serviceCounters, 11);
    expect(state.production.tasks.reduce((sum, task) => sum + task.batchQuantity, 0)).toBe(planned);
  });

  it('37. pausa e retoma produção', () => { const state = stocked(); const plan = createProductionPlan(state, { recipeId: 'omelette', targetQuantity: 5 }).plan!; expect(pauseProductionPlan(state, plan.id, false)).toBe(true); expect(plan.enabled).toBe(false); pauseProductionPlan(state, plan.id, true); expect(plan.enabled).toBe(true); });

  it('38. cancela plano e devolve reservas', () => {
    const state = stocked(); const plan = createProductionPlan(state, { recipeId: 'omelette', targetQuantity: 2 }).plan!; prepareNextProductionTask(state, new RestaurantSimulation(state).stations, state.construction.serviceCounters); const reserved = state.inventoryReserved.egg;
    expect(reserved).toBeGreaterThan(0); cancelProductionPlan(state, plan.id, state.construction.serviceCounters); expect(state.inventoryReserved.egg).toBe(0);
  });

  it('39. prioriza pedido de cliente sobre produção preventiva', () => {
    const manager = new TaskManager(); manager.add({ key: 'preventive', kind: 'production_batch', role: 'kitchen', target: { x: 1, y: 1 }, duration: 1, priority: 40, payload: {} }); manager.add({ key: 'order', kind: 'cook_step', role: 'kitchen', target: { x: 2, y: 2 }, duration: 1, priority: 100, payload: {} });
    expect(manager.claim('cook', ['kitchen'])?.kind).toBe('cook_step');
  });

  it('40. recupera tarefa bloqueada e libera reserva antiga', () => {
    const manager = new TaskManager(); const task = manager.add({ key: 'blocked', kind: 'clean', role: 'cleaning', target: { x: 1, y: 1 }, duration: 1, priority: 1, payload: {} }); manager.claim('x', ['cleaning']); manager.release(task.id, 'x', 'rota'); manager.tick(30);
    expect(manager.releaseStaleReservations(20)).toHaveLength(1); expect(task.status).toBe('pending');
  });

  it('41. muda função do jogador liberando tarefa ainda não iniciada', () => {
    const state = createDefaultState(0); state.profile = { id: state.playerId, name: 'Jô', appearance: { presentation: 'feminina', skin: 'honey', hairStyle: 'bun', hairColor: 'espresso', face: 'soft', outfit: 'apron', outfitColor: 'teal' }, level: 1, xp: 0, helpRole: 'kitchen', professions: { cook: { xp: 0, level: 1, tasksCompleted: 0 }, waiter: { xp: 0, level: 1, tasksCompleted: 0 }, cleaner: { xp: 0, level: 1, tasksCompleted: 0 }, stocker: { xp: 0, level: 1, tasksCompleted: 0 } }, taskHistory: { take_order: 0, cook_step: 0, deliver: 0, payment: 0, clean: 0, stock_support: 0, restock_purchase: 0, production_batch: 0 } };
    const simulation = new RestaurantSimulation(state); const task = simulation.tasks.add({ key: 'player', kind: 'stock_support', role: 'stock', target: { x: 3, y: 5 }, duration: 1, priority: 100, payload: {} });
    simulation.setPlayerRole('stock'); expect(simulation.prioritizeForPlayer(task.id)).toBe(true); simulation.update(.05); simulation.setPlayerRole('service'); expect(state.profile!.helpRole).toBe('service');
  });
});

describe('v0.0.6 · offline e migração', () => {
  it('42. limita simulação offline a oito horas', () => { const now = 1_800_000_000_000; const state = createDefaultState(now - 12 * 3600 * 1000); expect(calculateOfflineProgress(state, now).calculatedSeconds).toBe(8 * 3600); });

  it('43. respeita saldo protegido offline', () => {
    const now = 1_800_000_000_000; const state = createDefaultState(now - 10 * 60 * 1000); emptyIngredient(state, 'beef'); state.coins = 100; state.tutorial006.automationUnlocked = true; state.procurement.globalSettings.enabled = true; state.procurement.policies.find((item) => item.ingredientId === 'beef')!.enabled = true;
    calculateOfflineProgress(state, now); expect(state.coins).toBeGreaterThanOrEqual(state.procurement.globalSettings.protectedCashBalance);
  });

  it('44. respeita capacidade física offline', () => {
    const now = 1_800_000_000_000; const state = stocked(now - 3600 * 1000); state.construction.serviceCounters[0].currentQuantity = state.construction.serviceCounters[0].maxCapacity; createProductionPlan(state, { recipeId: 'omelette', targetQuantity: 10 });
    const report = calculateOfflineProgress(state, now); expect(state.construction.serviceCounters[0].currentQuantity).toBeLessThanOrEqual(state.construction.serviceCounters[0].maxCapacity);
    expect(report.blockedTasks.some((task) => task.kind === 'production')).toBe(true);
  });

  it('45. cobra salários offline sem saldo negativo', () => {
    const now = 1_800_000_000_000; const state = createDefaultState(now - 2 * 3600 * 1000); state.coins = 1_000; const report = calculateOfflineProgress(state, now);
    expect(report.salariesCharged).toBeGreaterThan(0); expect(state.coins).toBeGreaterThanOrEqual(0); expect(report.costs).toBe(report.purchaseCosts + report.salariesCharged);
  });

  it('46. migra save da v0.0.5 preservando moedas e estoque', () => {
    const legacy = createDefaultState(100); legacy.gameVersion = '0.0.5'; legacy.coins = 777; const inventory = structuredClone(legacy.inventory);
    const raw = legacy as unknown as Record<string, unknown>; delete raw.staff; delete raw.storage; delete raw.procurement; delete raw.production; delete raw.tutorial006; delete raw.migration006;
    const migrated = migrateAndSanitizeSave(legacy, 200); expect(migrated.coins).toBe(777); expect(migrated.inventory).toEqual(inventory); expect(migrated.staff.instances).toHaveLength(4); expect(migrated.procurement.globalSettings.enabled).toBe(false);
  });

  it('47. mantém migração idempotente', () => {
    const legacy = createDefaultState(100); legacy.gameVersion = '0.0.5'; const first = migrateAndSanitizeSave(legacy, 200); const second = migrateAndSanitizeSave(structuredClone(first), 300);
    expect(second.migration006).toEqual(first.migration006); expect(second.staff.instances.map((item) => item.id)).toEqual(first.staff.instances.map((item) => item.id));
  });

  it('48. recarrega sem duplicar pessoas, itens, tarefas ou dinheiro', () => {
    const state = stocked(100); state.production = createInitialProductionState(); createProductionPlan(state, { recipeId: 'omelette', targetQuantity: 20, batchSize: 10 }); const before = { coins: state.coins, staff: state.staff.instances.length, inventory: structuredClone(state.inventory), tasks: state.production.tasks.length };
    const reloaded = migrateAndSanitizeSave(structuredClone(state), 200); expect({ coins: reloaded.coins, staff: reloaded.staff.instances.length, inventory: reloaded.inventory, tasks: reloaded.production.tasks.length }).toEqual(before);
  });
});
