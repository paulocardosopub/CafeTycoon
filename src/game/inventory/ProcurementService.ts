import { BALANCE } from '../../config/balance';
import { INGREDIENTS, INGREDIENT_BY_ID } from '../../content/ingredients/ingredients';
import type {
  GameState, IngredientId, ProcurementState, PurchaseHistoryEntry, PurchaseRequest, PurchaseRequestLine,
} from '../../core/types';
import { stableRuntimeId } from '../../core/id';
import {
  commitStoredIngredient, planStorageAllocation, releaseStorageAllocation, reserveStorageAllocation,
} from './StorageService';

export interface PurchaseItemInput { ingredientId: IngredientId; quantity: number }
export interface ProcurementResult { ok: boolean; request?: PurchaseRequest; reason?: string }

export function createInitialProcurementState(now = Date.now()): ProcurementState {
  return {
    globalSettings: {
      enabled: false,
      protectedCashBalance: BALANCE.procurement.protectedCashBalance,
      maximumSpendPerCycle: BALANCE.procurement.maximumSpendPerCycle,
      maximumSpendPerPeriod: BALANCE.procurement.maximumSpendPerPeriod,
      authorizedIngredients: INGREDIENTS.map((ingredient) => ingredient.id),
      checkIntervalSeconds: BALANCE.procurement.checkIntervalSeconds,
      allowWhenRestaurantClosed: false,
      confirmationThreshold: BALANCE.procurement.confirmationThreshold,
      pauseAtCriticalCash: BALANCE.procurement.pauseAtCriticalCash,
      periodSeconds: BALANCE.procurement.periodSeconds,
    },
    policies: INGREDIENTS.map((ingredient, index) => ({
      id: `auto:${ingredient.id}`,
      enabled: false,
      ingredientId: ingredient.id,
      minimumStock: ingredient.reorderPoint,
      targetStock: ingredient.targetStock,
      maximumPurchasePerCycle: ingredient.quickBuyPackSize * 2,
      maximumSpendPerCycle: BALANCE.procurement.maximumSpendPerCycle,
      protectedCashBalance: BALANCE.procurement.protectedCashBalance,
      priority: 70 - index,
      preferredPackageId: `${ingredient.id}:standard`,
      requireStorageSpace: true,
      pauseWhenRestaurantClosed: true,
    })),
    requests: [],
    history: [],
    spentThisPeriod: 0,
    periodStartedAt: now,
    nextCheckAt: now + BALANCE.procurement.checkIntervalSeconds * 1000,
  };
}

export function sanitizeProcurementState(input: ProcurementState | undefined, now = Date.now()): ProcurementState {
  const fallback = createInitialProcurementState(now);
  if (!input) return fallback;
  const policies = INGREDIENTS.map((ingredient) => {
    const base = fallback.policies.find((policy) => policy.ingredientId === ingredient.id)!;
    const existing = input.policies?.find((policy) => policy.ingredientId === ingredient.id);
    return existing ? {
      ...base, ...existing,
      minimumStock: Math.max(0, Math.min(ingredient.maxStock, Math.floor(Number(existing.minimumStock) || 0))),
      targetStock: Math.max(0, Math.min(ingredient.maxStock, Math.floor(Number(existing.targetStock) || 0))),
      maximumPurchasePerCycle: Math.max(1, Math.floor(Number(existing.maximumPurchasePerCycle) || base.maximumPurchasePerCycle)),
      maximumSpendPerCycle: Math.max(0, Math.floor(Number(existing.maximumSpendPerCycle) || base.maximumSpendPerCycle)),
      protectedCashBalance: Math.max(0, Math.floor(Number(existing.protectedCashBalance) || 0)),
    } : base;
  });
  const settings = { ...fallback.globalSettings, ...(input.globalSettings ?? {}), enabled: Boolean(input.globalSettings?.enabled) };
  return {
    ...fallback, ...input,
    globalSettings: settings,
    policies,
    requests: Array.isArray(input.requests) ? input.requests.map(sanitizeRequest).slice(-200) : [],
    history: Array.isArray(input.history) ? input.history.slice(-BALANCE.procurement.historyLimit) : [],
    spentThisPeriod: Math.max(0, Number(input.spentThisPeriod) || 0),
    periodStartedAt: Math.max(0, Number(input.periodStartedAt) || now),
    nextCheckAt: Math.max(0, Number(input.nextCheckAt) || now),
  };
}

