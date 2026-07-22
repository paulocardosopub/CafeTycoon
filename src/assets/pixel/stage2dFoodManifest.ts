import type { RecipeId } from '../../core/types';
import type { BlenderRenderedAsset } from './blenderManifest';

export const FOOD_ASSET_BY_RECIPE: Record<RecipeId, string> = {
  coffee: 'food_coffee',
  omelette: 'food_omelette',
  burger: 'food_burger',
  soup: 'food_soup',
};

export const FOOD_CLEAN_ASSET_ID = 'food_clean';
export const FOOD_DIRTY_ASSET_ID = 'food_dirty';
export const FOOD_DISPLAY_SCALE = .5;

const foodAsset = (assetId: string): BlenderRenderedAsset => ({
  assetId,
  kind: 'furniture',
  category: 'food/served',
  renderedFile: `/assets/pixel/rendered/food/${assetId}.png`,
  spriteSheet: `/assets/pixel/rendered/food/${assetId}.png`,
  thumbnail: `/assets/pixel/rendered/food/thumbnails/${assetId}.png`,
  visualLevel: 1,
  footprint: [1, 1],
  anchor: [.5, .5],
  orientations: ['ne', 'nw', 'se', 'sw'],
  animations: { idle: 1 },
  frameCount: 1,
  frameSize: [96, 96],
  sourceBlend: 'art_source/blender/food/c3_br_food_library_v007.blend',
  sourceCollection: `ASSET_${assetId}`,
  paletteVersion: 'bistro-bloom-original-v1',
  renderVersion: '0.0.7-food-1',
  transparent: true,
  interactionPoints: [],
  qualityProfile: 'c3-br-low-poly-food-v1',
  nativeScale: FOOD_DISPLAY_SCALE,
  visualBounds: { widthCells: .72, depthCells: .72, heightBlocks: .46, overhangCells: 0 },
});

export const STAGE_2D_FOOD_ASSETS = [
  ...Object.values(FOOD_ASSET_BY_RECIPE),
  FOOD_CLEAN_ASSET_ID,
  FOOD_DIRTY_ASSET_ID,
].map(foodAsset);

export function recipeFoodAssetId(recipeId: RecipeId | undefined): string {
  return recipeId ? FOOD_ASSET_BY_RECIPE[recipeId] : FOOD_CLEAN_ASSET_ID;
}

export function recipeFoodThumbnail(recipeId: RecipeId): string {
  return `/assets/pixel/rendered/food/thumbnails/${FOOD_ASSET_BY_RECIPE[recipeId]}.png?v=0.0.7-food-1`;
}
