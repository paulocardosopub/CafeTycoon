import type { Direction, PlacedFurniture, RecipeId, ServiceCounterConnection, ServiceCounterModule } from '../../../core/types';
import { FURNITURE_BY_ID } from '../../data/furniture/catalog';
import { resolvedWorkSlots } from '../furniture/FurniturePlacement';

export const COUNTER_CAPACITY_BY_LEVEL = [0, 24, 48, 96, 999] as const;

export function isServiceCounter(item: PlacedFurniture): boolean {
  return ['C1', 'C2', 'C3', 'C4'].includes(FURNITURE_BY_ID[item.definitionId]?.code ?? '');
}

export function modulesFromFurniture(furniture: readonly PlacedFurniture[], previous: readonly ServiceCounterModule[] = []): ServiceCounterModule[] {
  const prior = new Map(previous.map((item) => [item.id, item]));
  const modules = furniture.filter(isServiceCounter).map((item) => {
    const slots = resolvedWorkSlots(item);
    const old = prior.get(item.id);
    return {
      id: item.id, gridX: item.gridX, gridY: item.gridY, orientation: item.orientation,
      assignedRecipeId: old?.assignedRecipeId,
      currentQuantity: Math.max(0, Math.min(999, Math.floor(old?.currentQuantity ?? 0))),
      reservedQuantity: Math.max(0, Math.floor(old?.reservedQuantity ?? 0)),
      incomingReservedQuantity: Math.max(0, Math.floor(old?.incomingReservedQuantity ?? 0)),
      maxCapacity: COUNTER_CAPACITY_BY_LEVEL[Math.min(4, Math.max(1, item.level))],
      skinId: item.skinId, level: item.level, connectionVariant: 'isolated' as ServiceCounterConnection,
      kitchenDropSlot: slots.find((slot) => slot.purpose === 'kitchen-drop')?.point ?? { x: item.gridX, y: item.gridY - 1 },
      waiterPickupSlot: slots.find((slot) => slot.purpose === 'waiter-pickup')?.point ?? { x: item.gridX, y: item.gridY + 1 },
    };
  });
  return calculateCounterConnections(modules);
}

export function calculateCounterConnections(input: readonly ServiceCounterModule[]): ServiceCounterModule[] {
  return input.map((module) => {
    const [previousPoint, nextPoint] = connectionPoints(module);
    const compatible = (point: { x: number; y: number }) => input.some((other) => other.id !== module.id && other.gridX === point.x && other.gridY === point.y && sameAxis(other.orientation, module.orientation));
    const previous = compatible(previousPoint);
    const next = compatible(nextPoint);
    const connectionVariant: ServiceCounterConnection = previous && next ? 'middle' : next ? 'left' : previous ? 'right' : 'isolated';
    return { ...module, connectionVariant };
  });
}

export class ServiceCounterStore {
  constructor(public readonly modules: ServiceCounterModule[]) {}

  total(recipeId: RecipeId): number {
    return this.modules.filter((item) => item.assignedRecipeId === recipeId).reduce((sum, item) => sum + item.currentQuantity, 0);
  }

  available(recipeId: RecipeId): number {
    return this.modules.filter((item) => item.assignedRecipeId === recipeId).reduce((sum, item) => sum + Math.max(0, item.currentQuantity - item.reservedQuantity), 0);
  }

  assign(moduleId: string, recipeId: RecipeId): boolean {
    const module = this.modules.find((item) => item.id === moduleId);
    if (!module || module.currentQuantity > 0 || module.reservedQuantity > 0) return false;
    module.assignedRecipeId = recipeId; return true;
  }

  deposit(recipeId: RecipeId, quantity: number): number {
    let remaining = Math.max(0, Math.floor(quantity));
    for (const module of this.modules.filter((item) => item.assignedRecipeId === recipeId)) {
      const accepted = Math.min(remaining, module.maxCapacity - module.currentQuantity);
      module.currentQuantity += accepted; remaining -= accepted;
      if (!remaining) break;
    }
    return quantity - remaining;
  }

  reserve(recipeId: RecipeId, quantity: number): { moduleId: string; quantity: number }[] | undefined {
    const requested = Math.max(0, Math.floor(quantity));
    if (!requested || this.available(recipeId) < requested) return undefined;
    let remaining = requested;
    const reservation: { moduleId: string; quantity: number }[] = [];
    for (const module of this.modules.filter((item) => item.assignedRecipeId === recipeId)) {
      const amount = Math.min(remaining, module.currentQuantity - module.reservedQuantity);
      if (!amount) continue;
      module.reservedQuantity += amount; reservation.push({ moduleId: module.id, quantity: amount }); remaining -= amount;
      if (!remaining) break;
    }
    return reservation;
  }

  consume(reservation: readonly { moduleId: string; quantity: number }[]): boolean {
    if (reservation.some((part) => {
      const module = this.modules.find((item) => item.id === part.moduleId);
      return !module || module.reservedQuantity < part.quantity || module.currentQuantity < part.quantity;
    })) return false;
    for (const part of reservation) {
      const module = this.modules.find((item) => item.id === part.moduleId)!;
      module.reservedQuantity -= part.quantity; module.currentQuantity -= part.quantity;
    }
    return true;
  }

  release(reservation: readonly { moduleId: string; quantity: number }[]): void {
    for (const part of reservation) {
      const module = this.modules.find((item) => item.id === part.moduleId);
      if (module) module.reservedQuantity = Math.max(0, module.reservedQuantity - part.quantity);
    }
  }
}

function sameAxis(a: Direction, b: Direction): boolean {
  return (a === 'sw' || a === 'ne') === (b === 'sw' || b === 'ne');
}

function connectionPoints(module: ServiceCounterModule): [{ x: number; y: number }, { x: number; y: number }] {
  return module.orientation === 'sw' || module.orientation === 'ne'
    ? [{ x: module.gridX - 1, y: module.gridY }, { x: module.gridX + 1, y: module.gridY }]
    : [{ x: module.gridX, y: module.gridY - 1 }, { x: module.gridX, y: module.gridY + 1 }];
}