export function createPurchaseRequest(
  state: GameState,
  items: readonly PurchaseItemInput[],
  origin: PurchaseRequest['origin'],
  reason: string,
  priority = 70,
  now = Date.now(),
): ProcurementResult {
  const normalized = combineItems(items);
  if (!normalized.length) return { ok: false, reason: 'A lista de compras está vazia.' };
  const dedupeKey = `${origin}:${normalized.map((item) => `${item.ingredientId}:${item.quantity}`).join('|')}`;
  const duplicate = state.procurement.requests.find((request) => request.dedupeKey === dedupeKey && ['pending', 'approved', 'purchasing', 'delivering', 'storing'].includes(request.status));
  if (duplicate) return { ok: false, request: duplicate, reason: 'Uma solicitação idêntica já está em andamento.' };

  const lines: PurchaseRequestLine[] = [];
  for (const item of normalized) {
    const ingredient = INGREDIENT_BY_ID[item.ingredientId];
    const inFlight = pendingQuantity(state, item.ingredientId);
    if (state.inventory[item.ingredientId] + inFlight + item.quantity > ingredient.maxStock) {
      rollbackStorageReservations(state, lines);
      return { ok: false, reason: `${ingredient.name}: quantidade acima do estoque máximo.` };
    }
    const allocation = planStorageAllocation(state, item.ingredientId, item.quantity);
    if (!allocation.ok || !reserveStorageAllocation(state, item.ingredientId, allocation.allocations)) {
      rollbackStorageReservations(state, lines);
      return { ok: false, reason: allocation.reason ?? `${ingredient.name}: capacidade mudou.` };
    }
    const packs = Math.ceil(item.quantity / ingredient.quickBuyPackSize);
    lines.push({ ingredientId: item.ingredientId, quantity: item.quantity, cost: packs * ingredient.purchasePrice, storageAllocations: allocation.allocations });
  }
  const totalCost = lines.reduce((sum, line) => sum + line.cost, 0);
  const protectedBalance = origin === 'automatic' ? effectiveProtectedBalance(state, lines.map((line) => line.ingredientId)) : 0;
  if (state.coins - totalCost < protectedBalance) {
    rollbackStorageReservations(state, lines);
    return { ok: false, reason: origin === 'automatic' ? 'Compra bloqueada pelo saldo protegido.' : 'Moedas insuficientes.' };
  }
  if (origin === 'automatic') {
    if (totalCost > state.procurement.globalSettings.maximumSpendPerCycle) { rollbackStorageReservations(state, lines); return { ok: false, reason: 'Limite global por ciclo excedido.' }; }
  }
  const request: PurchaseRequest = {
    id: stableRuntimeId('purchase'), lines, totalCost, origin, reason, priority,
    status: origin === 'automatic' && totalCost >= state.procurement.globalSettings.confirmationThreshold ? 'pending' : 'approved',
    createdAt: now, updatedAt: now, dedupeKey,
  };
  state.procurement.requests.push(request);
  state.procurement.requests = state.procurement.requests.slice(-200);
  return { ok: true, request };
}

export function approvePurchaseRequest(state: GameState, requestId: string, now = Date.now()): ProcurementResult {
  const request = state.procurement.requests.find((item) => item.id === requestId);
  if (!request || request.status !== 'pending') return { ok: false, reason: 'Solicitação pendente não encontrada.' };
  request.status = 'approved'; request.updatedAt = now; request.blockedReason = undefined;
  return { ok: true, request };
}

export function setPurchaseRequestStage(state: GameState, requestId: string, status: 'purchasing' | 'delivering' | 'storing', staffId?: string, now = Date.now()): boolean {
  const request = state.procurement.requests.find((item) => item.id === requestId);
  if (!request || !['approved', 'purchasing', 'delivering', 'storing'].includes(request.status)) return false;
  request.status = status; request.updatedAt = now; request.responsibleStaffId = staffId ?? request.responsibleStaffId;
  return true;
}

export function completePurchaseRequest(state: GameState, requestId: string, staffId?: string, now = Date.now()): ProcurementResult {
  const request = state.procurement.requests.find((item) => item.id === requestId);
  if (!request || !['approved', 'purchasing', 'delivering', 'storing'].includes(request.status)) return { ok: false, reason: 'Solicitação não está pronta para conclusão.' };
  const protectedBalance = request.origin === 'automatic' ? effectiveProtectedBalance(state, request.lines.map((line) => line.ingredientId)) : 0;
  const validation = validateCompletion(state, request, protectedBalance);
  if (!validation.ok) {
    failPurchaseRequest(state, request.id, validation.reason ?? 'Compra bloqueada na conclusão.', now);
    return { ok: false, request, reason: validation.reason };
  }
  state.coins -= request.totalCost;
  for (const line of request.lines) {
    const committed = commitStoredIngredient(state, line.ingredientId, line.quantity, line.storageAllocations);
    if (!committed) throw new Error('Reserva física validada não pôde ser confirmada.');
  }
  if (request.origin === 'automatic') state.procurement.spentThisPeriod += request.totalCost;
  request.status = 'completed'; request.updatedAt = now; request.responsibleStaffId = staffId ?? request.responsibleStaffId; request.blockedReason = undefined;
  appendHistory(state, request, 'completed', now);
  return { ok: true, request };
}

