import type { C3BrRenderedAsset } from './c3brManifest';
import { STAGE_2C_CHARACTER_ASSETS } from './stage2cCharacterManifest';

interface VariantSpec { assetId: string; baseAssetId: string; displayName: string; }

export const C3_BR_VARIANT_SPECS: readonly VariantSpec[] = [
  { assetId: 'char_staff_cook_hat_white_01', baseAssetId: 'char_cook_female_01', displayName: 'Chef com chapéu branco' },
  { assetId: 'char_staff_service_chef_01', baseAssetId: 'char_waiter_male_01', displayName: 'Equipe de salão' },
  { assetId: 'char_staff_cleaner_chef_01', baseAssetId: 'char_player_female_01', displayName: 'Equipe de limpeza' },
  { assetId: 'char_staff_stocker_chef_01', baseAssetId: 'char_player_male_01', displayName: 'Equipe de estoque' },
  ...Array.from({ length: 16 }, (_, index) => ({
    assetId: `char_variant_customer_${String(index + 1).padStart(2, '0')}`,
    baseAssetId: `char_customer_${String((index % 6) + 1).padStart(2, '0')}`,
    displayName: `Personagem colorido ${String(index + 1).padStart(2, '0')}`,
  })),
];

export const C3_BR_VARIANT_ASSETS: C3BrRenderedAsset[] = C3_BR_VARIANT_SPECS.map((variant) => {
  const base = STAGE_2C_CHARACTER_ASSETS.find((asset) => asset.assetId === variant.baseAssetId);
  if (!base) throw new Error(`Base de personagem ausente: ${variant.baseAssetId}`);
  const relative = `/assets/pixel/rendered/characters/c3_br_variants/${variant.assetId}.png`;
  return {
    ...base,
    assetId: variant.assetId,
    displayName: variant.displayName,
    category: 'characters/c3_br/variants',
    renderedFile: relative,
    spriteSheet: relative,
    thumbnail: `/assets/pixel/rendered/thumbnails/${variant.assetId}.png`,
    sourceCollection: `palette:${variant.baseAssetId}`,
    renderVersion: '0.0.7-c3-br-palette-variants-v1',
    paletteVersion: 'c3-br-local-palette-variants-v1',
    identityProfile: `${variant.assetId}:palette-variant-of:${variant.baseAssetId}`,
    referenceMode: 'local-palette-variant-from-approved-3d-render',
  };
});

export const STAFF_ROLE_CHARACTER_ASSETS = {
  cook: 'char_staff_cook_hat_white_01',
  waiter: 'char_staff_service_chef_01',
  cleaner: 'char_staff_cleaner_chef_01',
  stocker: 'char_staff_stocker_chef_01',
} as const;

export const CUSTOMER_CHARACTER_ASSET_IDS = [
  ...STAGE_2C_CHARACTER_ASSETS.filter((asset) => asset.role === 'customer').map((asset) => asset.assetId),
  ...C3_BR_VARIANT_SPECS.filter((variant) => variant.assetId.startsWith('char_variant_customer_')).map((variant) => variant.assetId),
] as readonly string[];
