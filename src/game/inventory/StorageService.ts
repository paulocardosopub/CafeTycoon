import { BALANCE } from '../../config/balance';
import { INGREDIENTS, INGREDIENT_BY_ID } from '../../content/ingredients/ingredients';
import type {
  ConstructionSaveState, GameState, IngredientId, StorageDefinition, StorageInventory, StorageSystemState, StorageType,
} from '../../core/types';
import { resolvedWorkSlots } from '../systems/furniture/FurniturePlacement';

export const STORAGE_DEFINITIONS: readonly StorageDefinition[] = [
  storage('storage.c5.pantry', 'dry', BALANCE.storage.capacities.dry, ['dry', 'general']),
  storage('storage.c6.ingredients', 'general', BALANCE.storage.capacities.general, ['dry', 'general']),
  storage('refrigeration.b1.fridge', 'refrigerated', BALANCE.storage.capacities.refrigerated, ['refrigerated']),
  storage('refrigeration.b2.freezer', 'frozen', BALANCE.storage.capacities.frozen, ['frozen', 'refrigerated']),
] as const;

export const STORAGE_BY_FURNITURE = Object.fromEntries(STORAGE_DEFINITIONS.map((definition) => [definition.furnitureDefinitionId, definition])) as Record<string, StorageDefinition>;

export function createInitialStorageState(
  source: Pick<GameState, 'construction' | 'inventory'>,
  now = Date.now(),
  previous?: StorageSystemState,
): StorageSystemState {
  const inventories = source.construction.placedFurniture.flatMap((item): StorageInventory[] => {
    const definition = STORAGE_BY_FURNITURE[item.definitionId];
    if (!definition) return [];
    const maxCapacity = Math.floor(definition.baseCapacity * (1 + Math.max(0, item.level - 1) * definition.levelCapacityMultiplier));
    return [{ placedFurnitureId: item.id, storageType: definition.storageType, items: {}, reservedCapacity: 0, currentCapacity: 0, maxCapacity }];
  });
  const remaining = { ...source.inventory };
  if (previous) preserveExistingAllocations(previous.inventories, inventories, remaining);
  for (const ingredient of INGREDIENTS) {
    let quantity = Math.max(0, Math.floor(remaining[ingredient.id] ?? 0));
    for (const inventory of compatibleInventories(inventories, ingredient.id)) {
      if (!quantity) break;
      const units = Math.min(quantity, Math.floor((inventory.maxCapacity - inventory.currentCapacity) / ingredient.storageSize));
      if (!units) continue;
      inventory.items[ingredient.id] = (inventory.items[ingredient.id] ?? 0) + units;
      inventory.currentCapacity += units * ingredient.storageSize;
      quantity -= units;
    }
    remaining[ingredient.id] = quantity;
  }
  const legacyOverflow = Object.fromEntries(INGREDIENTS.map((ingredient) => [ingredient.id, Math.max(0, remaining[ingredient.id] ?? 0)])) as Partial<Record<IngredientId, number>>;
  return { inventories, legacyOverflow, migrationPending: Object.values(legacyOverflow).some((amount) => (amount ?? 0) > 0), lastReconciledAt: now };
}

export function reconcileStorage(state: GameState, now = Date.now()): StorageSystemState {
  state.storage = createInitialStorageState(state, now, state.storage);
  return state.storage;
}

export function storageUsed(state: Pick<GameState, 'storage'>): number {
  return state.storage.inventories.reduce((sum, inventory) => sum + inventory.currentCapacity, 0)
    + Object.entries(state.storage.legacyOverflow).reduce((sum, [id, quantity]) => sum + (quantity ?? 0) * INGREDIENT_BY_ID[id as IngredientId].storageSize, 0);
}

export function storageCapacity(state: Pick<GameState, 'storage'>): number {
  return state.storage.inventories.reduce((sum, inventory) => sum + inventory.maxCapacity, 0);
}

export function storageCapacityByType(state: Pick<GameState, 'storage'>): Record<StorageType, { used: number; reserved: number; max: number }> {
  const result: Record<StorageType, { used: number; reserved: number; max: number }> = {
    dry: { used: 0, reserved: 0, max: 0 }, refrigerated: { used: 0, reserved: 0, max: 0 },
    frozen: { used: 0, reserved: 0, max: 0 }, general: { used: 0, reserved: 0, max: 0 },
  };
  for (const inventory of state.storage.inventories) {
    result[inventory.storageType].used += inventory.currentCapacity;
    result[inventory.storageType].reserved += inventory.reservedCapacity;
    result[inventory.storageType].max += inventory.maxCapacity;
  }
  return result;
}

