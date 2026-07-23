import { BLENDER_RENDERED_ASSETS } from './blenderManifest';
import { C3_BR_VARIANT_ASSETS } from './characterVariantManifest';
import { STAGE_2B_FURNITURE_ASSETS, STAGE_2B_RENDERED_ASSET_IDS } from './stage2bPrototypeManifest';
import { STAGE_2C_CHARACTER_ASSETS } from './stage2cCharacterManifest';
import { STAGE_2D_FOOD_ASSETS } from './stage2dFoodManifest';
import { renderedDirectionRow } from './RenderedDirection';
import type { Direction } from '../../core/types';

const REMOVED_DINING_SKINS = new Set([
  'chair', 'chair_bistro', 'chair_bistro_back', 'chair_bistro_front',
  'chair_upholstered', 'chair_upholstered_back', 'chair_upholstered_front',
  'table_four', 'table_four_green', 'table_two_green',
]);

const EXACT_COUNTER_ASSET_IDS = new Set(BLENDER_RENDERED_ASSETS
  .filter((asset) => asset.counterBaseAssetId === 'c1_service_isolated')
  .map((asset) => asset.assetId));

// Exact counter appliances supersede the old Stage 2B records. In particular,
// the sink and stove sheets contain one frame per direction, not four state
// frames per direction. Keeping both records made every rotation request an
// invalid frame and Phaser fell back to the first/back view.
export const RUNTIME_RENDERED_ASSETS = [
  ...BLENDER_RENDERED_ASSETS.filter((asset) => asset.kind !== 'character'
    && (!STAGE_2B_RENDERED_ASSET_IDS.has(asset.assetId) || EXACT_COUNTER_ASSET_IDS.has(asset.assetId))
    && !REMOVED_DINING_SKINS.has(asset.assetId)),
  ...STAGE_2C_CHARACTER_ASSETS,
  ...C3_BR_VARIANT_ASSETS,
  ...STAGE_2B_FURNITURE_ASSETS.filter((asset) => !EXACT_COUNTER_ASSET_IDS.has(asset.assetId)),
  ...STAGE_2D_FOOD_ASSETS,
];

export function runtimeWorldRenderedFrame(direction: Direction, stateFrame: number, assetId: string): number {
  const asset = RUNTIME_RENDERED_ASSETS.find((candidate) => candidate.assetId === assetId);
  if (!asset) return 0;
  const directionIndex = renderedDirectionRow(direction, asset);
  if (asset.category.startsWith('food/')) return directionIndex;
  const safeStateFrame = Math.min(Math.max(stateFrame, 0), Math.max(0, asset.frameCount - 1));
  return directionIndex * asset.frameCount + safeStateFrame;
}
