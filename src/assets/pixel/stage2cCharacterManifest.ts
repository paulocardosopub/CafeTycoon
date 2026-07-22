import type { C3BrRenderedAsset } from './c3brManifest';
import { C3_BR_CHARACTER_ASSETS } from './c3brManifest';

const SHARED = { idle: 4, walk: 8, turn: 6, pickup: 6, place: 6 };
const ROLE_ANIMATIONS: Record<C3BrRenderedAsset['role'], Record<string, number>> = {
  player: {
    carry_plate_idle: 4, carry_plate_walk: 8, carry_tray_idle: 4, carry_tray_walk: 8,
    carry_ingredient_idle: 4, carry_ingredient_walk: 8, prep_counter: 8, cook_stove: 8,
    wash_sink: 8, serve_table: 6, clear_table: 6, clean_table: 8, talk: 6,
  },
  cook: {
    carry_plate_idle: 4, carry_plate_walk: 8, carry_ingredient_idle: 4, carry_ingredient_walk: 8,
    prep_counter: 8, cook_stove: 8, wash_sink: 8, place_dish: 6, wait_workstation: 4,
  },
  waiter: {
    carry_plate_idle: 4, carry_plate_walk: 8, carry_tray_idle: 4, carry_tray_walk: 8,
    pickup_dish: 6, serve_table: 6, clear_table: 6, clean_table: 8, wait_service: 4,
  },
  customer: {
    sit_down: 6, seated_idle: 4, wait_food: 4, eat: 8, drink: 8,
    react_happy: 6, react_impatient: 6, stand_up: 6,
  },
};

const SOURCE_COLLECTIONS = [
  'C3_STATIC_01_Jogador_masculino', 'C3_STATIC_02_Jogadora_feminina', 'C3_STATIC_03_Cozinheira',
  'C3_STATIC_04_Garçom', 'C3_STATIC_05_Cliente_streetwear', 'C3_STATIC_06_Cliente_idosa',
  'C3_STATIC_07_Cliente_meia-idade', 'C3_STATIC_08_Cliente_esportiva',
  'C3_STATIC_09_Cliente_com_óculos', 'C3_STATIC_10_Cliente_madura',
];

export const STAGE_2C_RIG_ID = 'C3BR_Humanoid_Approved_v3';
export const STAGE_2C_CHARACTER_ASSETS: C3BrRenderedAsset[] = C3_BR_CHARACTER_ASSETS.map((asset, index) => {
  const animations = { ...SHARED, ...ROLE_ANIMATIONS[asset.role] };
  const fps = Object.fromEntries(Object.keys(animations).map((name) => [name, name.includes('walk') || ['eat', 'drink', 'cook_stove', 'prep_counter', 'wash_sink', 'clean_table'].includes(name) ? 8 : 6]));
  const loops = Object.fromEntries(Object.keys(animations).map((name) => [name, !['turn', 'pickup', 'place', 'pickup_dish', 'place_dish', 'serve_table', 'clear_table', 'sit_down', 'stand_up', 'react_happy'].includes(name)]));
  return {
    ...asset,
    animations,
    frameCount: Object.values(animations).reduce((total, count) => total + count, 0),
    // The opaque shoe pixels end at y=157/158 in the 168px frame. Anchoring at
    // 160 left a visible air gap above the logical tile contact point.
    anchor: [56, 158],
    orientations: ['sw', 'nw', 'ne', 'se'],
    screenDirections: { se: 'down', sw: 'left', nw: 'up', ne: 'right' },
    fps,
    loops,
    sourceBlend: 'art_source/blender/characters/c3_br_shared_rig_stage_2c.blend',
    sourceCollection: SOURCE_COLLECTIONS[index],
    renderVersion: '0.0.7-stage-2c-shared-rig-v1',
    qualityProfile: 'c3-br-approved-cubic-shared-rig-v1',
    nativeScale: 0.72,
    rigId: STAGE_2C_RIG_ID,
    facialRig: 'none',
    fallback: 'idle',
    referenceMode: 'approved-static-character-source',
  };
});

export const STAGE_2C_CHARACTER_ASSET_IDS = new Set(STAGE_2C_CHARACTER_ASSETS.map((asset) => asset.assetId));
