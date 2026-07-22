import type { GameState, RecipeDefinition, StationId } from '../../core/types';
import { FURNITURE_BY_ID, FURNITURE_DEFINITIONS } from '../data/furniture/catalog';

export interface RecipeRequirementStatus {
  id: string;
  label: string;
  satisfied: boolean;
}

const FALLBACK_STATION_NAMES: Partial<Record<StationId, string>> = {
  pickup: 'Balcão de serviço',
  coffee_machine: 'Máquina de café',
  prep: 'Bancada de preparação',
  stove: 'Fogão',
  grill: 'Chapa ou grelha',
  assembly: 'Estação de montagem',
  cauldron: 'Caldeira',
};

export function recipeRequirements(state: Pick<GameState, 'restaurantLevel' | 'construction'>, recipe: RecipeDefinition): RecipeRequirementStatus[] {
  const installedFunctions = new Set(state.construction.placedFurniture.map((item) => FURNITURE_BY_ID[item.definitionId]?.functionId));
  const stationIds = [...new Set(recipe.steps.map((step) => step.stationId))];
  return [
    { id: 'level', label: `Nível ${recipe.requiredLevel}`, satisfied: state.restaurantLevel >= recipe.requiredLevel },
    ...stationIds.map((stationId) => ({
      id: `station:${stationId}`,
      label: stationName(stationId),
      satisfied: installedFunctions.has(stationId),
    })),
  ];
}

export function recipeIsOperational(state: Pick<GameState, 'restaurantLevel' | 'construction'>, recipe: RecipeDefinition): boolean {
  return recipeRequirements(state, recipe).every((requirement) => requirement.satisfied);
}

function stationName(stationId: StationId): string {
  if (FALLBACK_STATION_NAMES[stationId]) return FALLBACK_STATION_NAMES[stationId]!;
  return FURNITURE_DEFINITIONS.find((definition) => definition.functionId === stationId)?.name ?? stationId;
}
