import { GAME_VERSION, SAVE_SCHEMA_VERSION } from '../../config/balance';
import type { GameState } from '../../core/types';
import { sanitizeInventory } from '../inventory/InventoryService';
import { createDefaultState } from './defaultState';

export function migrateAndSanitizeSave(raw: GameState | null, now = Date.now()): GameState {
  if (!raw || typeof raw !== 'object') return createDefaultState(now);
  const fallback = createDefaultState(now);
  const state: GameState = {
    ...fallback,
    ...raw,
    schemaVersion: SAVE_SCHEMA_VERSION,
    gameVersion: GAME_VERSION,
    coins: Math.max(0, Number(raw.coins) || 0),
    restaurantXp: Math.max(0, Number(raw.restaurantXp) || 0),
    restaurantLevel: Math.max(1, Math.min(3, Number(raw.restaurantLevel) || 1)),
    reputation: Math.max(0, Math.min(100, Number(raw.reputation) || 0)),
    inventory: sanitizeInventory(raw.inventory ?? {}),
    inventoryReserved: sanitizeReservations(raw.inventoryReserved, sanitizeInventory(raw.inventory ?? {})),
    readyDishes: { ...fallback.readyDishes, ...(raw.readyDishes ?? {}) },
    productionQueue: Array.isArray(raw.productionQueue) ? raw.productionQueue.slice(0, 20) : [],
    upgrades: { ...fallback.upgrades, ...(raw.upgrades ?? {}) },
    stats: { ...fallback.stats, ...(raw.stats ?? {}) },
    graphics: raw.graphics?.dataVersion === 2 && Array.isArray(raw.graphics.objects) ? raw.graphics : fallback.graphics,
    operation: sanitizeOperation(raw.operation),
  };
  for (const key of Object.keys(state.readyDishes) as (keyof typeof state.readyDishes)[]) state.readyDishes[key] = Math.max(0, Math.floor(Number(state.readyDishes[key]) || 0));
  return state;
}

function sanitizeReservations(input: GameState['inventoryReserved'] | undefined, inventory: GameState['inventory']): GameState['inventoryReserved'] {
  const fallback = createDefaultState(0).inventoryReserved;
  for (const id of Object.keys(fallback) as (keyof typeof fallback)[]) {
    fallback[id] = Math.max(0, Math.min(inventory[id], Math.floor(Number(input?.[id]) || 0)));
  }
  return fallback;
}

function sanitizeOperation(input: GameState['operation']): GameState['operation'] {
  if (!input || input.dataVersion !== 1) return undefined;
  const arrays = ['actors', 'customers', 'orders', 'tables', 'stations', 'tasks', 'counterSlots'] as const;
  if (arrays.some((key) => !Array.isArray(input[key]))) return undefined;
  return { ...input, simulationTime: Math.max(0, Number(input.simulationTime) || 0), customerSequence: Math.max(0, Math.floor(Number(input.customerSequence) || 0)), spawnCountdown: Math.max(0, Number(input.spawnCountdown) || 0) };
}
