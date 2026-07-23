import type { RecipeId } from '../../core/types';
import { RECIPES } from '../../content/recipes/recipes';
import type { BlenderRenderedAsset } from './blenderManifest';

export const FOOD_ASSET_BY_RECIPE: Record<RecipeId, string> = Object.fromEntries(RECIPES.map((recipe) => [recipe.id, recipe.assetId]));
export const FOOD_CLEAN_ASSET_ID = 'food_clean';
export const FOOD_DIRTY_ASSET_ID = 'food_dirty';
export const FOOD_DISPLAY_SCALE = .5;

const foodAsset = (assetId: string): BlenderRenderedAsset => {
  const legacyDish = assetId === FOOD_CLEAN_ASSET_ID || assetId === FOOD_DIRTY_ASSET_ID;
  const path = legacyDish ? `/assets/pixel/rendered/food/${assetId}.png` : `/assets/pixel/rendered/food/v008/${assetId}.png`;
  return ({
  assetId, kind:'furniture', category:'food/served', renderedFile:path,
  spriteSheet:path, thumbnail:legacyDish ? `/assets/pixel/rendered/food/thumbnails/${assetId}.png` : `/assets/pixel/rendered/food/v008/thumbnails/${assetId}.png`,
  visualLevel:1, footprint:[1,1], anchor:[.5,.5], orientations:['ne','nw','se','sw'], animations:{idle:1}, frameCount:legacyDish ? 1 : 4, frameSize:[96,96],
  sourceBlend:'art_source/blender/food/cafe_mania_food_library_v008.blend', sourceCollection:`ASSET_${assetId}`,
  paletteVersion:'cafe-mania-low-poly-v008', renderVersion:'0.0.8-food-2', transparent:true, interactionPoints:[],
  qualityProfile:'cafe-mania-low-poly-food-v2', nativeScale:FOOD_DISPLAY_SCALE,
  visualBounds:{widthCells:.72,depthCells:.72,heightBlocks:.46,overhangCells:0},
}); };

export const STAGE_2D_FOOD_ASSETS = [...Object.values(FOOD_ASSET_BY_RECIPE).map(foodAsset), foodAsset(FOOD_CLEAN_ASSET_ID), foodAsset(FOOD_DIRTY_ASSET_ID)];
export function recipeFoodAssetId(recipeId: RecipeId | undefined): string { return recipeId ? FOOD_ASSET_BY_RECIPE[recipeId] : FOOD_CLEAN_ASSET_ID; }
export function recipeFoodThumbnail(recipeId: RecipeId): string { return `/assets/pixel/rendered/food/v008/thumbnails/${FOOD_ASSET_BY_RECIPE[recipeId]}.png?v=0.0.8-food-2`; }
