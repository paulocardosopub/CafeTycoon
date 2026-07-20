import type { ExpansionDefinition } from '../../core/types';

export const EXPANSIONS: readonly ExpansionDefinition[] = [
  { id: 'expansion-small-4x4', width: 4, depth: 4, unlockLevel: 1, coinCost: 180, allowedSides: ['north', 'east', 'south', 'west'], prerequisites: [] },
  { id: 'expansion-medium-6x6', width: 6, depth: 6, unlockLevel: 2, coinCost: 420, allowedSides: ['north', 'east', 'south', 'west'], prerequisites: ['expansion-small-4x4'] },
  { id: 'expansion-large-8x8', width: 8, depth: 8, unlockLevel: 3, coinCost: 820, allowedSides: ['north', 'east', 'south', 'west'], prerequisites: ['expansion-medium-6x6'] },
] as const;

export const EXPANSION_BY_ID = Object.fromEntries(EXPANSIONS.map((item) => [item.id, item])) as Record<string, ExpansionDefinition>;