export interface StorageAllocationResult {
  ok: boolean;
  allocations: { placedFurnitureId: string; quantity: number }[];
  reason?: string;
  spaceNeeded: number;
}

export function planStorageAllocation(state: Pick<GameState, 'storage'>, ingredientId: IngredientId, quantity: number): StorageAllocationResult {
  const requested = Math.max(0, Math.floor(quantity));
  const ingredient = INGREDIENT_BY_ID[ingredientId];
  if (!requested) return { ok: false, allocations: [], reason: 'Quantidade inválida.', spaceNeeded: 0 };
  let remaining = requested;
  const allocations: { placedFurnitureId: string; quantity: number }[] = [];
  for (const inventory of compatibleInventories(state.storage.inventories, ingredientId)) {
    const free = Math.max(0, inventory.maxCapacity - inventory.currentCapacity - inventory.reservedCapacity);
    const accepted = Math.min(remaining, Math.floor(free / ingredient.storageSize));
    if (!accepted) continue;
    allocations.push({ placedFurnitureId: inventory.placedFurnitureId, quantity: accepted }); remaining -= accepted;
    if (!remaining) break;
  }
  if (remaining) return {
    ok: false,
    allocations,
    reason: `Sem espaço ${storageTypeLabel(ingredient.storageType)} para ${remaining} unidade(s).`,
    spaceNeeded: requested * ingredient.storageSize,
  };
  return { ok: true, allocations, spaceNeeded: requested * ingredient.storageSize };
}

export function reserveStorageAllocation(state: Pick<GameState, 'storage'>, ingredientId: IngredientId, allocations: readonly { placedFurnitureId: string; quantity: number }[]): boolean {
  const size = INGREDIENT_BY_ID[ingredientId].storageSize;
  if (allocations.some((part) => {
    const inventory = state.storage.inventories.find((item) => item.placedFurnitureId === part.placedFurnitureId);
    return !inventory || inventory.maxCapacity - inventory.currentCapacity - inventory.reservedCapacity < part.quantity * size;
  })) return false;
  for (const part of allocations) state.storage.inventories.find((item) => item.placedFurnitureId === part.placedFurnitureId)!.reservedCapacity += part.quantity * size;
  return true;
}

export function releaseStorageAllocation(state: Pick<GameState, 'storage'>, ingredientId: IngredientId, allocations: readonly { placedFurnitureId: string; quantity: number }[]): void {
  const size = INGREDIENT_BY_ID[ingredientId].storageSize;
  for (const part of allocations) {
    const inventory = state.storage.inventories.find((item) => item.placedFurnitureId === part.placedFurnitureId);
    if (inventory) inventory.reservedCapacity = Math.max(0, inventory.reservedCapacity - part.quantity * size);
  }
}

export function commitStoredIngredient(
  state: GameState,
  ingredientId: IngredientId,
  quantity: number,
  allocations: readonly { placedFurnitureId: string; quantity: number }[],
): boolean {
  const requested = Math.max(0, Math.floor(quantity));
  const size = INGREDIENT_BY_ID[ingredientId].storageSize;
  if (!requested || allocations.reduce((sum, part) => sum + part.quantity, 0) !== requested) return false;
  if (allocations.some((part) => {
    const inventory = state.storage.inventories.find((item) => item.placedFurnitureId === part.placedFurnitureId);
    return !inventory || inventory.reservedCapacity < part.quantity * size || inventory.currentCapacity + part.quantity * size > inventory.maxCapacity;
  })) return false;
  for (const part of allocations) {
    const inventory = state.storage.inventories.find((item) => item.placedFurnitureId === part.placedFurnitureId)!;
    inventory.reservedCapacity -= part.quantity * size;
    inventory.currentCapacity += part.quantity * size;
    inventory.items[ingredientId] = (inventory.items[ingredientId] ?? 0) + part.quantity;
  }
  state.inventory[ingredientId] += requested;
  return true;
}

