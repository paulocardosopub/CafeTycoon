import type { BlenderRenderedAsset } from './blenderManifest';

type ProductionCharacterAsset = BlenderRenderedAsset & {
  displayName: string;
  role: 'customer' | 'cook' | 'waiter' | 'cleaner' | 'player';
  presentation: 'masculina' | 'feminina';
  screenDirections: Record<string, string>;
  fps: Record<string, number>;
  loops: Record<string, boolean>;
  fallback: string;
  rigId: string;
};

const CHARACTER_DIRECTIONS = ['sw', 'nw', 'ne', 'se'];
const FURNITURE_DIRECTIONS = ['sw', 'se', 'ne', 'nw'];
const CUSTOMER_ANIMATIONS = {
  idle: 4, walk: 8, turn: 6, pickup: 6, place: 6,
  sit_down: 6, seated_idle: 4, wait_food: 4, eat: 8, drink: 8,
  react_happy: 6, react_impatient: 6, stand_up: 6,
};
const COOK_ANIMATIONS = {
  idle: 4, walk: 8, turn: 6, pickup: 6, place: 6,
  carry_plate_idle: 4, carry_plate_walk: 8, carry_ingredient_idle: 4, carry_ingredient_walk: 8,
  prep_counter: 8, cook_stove: 8, wash_sink: 8, place_dish: 6, wait_workstation: 4,
};
const WAITER_ANIMATIONS = {
  idle: 4, walk: 8, turn: 6, pickup: 6, place: 6,
  carry_plate_idle: 4, carry_plate_walk: 8, carry_tray_idle: 4, carry_tray_walk: 8,
  pickup_dish: 6, serve_table: 6, clear_table: 6, clean_table: 8, wait_service: 4,
};
const CLEANER_ANIMATIONS = {
  idle: 4, walk: 8, turn: 6, pickup: 6, place: 6, clean_table: 8, wash_sink: 8, wait_service: 4,
};

function characterAsset(
  assetId: string,
  displayName: string,
  role: ProductionCharacterAsset['role'],
  presentation: ProductionCharacterAsset['presentation'],
  animations: Record<string, number>,
): ProductionCharacterAsset {
  const spriteSheet = `/assets/pixel/rendered/production_v003/characters/${assetId}.png`;
  const fps = Object.fromEntries(Object.keys(animations).map((name) => [name, name.includes('walk') || ['eat', 'drink', 'cook_stove', 'prep_counter', 'wash_sink', 'clean_table'].includes(name) ? 8 : 6]));
  const loops = Object.fromEntries(Object.keys(animations).map((name) => [name, !['turn', 'pickup', 'place', 'pickup_dish', 'place_dish', 'serve_table', 'clear_table', 'sit_down', 'stand_up', 'react_happy'].includes(name)]));
  return {
    assetId, displayName, kind: 'character', role, presentation,
    category: role === 'customer' ? 'characters/production_v003/customers' : 'characters/production_v003/staff',
    renderedFile: spriteSheet, spriteSheet,
    thumbnail: `/assets/pixel/rendered/production_v003/thumbnails/${assetId}.png`,
    visualLevel: 1, footprint: [1, 1], anchor: [56, 158], orientations: CHARACTER_DIRECTIONS,
    screenDirections: { sw: 'left', nw: 'up', ne: 'right', se: 'down' },
    animations, frameCount: Object.values(animations).reduce((sum, value) => sum + value, 0), frameSize: [112, 168], fps, loops,
    sourceBlend: 'art_source/blender/sprite_refresh/cafe_tycoon_sprite_refresh_production_v003.blend',
    sourceCollection: `SRC_${assetId}`, paletteVersion: 'cafe-tycoon-v002-approved-production-v003',
    renderVersion: 'production-v003', transparent: true, interactionPoints: [],
    qualityProfile: 'cafe-tycoon-sprite-refresh-v002-approved', nativeScale: .72,
    logicalHeightBlocks: 2.2, identityProfile: `${assetId}:production-v003-modular`, bodyProfile: 'gameplay-standard',
    visualSkinId: 'production-v003', fallback: 'idle', rigId: 'SpriteRefresh_Humanoid_Shared_v002',
    visualBounds: { widthCells: 1, depthCells: 1, heightBlocks: 2.2, overhangCells: .27 },
  };
}

