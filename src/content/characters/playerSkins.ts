import { C3_BR_CHARACTER_ASSETS } from '../../assets/pixel/c3brManifest';
import { C3_BR_VARIANT_ASSETS } from '../../assets/pixel/characterVariantManifest';
import type { CharacterAppearance } from '../../core/types';

const PLAYER_DEFAULT_ASSET_ID = 'char_staff_stocker_chef_01';
const FORMER_PLAYER_ASSET_ID = 'char_player_male_01';
const playerAssets = [
  ...C3_BR_VARIANT_ASSETS.filter((asset) => asset.assetId === PLAYER_DEFAULT_ASSET_ID),
  ...C3_BR_CHARACTER_ASSETS.filter((asset) => asset.assetId !== FORMER_PLAYER_ASSET_ID),
  ...C3_BR_VARIANT_ASSETS.filter((asset) => asset.assetId !== PLAYER_DEFAULT_ASSET_ID),
];

export const PLAYER_SKINS = playerAssets.map((asset) => ({
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
  return appearance?.presentation === 'masculina' ? PLAYER_DEFAULT_ASSET_ID : 'char_player_female_01';
}
