import type { ServiceCounterConnection } from '../../../core/types';
import { productionFurnitureAssetId, PRODUCTION_V003_FURNITURE_SPECS } from '../../../assets/pixel/productionV003Manifest';
import { FURNITURE_BY_ID } from './catalog';

export const MIN_FURNITURE_LEVEL = 1;
export const MAX_FURNITURE_LEVEL = 5;
export const FURNITURE_LEVEL_UNLOCKS = [1, 8, 20, 40, 65] as const;
const UPGRADE_COST_MULTIPLIERS = [0, .40, .70, 1.05, 1.50] as const;

export const ACTIVE_PRODUCTION_V003_FURNITURE_IDS = new Set(PRODUCTION_V003_FURNITURE_SPECS.map((item) => item.furnitureId));

function productionFurnitureDefinitionId(definitionId: string): string {
  return FURNITURE_BY_ID[definitionId]?.functionId === 'pickup' ? 'service.c1.isolated' : definitionId;
}

export function clampFurnitureLevel(level: unknown): number {
  return Math.max(MIN_FURNITURE_LEVEL, Math.min(MAX_FURNITURE_LEVEL, Math.floor(Number(level) || MIN_FURNITURE_LEVEL)));
}

export function furnitureUpgradeUnlockLevel(targetLevel: number): number {
  return FURNITURE_LEVEL_UNLOCKS[clampFurnitureLevel(targetLevel) - 1];
}

export function furnitureUpgradeCost(definitionId: string, currentLevel: number): number | undefined {
  const definition = FURNITURE_BY_ID[definitionId];
  const level = clampFurnitureLevel(currentLevel);
  if (!definition || level >= MAX_FURNITURE_LEVEL || !ACTIVE_PRODUCTION_V003_FURNITURE_IDS.has(productionFurnitureDefinitionId(definitionId))) return undefined;
  const multiplier = UPGRADE_COST_MULTIPLIERS[level];
  return Math.max(50, Math.round(definition.price * multiplier / 50) * 50);
}

export function furnitureLevelAssetId(definitionId: string, level: number, connection?: ServiceCounterConnection, layer?: 'full' | 'back' | 'front'): string | undefined {
  return productionFurnitureAssetId(productionFurnitureDefinitionId(definitionId), clampFurnitureLevel(level), connection, layer);
}