export function cancelPurchaseRequest(state: GameState, requestId: string, now = Date.now()): ProcurementResult {
  const request = state.procurement.requests.find((item) => item.id === requestId);
  if (!request || ['completed', 'cancelled', 'failed'].includes(request.status)) return { ok: false, reason: 'A solicitação não pode mais ser cancelada.' };
  rollbackStorageReservations(state, request.lines);
  request.status = 'cancelled'; request.updatedAt = now; request.blockedReason = 'Cancelada pelo jogador.';
  appendHistory(state, request, 'cancelled', now);
  return { ok: true, request };
}

export function failPurchaseRequest(state: GameState, requestId: string, reason: string, now = Date.now()): ProcurementResult {
  const request = state.procurement.requests.find((item) => item.id === requestId);
  if (!request || ['completed', 'cancelled', 'failed'].includes(request.status)) return { ok: false, reason: 'A solicitação não pode mais ser encerrada.' };
  rollbackStorageReservations(state, request.lines);
  request.status = 'failed'; request.updatedAt = now; request.blockedReason = reason;
  appendHistory(state, request, 'failed', now);
  return { ok: true, request };
}

export function evaluateAutoPurchases(state: GameState, restaurantOpen = true, now = Date.now()): PurchaseRequest[] {
  const procurement = state.procurement;
  for (const request of procurement.requests.filter((item) => item.origin === 'automatic' && item.status === 'blocked' && item.lines.some((line) => line.storageAllocations.length > 0))) {
    failPurchaseRequest(state, request.id, request.blockedReason ?? 'Solicitação automática antiga liberada para nova tentativa.', now);
  }
  if (now - procurement.periodStartedAt >= procurement.globalSettings.periodSeconds * 1000) {
    procurement.periodStartedAt = now; procurement.spentThisPeriod = 0;
  }
  procurement.nextCheckAt = now + procurement.globalSettings.checkIntervalSeconds * 1000;
  if (!procurement.globalSettings.enabled || !state.tutorial006.automationUnlocked) return [];
  if (!restaurantOpen && !procurement.globalSettings.allowWhenRestaurantClosed) return [];
  if (state.coins <= procurement.globalSettings.pauseAtCriticalCash) return [];
  const created: PurchaseRequest[] = [];
  let cycleSpend = 0;
  for (const policy of [...procurement.policies].sort((left, right) => right.priority - left.priority)) {
    if (!policy.enabled || !procurement.globalSettings.authorizedIngredients.includes(policy.ingredientId)) continue;
    if (!restaurantOpen && policy.pauseWhenRestaurantClosed) continue;
    const ingredient = INGREDIENT_BY_ID[policy.ingredientId];
    const effective = state.inventory[policy.ingredientId] + pendingQuantity(state, policy.ingredientId);
    if (effective >= policy.minimumStock) continue;
    const quantity = Math.min(policy.targetStock - effective, policy.maximumPurchasePerCycle, ingredient.maxStock - effective);
    if (quantity <= 0) continue;
    const cost = Math.ceil(quantity / ingredient.quickBuyPackSize) * ingredient.purchasePrice;
    if (cost > policy.maximumSpendPerCycle || cycleSpend + cost > procurement.globalSettings.maximumSpendPerCycle) {
      recordBlockedRequest(state, policy.ingredientId, quantity, 'Limite por ciclo excedido.', policy.priority, now); continue;
    }
    const result = createPurchaseRequest(state, [{ ingredientId: policy.ingredientId, quantity }], 'automatic', `Estoque abaixo do mínimo ${policy.minimumStock}.`, policy.priority, now);
    if (result.request) created.push(result.request);
    if (result.ok) cycleSpend += result.request!.totalCost;
    else if (!result.request) recordBlockedRequest(state, policy.ingredientId, quantity, result.reason ?? 'Compra automática bloqueada.', policy.priority, now);
  }
  return created;
}