export const PRODUCTION_V003_APPROVED_CUSTOMER_ASSET_IDS = Array.from({ length: 4 }, (_, index) => `char_variant_customer_${String(index + 1).padStart(2, '0')}`) as readonly string[];
export const PRODUCTION_V003_CUSTOMER_ASSET_IDS = Array.from({ length: 30 }, (_, index) => `char_v003_customer_${String(index + 1).padStart(3, '0')}`) as readonly string[];

const approvedCustomers = PRODUCTION_V003_APPROVED_CUSTOMER_ASSET_IDS.map((assetId, index) => characterAsset(assetId, `Cliente aprovado v002 ${index + 1}`, 'customer', index % 2 ? 'masculina' : 'feminina', CUSTOMER_ANIMATIONS));
const newCustomers = PRODUCTION_V003_CUSTOMER_ASSET_IDS.map((assetId, index) => characterAsset(assetId, `Cliente v003 ${String(index + 1).padStart(3, '0')}`, 'customer', index % 2 ? 'masculina' : 'feminina', CUSTOMER_ANIMATIONS));

export const PRODUCTION_V003_STAFF_ASSET_BY_DEFINITION_ID = {
  'cook-0': 'char_v003_staff_barista',
  'waiter-0': 'char_v003_staff_service',
  'waiter-1': 'char_v003_staff_service',
  'cleaner-0': 'char_v003_staff_cleaner',
  'cook-1': 'char_v003_staff_oven',
  'cook-2': 'char_v003_staff_griddle',
  'cook-3': 'char_v003_staff_soup',
  'cook-4': 'char_v003_staff_oriental',
  'cook-5': 'char_v003_staff_grill',
  'cook-6': 'char_v003_staff_general_cook',
  'cook-7': 'char_v003_staff_fryer',
  'cook-8': 'char_v003_staff_pastry',
  'cook-9': 'char_v003_staff_sushi',
} as const;

const staffCharacters: ProductionCharacterAsset[] = [
  characterAsset('char_v003_staff_barista', 'Barista', 'cook', 'feminina', COOK_ANIMATIONS),
  characterAsset('char_v003_staff_service', 'Atendimento/Garçom', 'waiter', 'masculina', WAITER_ANIMATIONS),
  characterAsset('char_v003_staff_cleaner', 'Auxiliar de limpeza', 'cleaner', 'feminina', CLEANER_ANIMATIONS),
  characterAsset('char_v003_staff_oven', 'Forneiro', 'cook', 'feminina', COOK_ANIMATIONS),
  characterAsset('char_v003_staff_griddle', 'Chapeiro', 'cook', 'masculina', COOK_ANIMATIONS),
  characterAsset('char_v003_staff_soup', 'Chef de Sopas', 'cook', 'feminina', COOK_ANIMATIONS),
  characterAsset('char_v003_staff_oriental', 'Chef Oriental', 'cook', 'masculina', COOK_ANIMATIONS),
  characterAsset('char_v003_staff_grill', 'Assador', 'cook', 'masculina', COOK_ANIMATIONS),
  characterAsset('char_v003_staff_general_cook', 'Cozinheiro Geral', 'cook', 'feminina', COOK_ANIMATIONS),
  characterAsset('char_v003_staff_fryer', 'Fritureiro', 'cook', 'feminina', COOK_ANIMATIONS),
  characterAsset('char_v003_staff_pastry', 'Confeiteiro', 'cook', 'feminina', COOK_ANIMATIONS),
  characterAsset('char_v003_staff_sushi', 'Sushiman', 'cook', 'masculina', COOK_ANIMATIONS),
];

