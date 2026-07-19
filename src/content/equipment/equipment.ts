import type { Direction } from '../../core/types';

export type EquipmentFamilyId = 'stove' | 'oven' | 'refrigerator' | 'grill' | 'coffee_machine' | 'preparation' | 'sink' | 'cauldron' | 'assembly';

export interface EquipmentAssetDefinition {
  id: string;
  name: string;
  equipmentFamilyId: EquipmentFamilyId;
  visualLevel: number;
  gameplayLevel: number;
  assetId: string;
  thumbnailId: string;
  footprint: { width: number; depth: number };
  orientation: Direction;
  interactionSlots: readonly string[];
  animationSet: 'equipment-basic-v1';
  nextLevelAssetId: string;
  unlockRequirement: { restaurantLevel: number };
  statsConfigId: string;
}

function levelOne(family: EquipmentFamilyId, name: string, width = 1): EquipmentAssetDefinition {
  const assetId = `${family}_level_1`;
  return {
    id: assetId, name, equipmentFamilyId: family, visualLevel: 1, gameplayLevel: 1,
    assetId, thumbnailId: `${assetId}_thumb`, footprint: { width, depth: 1 }, orientation: 'sw',
    interactionSlots: ['ingredientPoint', 'workPoint', 'outputPoint'], animationSet: 'equipment-basic-v1',
    nextLevelAssetId: `${family}_level_2`, unlockRequirement: { restaurantLevel: 1 }, statsConfigId: `${family}_stats_level_1`,
  };
}

export const EQUIPMENT_ASSETS: readonly EquipmentAssetDefinition[] = [
  levelOne('stove', 'Fogão', 2), levelOne('oven', 'Forno', 2), levelOne('refrigerator', 'Geladeira', 2),
  levelOne('grill', 'Grelha'), levelOne('coffee_machine', 'Cafeteira'), levelOne('preparation', 'Bancada de preparo', 2),
  levelOne('sink', 'Pia', 2), levelOne('cauldron', 'Caldeirão'), levelOne('assembly', 'Bancada de montagem', 2),
] as const;

export const EQUIPMENT_BY_FAMILY = Object.fromEntries(EQUIPMENT_ASSETS.map((item) => [item.equipmentFamilyId, item])) as Record<EquipmentFamilyId, EquipmentAssetDefinition>;

export function applyEquipmentAsset<T extends object>(runtime: T, definition: EquipmentAssetDefinition): T & {
  equipmentFamilyId: EquipmentFamilyId; visualLevel: number; gameplayLevel: number; renderedAssetId: string;
  thumbnailId: string; interactionSlots: readonly string[]; animationSet: string; nextLevelAssetId: string;
  unlockRequirement: { restaurantLevel: number }; statsConfigId: string;
} {
  return {
    ...runtime,
    equipmentFamilyId: definition.equipmentFamilyId,
    visualLevel: definition.visualLevel,
    gameplayLevel: definition.gameplayLevel,
    renderedAssetId: definition.assetId,
    thumbnailId: definition.thumbnailId,
    interactionSlots: definition.interactionSlots,
    animationSet: definition.animationSet,
    nextLevelAssetId: definition.nextLevelAssetId,
    unlockRequirement: definition.unlockRequirement,
    statsConfigId: definition.statsConfigId,
  };
}
