import type { Direction, PixelAnimationName, VisualSkinId, WorldAssetId } from '../../core/types';
import { VISUAL_METRICS } from './VisualMetrics';

export const CHARACTER_DIRECTIONS: Direction[] = ['ne', 'nw', 'se', 'sw'];
export const CHARACTER_FOOT_ANCHOR = VISUAL_METRICS.character.feetAnchor;
export const REQUIRED_CHARACTER_ANIMATIONS: Record<PixelAnimationName, { frames: number; fps: number; loop: boolean }> = {
  idle: { frames: 2, fps: 4, loop: true },
  walk: { frames: 6, fps: 9, loop: true },
  'sit-down': { frames: 2, fps: 6, loop: false },
  'seated-idle': { frames: 2, fps: 3, loop: true },
  'seated-waiting': { frames: 2, fps: 3, loop: true },
  'seated-eating': { frames: 4, fps: 7, loop: true },
  'stand-up': { frames: 2, fps: 6, loop: false },
  'carry-plate': { frames: 2, fps: 8, loop: true },
  'carry-ingredients': { frames: 2, fps: 8, loop: true },
  cook: { frames: 4, fps: 8, loop: true },
  'use-appliance': { frames: 4, fps: 8, loop: true },
  serve: { frames: 2, fps: 7, loop: false },
  clean: { frames: 4, fps: 8, loop: true },
  'receive-payment': { frames: 2, fps: 6, loop: false },
};

export const VISUAL_SKINS: Record<VisualSkinId, { family: string; label: string; level: 1 }> = {
  'floor-terracotta': { family: 'floor', label: 'Terracota quente', level: 1 },
  'floor-cream': { family: 'floor', label: 'Cerâmica creme', level: 1 },
  'wall-cream-green': { family: 'wall', label: 'Creme e verde', level: 1 },
  'wall-cream-wood': { family: 'wall', label: 'Creme e madeira', level: 1 },
  'table-oak': { family: 'table', label: 'Carvalho', level: 1 },
  'table-green': { family: 'table', label: 'Tampo verde', level: 1 },
  'chair-wood': { family: 'chair', label: 'Madeira básica', level: 1 },
  'chair-upholstered': { family: 'chair', label: 'Estofada', level: 1 },
  'chair-bistro': { family: 'chair', label: 'Bistrô temática', level: 1 },
  'counter-oak': { family: 'counter', label: 'Balcão carvalho', level: 1 },
  'counter-green': { family: 'counter', label: 'Balcão verde', level: 1 },
  'equipment-steel-level-1': { family: 'equipment', label: 'Aço nível 1', level: 1 },
  'decor-bloom': { family: 'decoration', label: 'Bloom', level: 1 },
};

export const DEV_SKIN_SETS = {
  bloom: { floor: 'floor-terracotta', wall: 'wall-cream-green', table: 'table-oak', chair: 'chair-wood', counter: 'counter-oak' },
  sage: { floor: 'floor-cream', wall: 'wall-cream-wood', table: 'table-green', chair: 'chair-upholstered', counter: 'counter-green' },
} as const;

export const WORLD_ASSETS: Record<WorldAssetId, { frame: string; footprint: { width: number; depth: number }; anchor: { x: number; y: number }; visualHeight: number }> = {
  floor_dining: { frame: 'tile/floor-dining', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .5 }, visualHeight: 0 },
  floor_kitchen: { frame: 'tile/floor-kitchen', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .5 }, visualHeight: 0 },
  floor_outside: { frame: 'tile/grass-a', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .5 }, visualHeight: 0 },
  floor_grass_alt: { frame: 'tile/grass-b', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .5 }, visualHeight: 0 },
  floor_road: { frame: 'tile/road', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .5 }, visualHeight: 0 },
  wall_nw: { frame: 'wall/nw', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: 1 }, visualHeight: 72 },
  wall_ne: { frame: 'wall/ne', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: 1 }, visualHeight: 72 },
  door: { frame: 'decor/door', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: 1 }, visualHeight: 72 },
  table: { frame: 'furniture/table', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 34 },
  chair_ne: { frame: 'furniture/chair-ne', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 38 },
  chair_nw: { frame: 'furniture/chair-nw', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 38 },
  chair_se: { frame: 'furniture/chair-se', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 38 },
  chair_sw: { frame: 'furniture/chair-sw', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 38 },
  prep: { frame: 'kitchen/prep', footprint: { width: 2, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 54 },
  stove: { frame: 'kitchen/stove', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 58 },
  grill: { frame: 'kitchen/grill', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 58 },
  cauldron: { frame: 'kitchen/cauldron', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 66 },
  coffee_machine: { frame: 'kitchen/coffee-machine', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 67 },
  assembly: { frame: 'kitchen/assembly', footprint: { width: 2, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 54 },
  pickup: { frame: 'kitchen/counter', footprint: { width: 6, depth: 1 }, anchor: { x: .5, y: .65 }, visualHeight: 58 },
  fridge: { frame: 'kitchen/fridge', footprint: { width: 2, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 92 },
  oven: { frame: 'kitchen/oven', footprint: { width: 2, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 78 },
  sink: { frame: 'kitchen/sink', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 58 },
  storage: { frame: 'kitchen/storage', footprint: { width: 2, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 82 },
  plant: { frame: 'decor/plant', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 62 },
  shelf: { frame: 'decor/shelf', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: 1 }, visualHeight: 70 },
  bin: { frame: 'decor/bin', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 39 },
  dish: { frame: 'food/dish', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 12 },
};

export const characterFrame = (variant: string, animation: PixelAnimationName, direction: Direction, frame: number) =>
  `character/${variant}/${animation}/${direction}/${frame}`;

export const effectFrame = (effect: 'flame' | 'steam' | 'oven-glow' | 'bubble' | 'ready', frame: number) => `effect/${effect}/${frame}`;