export function removeStoredIngredient(state: Pick<GameState, 'storage'>, ingredientId: IngredientId, quantity: number): boolean {
  let remaining = Math.max(0, Math.floor(quantity));
  const available = storedIngredientQuantity(state, ingredientId);
  if (available < remaining) return false;
  const size = INGREDIENT_BY_ID[ingredientId].storageSize;
  const overflow = Math.min(remaining, state.storage.legacyOverflow[ingredientId] ?? 0);
  if (overflow) {
    state.storage.legacyOverflow[ingredientId] = (state.storage.legacyOverflow[ingredientId] ?? 0) - overflow;
    remaining -= overflow;
  }
  for (const inventory of compatibleInventories(state.storage.inventories, ingredientId)) {
    if (!remaining) break;
    const removed = Math.min(remaining, inventory.items[ingredientId] ?? 0);
    if (!removed) continue;
    inventory.items[ingredientId] = (inventory.items[ingredientId] ?? 0) - removed;
    inventory.currentCapacity = Math.max(0, inventory.currentCapacity - removed * size);
    remaining -= removed;
  }
  state.storage.migrationPending = Object.values(state.storage.legacyOverflow).some((amount) => (amount ?? 0) > 0);
  return remaining === 0;
}

export function storedIngredientQuantity(state: Pick<GameState, 'storage'>, ingredientId: IngredientId): number {
  return (state.storage.legacyOverflow[ingredientId] ?? 0) + state.storage.inventories.reduce((sum, inventory) => sum + (inventory.items[ingredientId] ?? 0), 0);
}

export function storageHasContents(state: Pick<GameState, 'storage'>, placedFurnitureId: string): boolean {
  const inventory = state.storage.inventories.find((item) => item.placedFurnitureId === placedFurnitureId);
  return Boolean(inventory && Object.values(inventory.items).some((amount) => (amount ?? 0) > 0));
}

export function storageTargetPoint(construction: ConstructionSaveState, placedFurnitureId: string): { point: { x: number; y: number }; workSlotId: string } | undefined {
  const furniture = construction.placedFurniture.find((item) => item.id === placedFurnitureId);
  if (!furniture || !STORAGE_BY_FURNITURE[furniture.definitionId]) return undefined;
  const slot = resolvedWorkSlots(furniture).find((candidate) => ['stocker', 'any'].includes(candidate.role));
  return slot ? { point: slot.point, workSlotId: `${furniture.id}:${slot.id}` } : undefined;
}

export function compatibleStorageNames(state: Pick<GameState, 'storage'>, ingredientId: IngredientId): string[] {
  return compatibleInventories(state.storage.inventories, ingredientId).map((inventory) => inventory.placedFurnitureId);
}

function storage(furnitureDefinitionId: string, storageType: StorageType, baseCapacity: number, allowedIngredientTags: StorageType[]): StorageDefinition {
  return { furnitureDefinitionId, storageType, baseCapacity, allowedIngredientTags, workSlots: ['work'], levelCapacityMultiplier: BALANCE.storage.levelCapacityMultiplier };
}

function compatibleInventories(inventories: StorageInventory[], ingredientId: IngredientId): StorageInventory[] {
  const ingredient = INGREDIENT_BY_ID[ingredientId];
  return inventories.filter((inventory) => ingredient.compatibleStorageTypes.includes(inventory.storageType)).sort((left, right) => {
    const exactLeft = left.storageType === ingredient.storageType ? 1 : 0;
    const exactRight = right.storageType === ingredient.storageType ? 1 : 0;
    return exactRight - exactLeft || left.placedFurnitureId.localeCompare(right.placedFurnitureId);
  });
}

function preserveExistingAllocations(previous: StorageInventory[], current: StorageInventory[], remaining: Record<IngredientId, number>): void {
  for (const old of previous) {
    const target = current.find((item) => item.placedFurnitureId === old.placedFurnitureId);
    if (!target) continue;
    for (const ingredient of INGREDIENTS) {
      const amount = Math.min(Math.max(0, old.items[ingredient.id] ?? 0), remaining[ingredient.id]);
      const accepted = Math.min(amount, Math.floor((target.maxCapacity - target.currentCapacity) / ingredient.storageSize));
      if (!accepted) continue;
      target.items[ingredient.id] = accepted;
      target.currentCapacity += accepted * ingredient.storageSize;
      remaining[ingredient.id] -= accepted;
    }
  }
}

function storageTypeLabel(type: StorageType): string { return { dry: 'seco', refrigerated: 'refrigerado', frozen: 'congelado', general: 'geral' }[type]; }
