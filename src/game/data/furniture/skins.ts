import type { FurnitureSkin } from '../../../core/types';
import { FURNITURE_DEFINITIONS } from './catalog';

export const FURNITURE_SKINS: readonly FurnitureSkin[] = FURNITURE_DEFINITIONS.flatMap((definition) => definition.skinIds.map((id) => ({
  id: `${definition.id}:${id}`,
  furnitureDefinitionId: definition.id,
  name: id.replaceAll('-', ' '),
  spriteSet: { ...definition.spriteSet },
  palette: id,
  unlockLevel: id.endsWith('green') || id.endsWith('oak') ? 2 : 1,
  price: id === definition.skinIds[0] ? 0 : Math.max(20, Math.floor(definition.price * .2)),
})));

