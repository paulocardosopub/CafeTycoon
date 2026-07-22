import { C3_BR_CHARACTER_ASSETS } from '../../assets/pixel/c3brManifest';
import { C3_BR_VARIANT_ASSETS } from '../../assets/pixel/characterVariantManifest';
import type { CharacterAppearance } from '../../core/types';

export const PLAYER_SKINS = [...C3_BR_CHARACTER_ASSETS, ...C3_BR_VARIANT_ASSETS].map((asset) => ({
  assetId: asset.assetId,
  label: asset.displayName,
  presentation: asset.presentation,
  thumbnail: asset.thumbnail,
})) as readonly {
  assetId: string;
  label: string;
  presentation: CharacterAppearance['presentation'];
  thumbnail: string;
}[];

const PLAYER_SKIN_IDS = new Set(PLAYER_SKINS.map((skin) => skin.assetId));

export function playerSkinAsset(appearance?: Pick<CharacterAppearance, 'assetId' | 'presentation'>): string {
  if (appearance?.assetId && PLAYER_SKIN_IDS.has(appearance.assetId)) return appearance.assetId;
  return appearance?.presentation === 'masculina' ? 'char_player_male_01' : 'char_player_female_01';
}
