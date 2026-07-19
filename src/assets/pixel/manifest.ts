import type { Direction, PixelAnimationName, WorldAssetId } from '../../core/types';

export const CHARACTER_DIRECTIONS: Direction[] = ['ne', 'nw', 'se', 'sw'];
export const CHARACTER_FOOT_ANCHOR = { x: 32, y: 88 } as const;
export const REQUIRED_CHARACTER_ANIMATIONS: Record<PixelAnimationName, { frames: number; fps: number; loop: boolean }> = {
  idle: { frames: 2, fps: 4, loop: true },
  walk: { frames: 6, fps: 9, loop: true },
  'carry-dish': { frames: 2, fps: 8, loop: true },
  'carry-ingredients': { frames: 2, fps: 8, loop: true },
  work: { frames: 4, fps: 8, loop: true },
  sit: { frames: 2, fps: 6, loop: false },
  seated: { frames: 2, fps: 3, loop: true },
  eat: { frames: 4, fps: 7, loop: true },
};

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
  stove: { frame: 'kitchen/stove', footprint: { width: 2, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 58 },
  grill: { frame: 'kitchen/grill', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 58 },
  cauldron: { frame: 'kitchen/cauldron', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 66 },
  coffee_machine: { frame: 'kitchen/coffee-machine', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 67 },
  assembly: { frame: 'kitchen/assembly', footprint: { width: 2, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 54 },
  pickup: { frame: 'kitchen/counter', footprint: { width: 6, depth: 1 }, anchor: { x: .5, y: .65 }, visualHeight: 58 },
  fridge: { frame: 'kitchen/fridge', footprint: { width: 2, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 92 },
  oven: { frame: 'kitchen/oven', footprint: { width: 2, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 78 },
  sink: { frame: 'kitchen/sink', footprint: { width: 2, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 58 },
  storage: { frame: 'kitchen/storage', footprint: { width: 2, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 82 },
  plant: { frame: 'decor/plant', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 62 },
  shelf: { frame: 'decor/shelf', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: 1 }, visualHeight: 70 },
  bin: { frame: 'decor/bin', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 39 },
  dish: { frame: 'food/dish', footprint: { width: 1, depth: 1 }, anchor: { x: .5, y: .85 }, visualHeight: 12 },
};

export const characterFrame = (variant: string, animation: PixelAnimationName, direction: Direction, frame: number) =>
  `character/${variant}/${animation}/${direction}/${frame}`;

export const effectFrame = (effect: 'flame' | 'steam' | 'oven-glow' | 'bubble' | 'ready', frame: number) => `effect/${effect}/${frame}`;