export function pendingQuantity(state: Pick<GameState, 'procurement'>, ingredientId: IngredientId): number {
  return state.procurement.requests.filter((request) => !['completed', 'cancelled', 'failed', 'blocked'].includes(request.status))
    .flatMap((request) => request.lines).filter((line) => line.ingredientId === ingredientId).reduce((sum, line) => sum + line.quantity, 0);
}

function validateCompletion(state: GameState, request: PurchaseRequest, protectedBalance: number): { ok: boolean; reason?: string } {
  if (state.coins - request.totalCost < protectedBalance) return { ok: false, reason: request.origin === 'automatic' ? 'Saldo protegido impediria a compra.' : 'Moedas insuficientes.' };
  for (const line of request.lines) {
    const ingredient = INGREDIENT_BY_ID[line.ingredientId];
    if (state.inventory[line.ingredientId] + line.quantity > ingredient.maxStock) return { ok: false, reason: `${ingredient.name}: estoque máximo mudou.` };
    const size = ingredient.storageSize;
    for (const allocation of line.storageAllocations) {
      const inventory = state.storage.inventories.find((item) => item.placedFurnitureId === allocation.placedFurnitureId);
      if (!inventory || inventory.reservedCapacity < allocation.quantity * size || inventory.currentCapacity + allocation.quantity * size > inventory.maxCapacity) return { ok: false, reason: `${ingredient.name}: espaço reservado não está mais disponível.` };
    }
  }
  return { ok: true };
}

function rollbackStorageReservations(state: Pick<GameState, 'storage'>, lines: readonly PurchaseRequestLine[]): void {
  for (const line of lines) releaseStorageAllocation(state, line.ingredientId, line.storageAllocations);
}

function appendHistory(state: GameState, request: PurchaseRequest, result: PurchaseHistoryEntry['result'], at: number): void {
  const entry: PurchaseHistoryEntry = {
    id: stableRuntimeId('purchase-history'), requestId: request.id, at,
    lines: request.lines.map((line) => ({ ingredientId: line.ingredientId, quantity: line.quantity })),
    totalValue: request.totalCost, origin: request.origin, responsibleStaffId: request.responsibleStaffId,
    reason: request.reason, result,
  };
  state.procurement.history = [...state.procurement.history, entry].slice(-BALANCE.procurement.historyLimit);
}

function recordBlockedRequest(state: GameState, ingredientId: IngredientId, quantity: number, reason: string, priority: number, at: number): PurchaseRequest {
  const ingredient = INGREDIENT_BY_ID[ingredientId];
  const request: PurchaseRequest = {
    id: stableRuntimeId('purchase'), lines: [{ ingredientId, quantity, cost: Math.ceil(quantity / ingredient.quickBuyPackSize) * ingredient.purchasePrice, storageAllocations: [] }],
    totalCost: Math.ceil(quantity / ingredient.quickBuyPackSize) * ingredient.purchasePrice, origin: 'automatic', reason: `Estoque abaixo do mínimo.`,
    priority, status: 'blocked', createdAt: at, updatedAt: at, blockedReason: reason, dedupeKey: `blocked:${ingredientId}:${reason}`,
  };
  const duplicate = state.procurement.requests.find((item) => item.dedupeKey === request.dedupeKey && item.status === 'blocked');
  if (duplicate) { duplicate.updatedAt = at; return duplicate; }
  state.procurement.requests.push(request); state.procurement.requests = state.procurement.requests.slice(-200); return request;
}

function effectiveProtectedBalance(state: Pick<GameState, 'procurement'>, ingredients: IngredientId[]): number {
  return Math.max(state.procurement.globalSettings.protectedCashBalance, ...state.procurement.policies.filter((policy) => ingredients.includes(policy.ingredientId)).map((policy) => policy.protectedCashBalance), 0);
}

function combineItems(items: readonly PurchaseItemInput[]): PurchaseItemInput[] {
  const totals = new Map<IngredientId, number>();
  for (const item of items) if (INGREDIENT_BY_ID[item.ingredientId]) totals.set(item.ingredientId, (totals.get(item.ingredientId) ?? 0) + Math.max(0, Math.floor(item.quantity)));
  return [...totals].map(([ingredientId, quantity]) => ({ ingredientId, quantity })).filter((item) => item.quantity > 0);
}

function sanitizeRequest(request: PurchaseRequest): PurchaseRequest {
  const terminal = ['completed', 'cancelled', 'failed'].includes(request.status);
  return { ...request, totalCost: Math.max(0, Number(request.totalCost) || 0), status: terminal ? request.status : request.status === 'blocked' ? 'blocked' : 'approved', responsibleStaffId: terminal ? request.responsibleStaffId : undefined };
}
