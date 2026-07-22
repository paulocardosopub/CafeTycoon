import type { BlenderRenderedAsset } from './blenderManifest';

type Stage2BRenderedAsset = BlenderRenderedAsset & {
  screenDirections?: Record<string, string>;
  fallback?: string;
};

function furnitureAsset(
  assetId: string,
  sourceId: string,
  category: string,
  animations: Record<string, number> = { idle: 1 },
  equipmentFamilyId?: string,
): BlenderRenderedAsset {
  const spriteSheet = `/assets/pixel/rendered/${category}/${assetId}.png`;
  return {
    assetId,
    kind: category.startsWith('furniture/') ? 'furniture' : 'equipment',
    category,
    renderedFile: spriteSheet,
    spriteSheet,
    thumbnail: `/assets/pixel/rendered/thumbnails/${assetId}.png`,
    visualLevel: 1,
    gameplayLevel: 1,
    equipmentFamilyId,
    footprint: [1, 1],
    anchor: [0.5, 174 / 192],
    orientations: ['ne', 'nw', 'se', 'sw'],
    animations,
    frameCount: Object.values(animations).reduce((total, frames) => total + frames, 0),
    frameSize: [192, 192],
    sourceBlend: 'art_source/blender/furniture/c3_br_furniture_aligned_render_stage_2b.blend',
    sourceCollection: `ASSET_${sourceId}`,
    paletteVersion: 'c3-br-modular-furniture-v1',
    renderVersion: '0.0.7-stage-2b-exact-tile-v4',
    transparent: true,
    interactionPoints: [[0, 1]],
    qualityProfile: 'c3-br-cartoon-3d-modular-exact-tile-v4',
    nativeScale: 1,
    visualSkinId: category.startsWith('furniture/') ? 'counter-oak' : 'equipment-steel-level-1',
    layerRole: assetId.endsWith('_back') ? 'back' : assetId.endsWith('_front') ? 'front' : 'full',
    visualBounds: { widthCells: 1, depthCells: 1, heightBlocks: 1.8, overhangCells: 0.12 },
  };
}

export const STAGE_2B_FURNITURE_ASSETS: BlenderRenderedAsset[] = [
  furnitureAsset('a1_stove_industrial', 'stove', 'equipment/stoves', { off: 1, active: 2, complete: 1 }, 'stove'),
  furnitureAsset('a2_convection_oven', 'oven', 'equipment/ovens', { idle: 1 }, 'oven'),
  furnitureAsset('a3_griddle', 'griddle', 'equipment/griddles', { idle: 1 }, 'grill'),
  furnitureAsset('a4_fryer', 'fryer', 'equipment/fryers', { idle: 1 }, 'grill'),
  furnitureAsset('a5_kettle', 'kettle', 'equipment/kettles', { idle: 1 }, 'cauldron'),
  furnitureAsset('a6_grill', 'griddle', 'equipment/grills', { idle: 1 }, 'grill'),
  furnitureAsset('a7_bakery_oven', 'oven', 'equipment/ovens', { idle: 1 }, 'oven'),
  furnitureAsset('b1_industrial_fridge', 'fridge', 'equipment/refrigerators', { idle: 1 }, 'fridge'),
  furnitureAsset('b2_industrial_freezer', 'freezer', 'equipment/refrigerators', { idle: 1 }, 'fridge'),
  furnitureAsset('b3_preparation_counter', 'prep_counter', 'equipment/preparation', { idle: 1 }, 'prep'),
  furnitureAsset('b4_ingredient_station', 'prep_counter', 'equipment/preparation', { idle: 1 }, 'assembly'),
  furnitureAsset('b5_industrial_sink', 'sink', 'equipment/sinks', { off: 1, active: 2, complete: 1 }, 'sink'),
  furnitureAsset('c1_service_isolated', 'delivery_counter', 'furniture/service-counters'),
  furnitureAsset('c2_service_left', 'delivery_counter', 'furniture/service-counters'),
  furnitureAsset('c3_service_middle', 'delivery_counter', 'furniture/service-counters'),
  furnitureAsset('c4_service_right', 'delivery_counter', 'furniture/service-counters'),
  furnitureAsset('c5_dry_pantry', 'pantry', 'furniture/storage'),
  furnitureAsset('c6_ingredient_shelf', 'ingredient_shelf', 'furniture/storage'),
  furnitureAsset('c7_plate_station', 'plate_storage', 'furniture/support'),
  furnitureAsset('c8_waste_recycling', 'waste_bin', 'furniture/support'),
  furnitureAsset('plant', 'plant', 'furniture/decorations'),
  furnitureAsset('c10_cutting_block', 'prep_counter', 'furniture/support'),
  furnitureAsset('table_two', 'table_2', 'furniture/tables'),
  furnitureAsset('chair_wood', 'dining_chair', 'furniture/chairs'),
  furnitureAsset('chair_wood_back', 'dining_chair', 'furniture/chairs'),
  furnitureAsset('chair_wood_front', 'dining_chair', 'furniture/chairs'),
];

export const STAGE_2B_FURNITURE_ASSET_IDS = new Set(STAGE_2B_FURNITURE_ASSETS.map((asset) => asset.assetId));

export const STAGE_2B_PLAYER_ASSET: Stage2BRenderedAsset = {
  assetId: 'char_player_male_01',
  kind: 'character',
  category: 'characters/c3_br/player_male_01',
  renderedFile: '/assets/pixel/rendered/characters/c3_br/player_male_01/char_player_male_01.png',
  spriteSheet: '/assets/pixel/rendered/characters/c3_br/player_male_01/char_player_male_01.png',
  thumbnail: '/assets/pixel/rendered/thumbnails/char_player_male_01.png',
  visualLevel: 1,
  footprint: [1, 1],
  anchor: [56, 160],
  orientations: ['se', 'sw', 'nw', 'ne'],
  screenDirections: { se: 'down', sw: 'left', nw: 'up', ne: 'right' },
  animations: { idle: 4, walk: 8, turn: 6, prep_counter: 8 },
  frameCount: 26,
  frameSize: [112, 168],
  sourceBlend: 'art_source/blender/characters/c3_br_player_male_rig_stage_2b.blend',
  sourceCollection: 'C3_STATIC_01_Jogador_masculino',
  paletteVersion: 'c3-br-cartoon-3d-cubic-v1',
  renderVersion: '0.0.7-stage-2b-rig-prototype',
  transparent: true,
  interactionPoints: [],
  qualityProfile: 'c3-br-approved-cubic-rig-prototype-v1',
  nativeScale: 0.72,
  logicalHeightBlocks: 1.82,
  identityProfile: 'char_player_male_01:approved-green-white-cubic',
  bodyProfile: 'athletic',
  visualSkinId: 'c3-br-original',
  fallback: 'idle',
  visualBounds: { widthCells: 1, depthCells: 1, heightBlocks: 1.82, overhangCells: 0.27 },
};

export const STAGE_2B_RENDERED_ASSETS: Stage2BRenderedAsset[] = [...STAGE_2B_FURNITURE_ASSETS, STAGE_2B_PLAYER_ASSET];
export const STAGE_2B_RENDERED_ASSET_IDS = new Set(STAGE_2B_RENDERED_ASSETS.map((asset) => asset.assetId));