interface FurnitureRuntimeSpec {
  furnitureId: string;
  slug: string;
  category: string;
  footprint: readonly [number, number];
  states: readonly string[];
  equipmentFamilyId?: string;
  connections?: readonly string[];
  layers?: readonly string[];
}

export const PRODUCTION_V003_FURNITURE_SPECS: readonly FurnitureRuntimeSpec[] = [
  { furnitureId: 'cooking.a1.stove', slug: 'a1_stove', category: 'equipment/stoves', footprint: [1, 1], states: ['off', 'active_1', 'active_2', 'complete'], equipmentFamilyId: 'stove' },
  { furnitureId: 'cooking.a2.convection', slug: 'a2_convection', category: 'equipment/ovens', footprint: [1, 1], states: ['off', 'active_1', 'active_2', 'complete'], equipmentFamilyId: 'oven' },
  { furnitureId: 'cooking.a3.griddle', slug: 'a3_griddle', category: 'equipment/griddles', footprint: [1, 1], states: ['off', 'active_1', 'active_2', 'complete'], equipmentFamilyId: 'grill' },
  { furnitureId: 'cooking.a4.fryer', slug: 'a4_fryer', category: 'equipment/fryers', footprint: [1, 1], states: ['off', 'active_1', 'active_2', 'complete'], equipmentFamilyId: 'grill' },
  { furnitureId: 'cooking.a5.kettle', slug: 'a5_kettle', category: 'equipment/kettles', footprint: [1, 1], states: ['off', 'active_1', 'active_2', 'complete'], equipmentFamilyId: 'cauldron' },
  { furnitureId: 'cooking.a6.grill', slug: 'a6_grill', category: 'equipment/grills', footprint: [1, 1], states: ['off', 'active_1', 'active_2', 'complete'], equipmentFamilyId: 'grill' },
  { furnitureId: 'cooking.a7.bakery', slug: 'a7_bakery', category: 'equipment/ovens', footprint: [1, 1], states: ['off', 'active_1', 'active_2', 'complete'], equipmentFamilyId: 'oven' },
  { furnitureId: 'cooking.a8.coffee', slug: 'a8_coffee', category: 'equipment/coffee-machines', footprint: [1, 1], states: ['off', 'active_1', 'active_2', 'complete'], equipmentFamilyId: 'coffee_machine' },
  { furnitureId: 'preparation.b3.counter', slug: 'b3_preparation', category: 'equipment/preparation', footprint: [1, 1], states: ['off', 'active_1', 'active_2', 'complete'], equipmentFamilyId: 'prep' },
  { furnitureId: 'washing.b5.sink', slug: 'b5_sink', category: 'equipment/sinks', footprint: [1, 1], states: ['off', 'active_1', 'active_2', 'complete'], equipmentFamilyId: 'sink' },
  { furnitureId: 'preparation.b8.pastry', slug: 'b8_pastry', category: 'equipment/preparation', footprint: [2, 1], states: ['off', 'active_1', 'active_2', 'complete'], equipmentFamilyId: 'prep' },
  { furnitureId: 'service.c1.isolated', slug: 'c1_service', category: 'furniture/service-counters', footprint: [1, 1], states: ['idle'], equipmentFamilyId: 'pickup', connections: ['isolated', 'left', 'middle', 'right'] },
  { furnitureId: 'service.c9.drinks', slug: 'c9_drinks', category: 'equipment/drinks', footprint: [1, 1], states: ['off', 'active_1', 'active_2', 'complete'], equipmentFamilyId: 'coffee_machine' },
  { furnitureId: 'dining.table.basic', slug: 'dining_table', category: 'furniture/tables', footprint: [1, 1], states: ['idle'] },
  { furnitureId: 'dining.chair.basic', slug: 'dining_chair', category: 'furniture/chairs', footprint: [1, 1], states: ['idle'], layers: ['full', 'back', 'front'] },
] as const;

