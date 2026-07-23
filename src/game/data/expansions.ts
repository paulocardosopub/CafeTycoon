import type { ExpansionDefinition } from '../../core/types';

export const EXPANSIONS: readonly ExpansionDefinition[] = [
  { id: 'restaurant-expansion-1', width: 18, depth: 18, unlockLevel: 20, coinCost: 600, allowedSides: ['east'], prerequisites: [] },
  { id: 'restaurant-expansion-2', width: 18, depth: 18, unlockLevel: 40, coinCost: 1_200, allowedSides: ['south'], prerequisites: ['restaurant-expansion-1'] },
  { id: 'restaurant-expansion-3', width: 18, depth: 18, unlockLevel: 60, coinCost: 2_200, allowedSides: ['east'], prerequisites: ['restaurant-expansion-2'] },
] as const;

export const RESTAURANT_EXPANSION_ORIGINS: Readonly<Record<string, { x: number; y: number }>> = {
  'restaurant-expansion-1': { x: 18, y: 0 },
  'restaurant-expansion-2': { x: 18, y: 18 },
  'restaurant-expansion-3': { x: 36, y: 0 },
};

export const EXPANSION_BY_ID = Object.fromEntries(EXPANSIONS.map((item) => [item.id, item])) as Record<string, ExpansionDefinition>;