export function productionFurnitureAssetId(furnitureId: string, level: number, connection?: string, layer?: string): string | undefined {
  const spec = PRODUCTION_V003_FURNITURE_SPECS.find((item) => item.furnitureId === furnitureId);
  if (!spec) return undefined;
  const safeLevel = Math.max(1, Math.min(5, Math.floor(level) || 1));
  const parts = ['v003', spec.slug];
  if (spec.connections) parts.push(spec.connections.includes(connection ?? '') ? connection! : 'isolated');
  parts.push(`l${safeLevel}`);
  if (spec.layers && layer && layer !== 'full') parts.push(layer);
  return parts.join('_');
}

export function productionFurnitureAnchor(footprint: readonly [number, number]): [number, number] {
  const extraDepthPixels = Math.max(0, footprint[0] + footprint[1] - 2) * 8;
  return [.5, (174 + extraDepthPixels) / 192];
}

function furnitureAsset(spec: FurnitureRuntimeSpec, level: number, connection?: string, layer?: string): BlenderRenderedAsset {
  const assetId = productionFurnitureAssetId(spec.furnitureId, level, connection, layer)!;
  const spriteSheet = `/assets/pixel/rendered/production_v003/furniture/${assetId}.png`;
  const animations = Object.fromEntries(spec.states.map((state) => [state, 1]));
  return {
    assetId, kind: spec.category.startsWith('furniture/') ? 'furniture' : 'equipment', category: spec.category,
    renderedFile: spriteSheet, spriteSheet, thumbnail: `/assets/pixel/rendered/production_v003/thumbnails/${assetId}.png`,
    visualLevel: level, gameplayLevel: 1, equipmentFamilyId: spec.equipmentFamilyId,
    footprint: [...spec.footprint], anchor: productionFurnitureAnchor(spec.footprint), orientations: FURNITURE_DIRECTIONS,
    animations, frameCount: spec.states.length, frameSize: [192, 192],
    sourceBlend: 'art_source/blender/sprite_refresh/cafe_tycoon_sprite_refresh_production_v003.blend', sourceCollection: `SRC_${assetId}`,
    paletteVersion: `production-v003-level-${level}`, renderVersion: 'production-v003', transparent: true,
    interactionPoints: [[0, 1]], qualityProfile: 'cafe-tycoon-sprite-refresh-v002-approved', nativeScale: 1,
    visualSkinId: `furniture-level-${level}`, layerRole: layer ?? 'full',
    counterBaseAssetId: !['dining.table.basic', 'dining.chair.basic'].includes(spec.furnitureId) ? `COUNTER_BASE_L${level}` : undefined,
    visualBounds: { widthCells: spec.footprint[0], depthCells: spec.footprint[1], heightBlocks: ['dining.table.basic', 'dining.chair.basic'].includes(spec.furnitureId) ? .82 : 1.1, overhangCells: .12 },
  };
}

const furnitureAssets = PRODUCTION_V003_FURNITURE_SPECS.flatMap((spec) => Array.from({ length: 5 }, (_, index) => index + 1).flatMap((level) => {
  const connections = spec.connections ?? [undefined];
  const layers = spec.layers ?? [undefined];
  return connections.flatMap((connection) => layers.map((layer) => furnitureAsset(spec, level, connection, layer)));
}));

export const PRODUCTION_V003_CHARACTER_ASSETS: ProductionCharacterAsset[] = [...approvedCustomers, ...newCustomers, ...staffCharacters];
export const PRODUCTION_V003_FURNITURE_ASSETS: BlenderRenderedAsset[] = furnitureAssets;
export const PRODUCTION_V003_RENDERED_ASSETS = [...PRODUCTION_V003_CHARACTER_ASSETS, ...PRODUCTION_V003_FURNITURE_ASSETS];
export const PRODUCTION_V003_RENDERED_ASSET_IDS = new Set(PRODUCTION_V003_RENDERED_ASSETS.map((asset) => asset.assetId));
