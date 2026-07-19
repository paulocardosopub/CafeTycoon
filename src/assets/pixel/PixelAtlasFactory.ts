import Phaser from 'phaser';
import type { CharacterAppearance, Direction, PixelAnimationName } from '../../core/types';
import { CHARACTER_DIRECTIONS, REQUIRED_CHARACTER_ANIMATIONS, WORLD_ASSETS, characterFrame, effectFrame } from './manifest';
import { PIXEL_PALETTE as P } from './palette';

const WORLD_FRAME = { width: 256, height: 160 } as const;
const WORLD_COLUMNS = 8;
const CHARACTER_FRAME = { width: 64, height: 96 } as const;
const CHARACTER_COLUMNS = 32;
export const CHARACTER_VARIANTS = ['player', 'cook', 'waiter', 'assistant', ...Array.from({ length: 8 }, (_, index) => `customer-${index}`)] as const;

type Ctx = CanvasRenderingContext2D;
type Point = { x: number; y: number };
type CharacterColors = { skin: string; hair: string; outfit: string; accent: string; role: string; hairStyle: string };

export function installPixelAtlases(scene: Phaser.Scene, appearance?: CharacterAppearance): void {
  if (!scene.textures.exists('world-atlas')) createWorldAtlas(scene);
  if (!scene.textures.exists('character-atlas')) createCharacterAtlas(scene, appearance);
}

function createWorldAtlas(scene: Phaser.Scene): void {
  const worldFrames = [...new Set(Object.values(WORLD_ASSETS).map((asset) => asset.frame))];
  const effectFrames = (['flame', 'steam', 'oven-glow', 'bubble', 'ready'] as const)
    .flatMap((effect) => Array.from({ length: 4 }, (_, frame) => effectFrame(effect, frame)));
  const frames = [...worldFrames, ...effectFrames];
  const rows = Math.ceil(frames.length / WORLD_COLUMNS);
  const texture = scene.textures.createCanvas('world-atlas', WORLD_FRAME.width * WORLD_COLUMNS, WORLD_FRAME.height * rows)!;
  const ctx = texture.getContext();
  ctx.imageSmoothingEnabled = false;
  frames.forEach((name, index) => {
    const x = (index % WORLD_COLUMNS) * WORLD_FRAME.width;
    const y = Math.floor(index / WORLD_COLUMNS) * WORLD_FRAME.height;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(2, 2);
    drawWorldFrame(ctx, name);
    ctx.restore();
    texture.add(name, 0, x, y, WORLD_FRAME.width, WORLD_FRAME.height);
  });
  texture.refresh();
}

function createCharacterAtlas(scene: Phaser.Scene, appearance?: CharacterAppearance): void {
  const frames: { name: string; variant: string; animation: PixelAnimationName; direction: Direction; index: number }[] = [];
  for (const variant of CHARACTER_VARIANTS) {
    for (const animation of Object.keys(REQUIRED_CHARACTER_ANIMATIONS) as PixelAnimationName[]) {
      for (const direction of CHARACTER_DIRECTIONS) {
        for (let index = 0; index < REQUIRED_CHARACTER_ANIMATIONS[animation].frames; index += 1) {
          frames.push({ name: characterFrame(variant, animation, direction, index), variant, animation, direction, index });
        }
      }
    }
  }
  const rows = Math.ceil(frames.length / CHARACTER_COLUMNS);
  const texture = scene.textures.createCanvas('character-atlas', CHARACTER_FRAME.width * CHARACTER_COLUMNS, CHARACTER_FRAME.height * rows)!;
  const ctx = texture.getContext();
  ctx.imageSmoothingEnabled = false;
  frames.forEach((frame, atlasIndex) => {
    const x = (atlasIndex % CHARACTER_COLUMNS) * CHARACTER_FRAME.width;
    const y = Math.floor(atlasIndex / CHARACTER_COLUMNS) * CHARACTER_FRAME.height;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(2, 2);
    drawCharacter(ctx, frame.variant, frame.animation, frame.direction, frame.index, appearance);
    ctx.restore();
    texture.add(frame.name, 0, x, y, CHARACTER_FRAME.width, CHARACTER_FRAME.height);
  });
  texture.refresh();
}

function drawWorldFrame(ctx: Ctx, name: string): void {
  if (name === 'tile/floor-dining') return drawFloor(ctx, P.floorDining, P.grout, false);
  if (name === 'tile/floor-kitchen') return drawFloor(ctx, P.cream, P.creamShade, true);
  if (name === 'tile/grass-a') return drawGrass(ctx, false);
  if (name === 'tile/grass-b') return drawGrass(ctx, true);
  if (name === 'tile/road') return drawRoad(ctx);
  if (name === 'wall/nw') return drawWall(ctx, 'nw');
  if (name === 'wall/ne') return drawWall(ctx, 'ne');
  if (name === 'decor/door') return drawDoor(ctx);
  if (name === 'furniture/table') return drawTable(ctx);
  if (name.startsWith('furniture/chair-')) return drawChair(ctx, name.slice(-2) as Direction);
  if (name === 'decor/plant') return drawPlant(ctx);
  if (name === 'decor/shelf') return drawShelf(ctx);
  if (name === 'decor/bin') return drawBin(ctx);
  if (name === 'food/dish') return drawDish(ctx);
  if (name.startsWith('effect/')) return drawEffect(ctx, name);
  drawEquipment(ctx, name.replace('kitchen/', ''));
}

function drawFloor(ctx: Ctx, base: string, line: string, kitchen: boolean): void {
  diamond(ctx, 64, 40, 16, 8, P.outlineSoft);
  diamond(ctx, 64, 39, 15, 7, base);
  pixelQuad(ctx, [{ x: 49, y: 39 }, { x: 64, y: 46 }, { x: 64, y: 48 }, { x: 49, y: 41 }], line);
  pixelQuad(ctx, [{ x: 79, y: 39 }, { x: 64, y: 46 }, { x: 64, y: 48 }, { x: 79, y: 41 }], line);
  if (kitchen) {
    rect(ctx, 58, 38, 2, 1, P.creamLight); rect(ctx, 67, 42, 2, 1, P.creamLight);
  } else {
    rect(ctx, 55, 39, 3, 1, line); rect(ctx, 70, 41, 2, 1, line);
  }
}

function drawGrass(ctx: Ctx, alternate: boolean): void {
  diamond(ctx, 64, 40, 16, 8, P.sageDark);
  diamond(ctx, 64, 39, 15, 7, alternate ? '#52763e' : P.grass);
  const tufts = alternate
    ? [{ x: 55, y: 38 }, { x: 63, y: 43 }, { x: 71, y: 37 }, { x: 75, y: 42 }]
    : [{ x: 52, y: 41 }, { x: 60, y: 36 }, { x: 68, y: 42 }, { x: 74, y: 39 }];
  for (const tuft of tufts) {
    rect(ctx, tuft.x, tuft.y, 1, 3, P.grassLight);
    rect(ctx, tuft.x - 1, tuft.y + 1, 1, 2, alternate ? P.sage : '#78934d');
    rect(ctx, tuft.x + 1, tuft.y + 1, 1, 2, P.sageDark);
  }
  rect(ctx, alternate ? 58 : 70, alternate ? 40 : 37, 2, 1, '#8fa653');
}

function drawRoad(ctx: Ctx): void {
  diamond(ctx, 64, 40, 16, 8, P.outlineSoft);
  diamond(ctx, 64, 39, 15, 7, '#777b78');
  pixelLine(ctx, { x: 49, y: 39 }, { x: 64, y: 46 }, '#555b59');
  pixelLine(ctx, { x: 64, y: 46 }, { x: 79, y: 39 }, '#555b59');
  pixelLine(ctx, { x: 57, y: 35 }, { x: 72, y: 42 }, '#9b9d96');
  rect(ctx, 53, 40, 3, 1, '#aeb0a8');
  rect(ctx, 68, 36, 2, 1, '#505553');
}

function drawWall(ctx: Ctx, side: 'nw' | 'ne'): void {
  const base = side === 'nw'
    ? [{ x: 48, y: 72 }, { x: 64, y: 80 }, { x: 64, y: 38 }, { x: 48, y: 30 }]
    : [{ x: 64, y: 80 }, { x: 80, y: 72 }, { x: 80, y: 30 }, { x: 64, y: 38 }];
  pixelQuad(ctx, base, side === 'nw' ? P.cream : P.creamLight);
  const topStart = side === 'nw' ? { x: 48, y: 30 } : { x: 64, y: 38 };
  const topEnd = side === 'nw' ? { x: 64, y: 38 } : { x: 80, y: 30 };
  pixelLine(ctx, topStart, topEnd, P.woodMid);
  pixelLine(ctx, { x: topStart.x, y: topStart.y - 1 }, { x: topEnd.x, y: topEnd.y - 1 }, P.woodLight);
}

function drawCauldronStandalone(ctx: Ctx): void {
  const base = footprintCorners(1, 1, 64, 69);
  pixelQuad(ctx, [base.top, base.right, base.bottom, base.left], P.shadow);
  rect(ctx, 51, 61, 4, 10, P.outlineSoft); rect(ctx, 73, 61, 4, 10, P.outlineSoft);
  diamond(ctx, 64, 61, 15, 7, P.outlineSoft);
  diamond(ctx, 64, 60, 12, 5, P.steelDark);
  rect(ctx, 49, 47, 30, 13, P.outlineSoft);
  pixelEllipse(ctx, 64, 59, 15, 7, P.outlineSoft);
  pixelEllipse(ctx, 64, 57, 13, 6, P.steelDark);
  pixelEllipse(ctx, 64, 47, 16, 7, P.outlineSoft);
  pixelEllipse(ctx, 64, 46, 13, 5, P.blueDark);
  pixelEllipse(ctx, 64, 45, 10, 3, P.blue);
  rect(ctx, 43, 49, 7, 4, P.woodDark); rect(ctx, 78, 49, 7, 4, P.woodDark);
  pixelQuad(ctx, [{ x: 59, y: 65 }, { x: 64, y: 56 }, { x: 69, y: 65 }, { x: 64, y: 69 }], P.terracotta);
  pixelQuad(ctx, [{ x: 62, y: 65 }, { x: 65, y: 60 }, { x: 67, y: 65 }, { x: 64, y: 67 }], P.goldLight);
}

function drawDoor(ctx: Ctx): void {
  pixelEllipse(ctx, 64, 78, 24, 5, P.shadow);
  pixelQuad(ctx, [{ x: 43, y: 76 }, { x: 85, y: 76 }, { x: 85, y: 34 }, { x: 80, y: 25 }, { x: 70, y: 19 }, { x: 58, y: 19 }, { x: 48, y: 25 }, { x: 43, y: 34 }], P.outline);
  pixelQuad(ctx, [{ x: 46, y: 74 }, { x: 82, y: 74 }, { x: 82, y: 35 }, { x: 77, y: 27 }, { x: 69, y: 22 }, { x: 59, y: 22 }, { x: 51, y: 27 }, { x: 46, y: 35 }], P.creamLight);
  rect(ctx, 48, 37, 5, 35, P.creamShade); rect(ctx, 75, 37, 5, 35, P.creamShade);
  rect(ctx, 51, 29, 4, 5, P.cream); rect(ctx, 73, 29, 4, 5, P.cream);
  pixelQuad(ctx, [{ x: 54, y: 72 }, { x: 74, y: 72 }, { x: 74, y: 37 }, { x: 71, y: 30 }, { x: 64, y: 27 }, { x: 57, y: 30 }, { x: 54, y: 37 }], P.outline);
  pixelQuad(ctx, [{ x: 57, y: 70 }, { x: 71, y: 70 }, { x: 71, y: 39 }, { x: 69, y: 33 }, { x: 64, y: 31 }, { x: 59, y: 33 }, { x: 57, y: 39 }], P.sageDark);
  rect(ctx, 59, 42, 10, 12, P.blueDark); rect(ctx, 60, 43, 8, 10, P.blue);
  rect(ctx, 59, 57, 10, 2, P.woodDark); rect(ctx, 63, 59, 2, 11, P.woodDark);
  rect(ctx, 68, 57, 2, 2, P.goldLight);
  pixelQuad(ctx, [{ x: 49, y: 75 }, { x: 79, y: 75 }, { x: 73, y: 80 }, { x: 55, y: 80 }], P.creamShade);
  pixelLine(ctx, { x: 55, y: 77 }, { x: 73, y: 77 }, P.creamLight);
}

function drawTable(ctx: Ctx): void {
  const base = footprintCorners(1, 1, 64, 68);
  pixelQuad(ctx, [base.top, base.right, base.bottom, base.left], P.shadow);
  rect(ctx, 54, 55, 3, 14, P.outline); rect(ctx, 55, 55, 2, 13, P.woodDark);
  rect(ctx, 71, 55, 3, 14, P.outline); rect(ctx, 71, 55, 2, 13, P.woodDark);
  pixelQuad(ctx, [{ x: 45, y: 51 }, { x: 64, y: 41 }, { x: 83, y: 51 }, { x: 64, y: 61 }], P.outline);
  pixelQuad(ctx, [{ x: 48, y: 50 }, { x: 64, y: 42 }, { x: 80, y: 50 }, { x: 64, y: 58 }], P.woodMid);
  pixelQuad(ctx, [{ x: 51, y: 48 }, { x: 64, y: 43 }, { x: 76, y: 49 }, { x: 63, y: 55 }], P.woodLight);
  pixelLine(ctx, { x: 49, y: 51 }, { x: 64, y: 58 }, P.woodDark);
  pixelLine(ctx, { x: 64, y: 43 }, { x: 80, y: 50 }, '#edb263');
  rect(ctx, 62, 42, 4, 5, P.creamLight); rect(ctx, 63, 40, 2, 4, P.sageDark);
  rect(ctx, 60, 40, 3, 2, P.sageLight); rect(ctx, 65, 39, 3, 2, P.terracottaLight);
}

function drawChair(ctx: Ctx, direction: Direction): void {
  const facingRight = direction === 'ne' || direction === 'se';
  const facingFront = direction === 'se' || direction === 'sw';
  const backX = 64 + (facingRight ? -2 : 2);
  const backTopY = facingFront ? 45 : 42;
  const skew = facingRight ? 2 : -2;
  const base = footprintCorners(1, 1, 64, 69);
  pixelQuad(ctx, [base.top, base.right, base.bottom, base.left], P.shadow);
  const backOuter = [
    { x: backX - 10, y: backTopY }, { x: backX + 10, y: backTopY + skew },
    { x: backX + 10, y: backTopY + 12 + skew }, { x: backX - 10, y: backTopY + 12 },
  ];
  const backInner = [
    { x: backX - 7, y: backTopY + 2 }, { x: backX + 7, y: backTopY + 2 + skew },
    { x: backX + 7, y: backTopY + 10 + skew }, { x: backX - 7, y: backTopY + 10 },
  ];
  pixelQuad(ctx, backOuter, P.woodDark);
  pixelQuad(ctx, backInner, P.woodLight);
  for (const offset of [-4, 1, 6]) {
    pixelLine(ctx, { x: backX + offset, y: backTopY + 3 }, { x: backX + offset, y: backTopY + 9 + skew / 2 }, P.woodDark);
  }
  rect(ctx, backX - 10, backTopY + 9, 3, 18, P.woodDark);
  rect(ctx, backX + 7, backTopY + 10 + skew, 3, 16, P.woodDark);
  diamond(ctx, 64, 58, 11, 5, P.woodDark);
  pixelQuad(ctx, [{ x: 53, y: 58 }, { x: 64, y: 63 }, { x: 64, y: 66 }, { x: 53, y: 61 }], P.woodMid);
  pixelQuad(ctx, [{ x: 64, y: 63 }, { x: 75, y: 58 }, { x: 75, y: 61 }, { x: 64, y: 66 }], shade(P.woodMid));
  diamond(ctx, 64, 57, 9, 4, P.woodMid);
  diamond(ctx, 64, 56, 7, 3, P.sageLight);
  for (const legX of [56, 70]) {
    rect(ctx, legX, 62, 3, 9, P.woodDark); rect(ctx, legX + 1, 62, 1, 8, P.woodLight);
  }
}

function equipmentBase(ctx: Ctx, widthCells: number, depthCells: number, height: number, topColor: string, frontColor: string, baseY: number): number {
  const base = footprintCorners(widthCells, depthCells, 64, baseY);
  const top = {
    top: { x: base.top.x, y: base.top.y - height }, right: { x: base.right.x, y: base.right.y - height },
    bottom: { x: base.bottom.x, y: base.bottom.y - height }, left: { x: base.left.x, y: base.left.y - height },
  };
  pixelQuad(ctx, [
    { x: base.top.x, y: base.top.y + 3 }, { x: base.right.x, y: base.right.y + 3 },
    { x: base.bottom.x, y: base.bottom.y + 3 }, { x: base.left.x, y: base.left.y + 3 },
  ], P.shadow);
  pixelQuad(ctx, [top.left, top.bottom, base.bottom, base.left], frontColor);
  pixelQuad(ctx, [top.bottom, top.right, base.right, base.bottom], shade(frontColor));
  pixelQuad(ctx, [top.top, top.right, top.bottom, top.left], topColor);
  for (const [a, b] of [[top.top, top.right], [top.right, top.bottom], [top.bottom, top.left], [top.left, top.top], [top.left, base.left], [top.bottom, base.bottom], [top.right, base.right], [base.left, base.bottom], [base.bottom, base.right]] as [Point, Point][]) pixelLine(ctx, a, b, P.outlineSoft);
  return baseY - height;
}

function drawEquipment(ctx: Ctx, id: string): void {
  if (id === 'cauldron') return drawCauldronStandalone(ctx);
  const double = ['prep', 'stove', 'assembly', 'fridge', 'oven', 'sink', 'storage'].includes(id);
  const widthCells = id === 'counter' ? 6 : double ? 2 : 1;
  const height = id === 'fridge' || id === 'storage' ? 44 : id === 'oven' ? 31 : 18;
  const top = ['prep', 'assembly', 'counter'].includes(id) ? P.woodLight : P.steelLight;
  const front = id === 'counter' ? P.woodMid : id === 'prep' || id === 'assembly' ? P.sage : P.steel;
  const surfaceY = equipmentBase(ctx, widthCells, 1, height, top, front, id === 'counter' ? 52 : 68);
  if (id === 'stove') {
    const cooktop = footprintCorners(2, 1, 64, surfaceY);
    pixelQuad(ctx, [cooktop.top, cooktop.right, cooktop.bottom, cooktop.left], P.steelDark);
    for (const burner of [{ x: 51, y: 48 }, { x: 61, y: 53 }, { x: 68, y: 47 }, { x: 78, y: 52 }]) {
      pixelEllipse(ctx, burner.x, burner.y, 4, 2, P.outline); pixelEllipse(ctx, burner.x, burner.y, 2, 1, P.red);
    }
    pixelQuad(ctx, [{ x: 43, y: 57 }, { x: 69, y: 70 }, { x: 69, y: 77 }, { x: 43, y: 64 }], P.outlineSoft);
    pixelQuad(ctx, [{ x: 47, y: 59 }, { x: 66, y: 69 }, { x: 66, y: 74 }, { x: 47, y: 64 }], P.steelDark);
    rect(ctx, 50, 60, 3, 2, P.goldLight);
  } else if (id === 'grill') {
    const grillTop = footprintCorners(1, 1, 64, surfaceY);
    pixelQuad(ctx, [grillTop.top, grillTop.right, grillTop.bottom, grillTop.left], P.steelDark);
    for (let x = 55; x <= 72; x += 4) pixelLine(ctx, { x, y: surfaceY - 5 + (x - 55) / 2 }, { x, y: surfaceY + 1 + (x - 55) / 2 }, x % 8 ? P.terracottaLight : P.steelBright);
    rect(ctx, 58, surfaceY + 12, 12, 3, P.outlineSoft);
  } else if (id === 'fridge') {
    rect(ctx, 45, surfaceY + 7, 38, 2, P.steelBright); rect(ctx, 63, surfaceY + 9, 2, 38, P.steelDark); rect(ctx, 56, surfaceY + 17, 2, 11, P.steelDark);
    rect(ctx, 70, surfaceY + 17, 2, 11, P.steelDark); rect(ctx, 50, surfaceY - 6, 13, 3, P.creamLight);
    rect(ctx, 52, surfaceY - 5, 9, 1, P.blue); rect(ctx, 76, surfaceY + 33, 3, 3, P.goldLight);
  } else if (id === 'oven') {
    pixelQuad(ctx, [{ x: 42, y: surfaceY + 11 }, { x: 69, y: surfaceY + 25 }, { x: 69, y: surfaceY + 47 }, { x: 42, y: surfaceY + 33 }], P.outlineSoft);
    pixelQuad(ctx, [{ x: 46, y: surfaceY + 14 }, { x: 66, y: surfaceY + 24 }, { x: 66, y: surfaceY + 39 }, { x: 46, y: surfaceY + 29 }], P.terracottaDark);
    pixelQuad(ctx, [{ x: 49, y: surfaceY + 17 }, { x: 63, y: surfaceY + 24 }, { x: 63, y: surfaceY + 34 }, { x: 49, y: surfaceY + 27 }], P.gold);
    for (let x = 47; x <= 63; x += 5) rect(ctx, x, surfaceY + 10 + (x - 47) / 2, 3, 2, P.red);
  } else if (id === 'sink') {
    diamond(ctx, 56, surfaceY - 2, 9, 4, P.steelDark); diamond(ctx, 56, surfaceY - 2, 6, 2, P.blueDark);
    diamond(ctx, 72, surfaceY + 6, 9, 4, P.steelDark); diamond(ctx, 72, surfaceY + 6, 6, 2, P.blueDark);
    rect(ctx, 72, surfaceY - 14, 3, 14, P.steelBright); rect(ctx, 67, surfaceY - 17, 8, 3, P.steelBright); rect(ctx, 66, surfaceY - 16, 3, 7, P.steelBright);
  } else if (id === 'coffee-machine') {
    rect(ctx, 54, surfaceY - 24, 20, 27, P.outline); rect(ctx, 56, surfaceY - 22, 16, 23, P.terracottaDark); rect(ctx, 58, surfaceY - 19, 12, 8, P.steelDark);
    rect(ctx, 61, surfaceY - 9, 2, 8, P.steelBright); rect(ctx, 65, surfaceY - 7, 6, 6, P.creamLight);
  } else if (id === 'cauldron') {
    pixelEllipse(ctx, 64, surfaceY - 6, 13, 5, P.outline); rect(ctx, 52, surfaceY - 6, 24, 16, P.outline); pixelEllipse(ctx, 64, surfaceY + 8, 12, 5, P.steelDark);
    pixelEllipse(ctx, 64, surfaceY - 7, 10, 3, P.blueDark); rect(ctx, 48, surfaceY - 4, 4, 3, P.woodDark); rect(ctx, 76, surfaceY - 4, 4, 3, P.woodDark);
  } else if (id === 'counter') {
    pixelLine(ctx, { x: 30, y: 27 }, { x: 50, y: 37 }, P.woodLight);
    pixelLine(ctx, { x: 77, y: 50 }, { x: 91, y: 57 }, P.creamShade);
    rect(ctx, 46, 34, 9, 2, P.red); rect(ctx, 73, 48, 8, 2, P.steelBright);
  } else if (id === 'storage') {
    for (let y = 26; y < 55; y += 10) { rect(ctx, 49, y, 29, 2, P.woodLight); rect(ctx, 53, y - 6, 6, 5, P.cream); rect(ctx, 63, y - 7, 5, 6, P.terracotta); rect(ctx, 72, y - 5, 4, 4, P.sage); }
  } else {
    rect(ctx, 53, surfaceY - 2, 8, 5, P.sageDark); rect(ctx, 63, surfaceY - 4, 7, 6, P.terracotta); rect(ctx, 72, surfaceY - 2, 6, 4, P.goldLight);
    if (id === 'prep') rect(ctx, 59, surfaceY - 9, 2, 9, P.steelBright);
  }
}

function drawPlant(ctx: Ctx): void {
  pixelEllipse(ctx, 64, 76, 15, 4, P.shadow);
  pixelQuad(ctx, [{ x: 54, y: 59 }, { x: 74, y: 59 }, { x: 70, y: 74 }, { x: 58, y: 74 }], P.outline);
  pixelQuad(ctx, [{ x: 56, y: 60 }, { x: 72, y: 60 }, { x: 68, y: 72 }, { x: 59, y: 72 }], P.terracotta);
  rect(ctx, 63, 38, 3, 23, P.sageDark);
  for (const leaf of [{ x: 53, y: 40 }, { x: 58, y: 32 }, { x: 66, y: 29 }, { x: 72, y: 35 }, { x: 76, y: 43 }, { x: 59, y: 46 }, { x: 69, y: 47 }]) {
    pixelEllipse(ctx, leaf.x, leaf.y, 6, 3, P.outline); pixelEllipse(ctx, leaf.x, leaf.y - 1, 5, 2, leaf.x % 2 ? P.sageLight : P.sage);
  }
}

function drawShelf(ctx: Ctx): void {
  rect(ctx, 48, 24, 4, 51, P.outline); rect(ctx, 76, 24, 4, 51, P.outline);
  for (let y = 32; y <= 67; y += 12) { rect(ctx, 48, y, 32, 4, P.outline); rect(ctx, 51, y, 26, 2, P.woodLight); }
  rect(ctx, 54, 26, 6, 6, P.cream); rect(ctx, 63, 25, 5, 7, P.terracotta); rect(ctx, 71, 27, 4, 5, P.sageLight);
  rect(ctx, 54, 38, 8, 5, P.steelLight); rect(ctx, 66, 38, 8, 5, P.gold);
}

function drawBin(ctx: Ctx): void {
  const base = footprintCorners(1, 1, 64, 69);
  pixelQuad(ctx, [base.top, base.right, base.bottom, base.left], P.shadow);
  pixelQuad(ctx, [{ x: 53, y: 46 }, { x: 75, y: 46 }, { x: 72, y: 70 }, { x: 56, y: 70 }], P.outline);
  pixelQuad(ctx, [{ x: 56, y: 48 }, { x: 72, y: 48 }, { x: 69, y: 68 }, { x: 59, y: 68 }], P.sage);
  pixelQuad(ctx, [{ x: 64, y: 48 }, { x: 72, y: 48 }, { x: 69, y: 68 }, { x: 64, y: 70 }], P.sageDark);
  diamond(ctx, 64, 46, 12, 6, P.outline);
  diamond(ctx, 64, 45, 10, 4, P.sageLight);
  diamond(ctx, 64, 45, 7, 3, P.outlineSoft);
  diamond(ctx, 64, 44, 5, 2, '#171918');
  rect(ctx, 60, 57, 8, 6, P.creamLight); rect(ctx, 61, 58, 6, 4, P.sageDark);
  rect(ctx, 63, 58, 2, 4, P.creamLight);
}

function drawDish(ctx: Ctx): void {
  pixelEllipse(ctx, 64, 70, 13, 4, P.outline); pixelEllipse(ctx, 64, 69, 11, 3, P.creamLight); rect(ctx, 60, 66, 8, 2, P.terracotta); rect(ctx, 64, 64, 4, 2, P.sageLight);
}

function drawEffect(ctx: Ctx, name: string): void {
  const parts = name.split('/');
  const kind = parts[1]; const frame = Number(parts[2]);
  if (kind === 'flame') {
    const height = 8 + (frame % 2) * 3; pixelQuad(ctx, [{ x: 60, y: 70 }, { x: 64, y: 70 - height }, { x: 68, y: 70 }, { x: 64, y: 75 }], P.red);
    pixelQuad(ctx, [{ x: 62, y: 70 }, { x: 65, y: 74 - height }, { x: 67, y: 70 }, { x: 64, y: 73 }], P.goldLight);
  } else if (kind === 'steam') {
    rect(ctx, 61 + frame % 2, 48, 3, 5, P.steelBright); rect(ctx, 64 - frame % 2, 41, 3, 5, P.creamLight); rect(ctx, 61, 34, 3, 4, P.steelBright);
  } else if (kind === 'oven-glow') {
    rect(ctx, 52, 52, 24, 14, frame % 2 ? P.gold : P.terracottaLight); rect(ctx, 57, 56, 14, 6, P.goldLight);
  } else if (kind === 'bubble') {
    for (let i = 0; i < 4; i += 1) pixelEllipse(ctx, 57 + i * 5, 62 - ((i + frame) % 3) * 3, 2, 1, i % 2 ? P.creamLight : P.blue);
  } else {
    diamond(ctx, 64, 48, 10 + frame % 2, 5, P.goldLight); rect(ctx, 63, 34, 2, 7, P.creamLight); rect(ctx, 54, 41, 5, 2, P.creamLight); rect(ctx, 69, 41, 5, 2, P.creamLight);
  }
}

function drawCharacter(ctx: Ctx, variant: string, animation: PixelAnimationName, direction: Direction, frame: number, appearance?: CharacterAppearance): void {
  ctx.save();
  ctx.scale(.5, .5);
  const colors = characterColors(variant, appearance);
  const back = direction === 'ne' || direction === 'nw';
  const right = direction === 'ne' || direction === 'se';
  const mirror = right ? 1 : -1;
  const isSeated = animation === 'sit' || animation === 'seated' || animation === 'eat';
  const walkPhase = animation === 'walk' ? [0, 2, 4, 0, -2, -4][frame] : 0;
  const bob = animation === 'walk' ? (frame === 1 || frame === 4 ? -2 : 0) : animation === 'idle' ? frame % 2 : 0;
  const sitDrop = isSeated ? (animation === 'sit' ? 6 + frame * 6 : 12) : 0;
  const footY = 88;
  pixelEllipse(ctx, 32, 87, isSeated ? 20 : 15, 4, P.shadow);
  if (!isSeated) {
    const leftLeg = walkPhase > 0 ? -4 : walkPhase < 0 ? 2 : -2;
    const rightLeg = walkPhase > 0 ? 2 : walkPhase < 0 ? -4 : 2;
    rect(ctx, 20 + leftLeg, footY - 22, 10, 19, P.outline); rect(ctx, 36 + rightLeg, footY - 22, 10, 19, P.outline);
    rect(ctx, 23 + leftLeg, footY - 21, 5, 16, P.blueDark); rect(ctx, 38 + rightLeg, footY - 21, 5, 16, P.blueDark);
    rect(ctx, 17 + leftLeg, footY - 6, 14, 6, P.outline); rect(ctx, 36 + rightLeg, footY - 6, 14, 6, P.outline);
    rect(ctx, 19 + leftLeg, footY - 5, 10, 2, P.woodDark); rect(ctx, 38 + rightLeg, footY - 5, 10, 2, P.woodDark);
  } else {
    rect(ctx, 17, 78, 18, 8, P.outline); rect(ctx, 32, 82, 19, 8, P.outline);
    rect(ctx, 20, 79, 13, 4, P.blueDark); rect(ctx, 34, 83, 14, 4, P.blueDark);
  }
  const torsoY = 43 + bob + sitDrop;
  pixelQuad(ctx, [{ x: 20, y: torsoY }, { x: 26, y: torsoY - 4 }, { x: 38, y: torsoY - 4 }, { x: 45, y: torsoY }, { x: 47, y: torsoY + 24 }, { x: 42, y: torsoY + 30 }, { x: 21, y: torsoY + 30 }, { x: 16, y: torsoY + 24 }], P.outline);
  pixelQuad(ctx, [{ x: 22, y: torsoY + 2 }, { x: 27, y: torsoY }, { x: 37, y: torsoY }, { x: 42, y: torsoY + 3 }, { x: 43, y: torsoY + 22 }, { x: 40, y: torsoY + 26 }, { x: 23, y: torsoY + 26 }, { x: 20, y: torsoY + 22 }], colors.outfit);
  rect(ctx, 29, torsoY, 7, 26, colors.accent);
  rect(ctx, 26, torsoY, 4, 6, P.creamLight); rect(ctx, 36, torsoY, 4, 6, P.creamLight);
  rect(ctx, 23, torsoY + 22, 18, 4, shade(colors.outfit));
  const armSwing = animation === 'walk' ? (frame < 3 ? 4 : -4) : animation === 'work' || animation === 'eat' ? (frame % 2 ? 4 : 0) : 0;
  rect(ctx, 12 + mirror * armSwing, torsoY + 5, 9, 20, P.outline); rect(ctx, 15 + mirror * armSwing, torsoY + 7, 4, 14, colors.outfit);
  rect(ctx, 13 + mirror * armSwing, torsoY + 21, 8, 8, P.outline); rect(ctx, 15 + mirror * armSwing, torsoY + 22, 6, 6, colors.skin);
  rect(ctx, 43 - mirror * armSwing, torsoY + 5, 9, 20, P.outline); rect(ctx, 45 - mirror * armSwing, torsoY + 7, 4, 14, colors.outfit);
  rect(ctx, 43 - mirror * armSwing, torsoY + 21, 8, 8, P.outline); rect(ctx, 43 - mirror * armSwing, torsoY + 22, 6, 6, colors.skin);
  rect(ctx, 27, torsoY - 8, 10, 8, P.outline); rect(ctx, 29, torsoY - 8, 6, 8, colors.skin);
  const headY = 26 + bob + sitDrop;
  pixelEllipse(ctx, 32, headY, 15, 18, P.outline);
  pixelEllipse(ctx, 32, headY, 13, 16, colors.skin);
  rect(ctx, right ? 45 : 16, headY - 2, 5, 9, P.outline); rect(ctx, right ? 45 : 17, headY, 4, 6, colors.skin);
  rect(ctx, right ? 19 : 42, headY + 2, 3, 9, shade(colors.skin));
  if (!back) {
    rect(ctx, 23 + (right ? 4 : 0), headY - 2, 4, 4, P.outline); rect(ctx, 38 - (right ? 0 : 4), headY - 2, 4, 4, P.outline);
    rect(ctx, 24 + (right ? 4 : 0), headY - 2, 1, 1, P.creamLight); rect(ctx, 39 - (right ? 0 : 4), headY - 2, 1, 1, P.creamLight);
    rect(ctx, 31 + mirror * 4, headY + 4, 3, 3, shade(colors.skin));
    rect(ctx, 29 + mirror * 2, headY + 10, 7, 2, P.terracottaDark);
    rect(ctx, right ? 21 : 40, headY + 6, 4, 2, '#dc866e');
  }
  drawHair(ctx, colors.hairStyle, colors.hair, back, right, headY);
  if (variant === 'cook') drawChefHat(ctx, headY);
  if (variant === 'waiter') { rect(ctx, 24, torsoY + 3, 16, 4, P.white); rect(ctx, 30, torsoY + 7, 5, 17, P.outlineSoft); rect(ctx, 27, torsoY + 13, 11, 2, P.gold); }
  if (variant === 'assistant') { rect(ctx, 23, torsoY + 7, 18, 15, P.cream); rect(ctx, 26, torsoY + 5, 4, 19, P.woodDark); rect(ctx, 37, torsoY + 5, 4, 19, P.woodDark); }
  if (animation === 'carry-dish' || (variant === 'waiter' && animation === 'work')) drawCarriedDish(ctx, right, torsoY);
  if (animation === 'carry-ingredients') drawCrate(ctx, torsoY);
  if (animation === 'work' && variant !== 'waiter') { rect(ctx, 47, torsoY + 15 - frame % 2 * 2, 12, 4, P.steelBright); rect(ctx, 56, torsoY + 9 - frame % 2 * 2, 4, 10, P.woodDark); }
  if (animation === 'eat') { rect(ctx, 44, torsoY + 6 - frame % 2 * 2, 15, 2, P.steelBright); pixelEllipse(ctx, 46, torsoY + 6 - frame % 2 * 2, 4, 2, P.creamLight); }
  ctx.restore();
}

function characterColors(variant: string, appearance?: CharacterAppearance): CharacterColors {
  const skins = ['#f4cfb4', '#d99a68', '#9b6646', '#603d29', '#edbd98', '#bc7b54', '#70472f', '#4b3024'];
  const hairs = ['#3a241d', '#a15432', '#252431', '#70432a', '#d18b45', '#2b1c19', '#5e392d', '#1f2027'];
  const outfits = ['#4f8293', '#c65b3e', '#7d9b68', '#7a5b83', '#d8954f', '#315b6e', '#9f5b55', '#54704b'];
  const skinMap: Record<string, string> = { porcelain: '#f6d4bd', honey: '#d99a68', cocoa: '#8b5a3c', ebony: '#553521' };
  const hairMap: Record<string, string> = { espresso: '#3a241d', chestnut: '#74432d', copper: '#b95f3a', midnight: '#242635' };
  const outfitMap: Record<string, string> = { teal: '#1d766d', coral: '#d96652', gold: '#d49a3a', plum: '#76536c' };
  if (variant === 'player') return { skin: skinMap[appearance?.skin ?? 'honey'], hair: hairMap[appearance?.hairColor ?? 'espresso'], outfit: outfitMap[appearance?.outfitColor ?? 'teal'], accent: P.creamLight, role: 'player', hairStyle: appearance?.hairStyle ?? 'wave' };
  if (variant === 'cook') return { skin: '#8b5a3c', hair: '#2b1c19', outfit: P.creamLight, accent: P.white, role: 'cook', hairStyle: 'bun' };
  if (variant === 'waiter') return { skin: '#e7b58f', hair: '#30231e', outfit: P.terracotta, accent: P.creamLight, role: 'waiter', hairStyle: 'crop' };
  if (variant === 'assistant') return { skin: '#6f462f', hair: '#242635', outfit: P.sage, accent: P.cream, role: 'assistant', hairStyle: 'curls' };
  const index = Number(variant.split('-')[1]) || 0;
  return { skin: skins[index], hair: hairs[index], outfit: outfits[index], accent: index % 2 ? P.cream : P.goldLight, role: 'customer', hairStyle: ['wave', 'crop', 'bun', 'curls'][index % 4] };
}

function drawHair(ctx: Ctx, style: string, color: string, back: boolean, right: boolean, headY: number): void {
  pixelEllipse(ctx, 32, headY - 13, 16, 10, P.outline); pixelEllipse(ctx, 32, headY - 13, 14, 8, color);
  rect(ctx, right ? 17 : 40, headY - 11, 7, back ? 23 : 13, P.outline);
  rect(ctx, right ? 19 : 40, headY - 9, 4, back ? 19 : 10, color);
  rect(ctx, 25, headY - 19, 10, 2, lighten(color, 34));
  rect(ctx, right ? 34 : 25, headY - 9, 10, 4, color);
  if (style === 'bun') {
    pixelEllipse(ctx, right ? 19 : 45, headY - 19, 10, 10, P.outline);
    pixelEllipse(ctx, right ? 19 : 45, headY - 19, 8, 8, color);
    rect(ctx, right ? 16 : 42, headY - 23, 6, 2, lighten(color, 34));
  }
  if (style === 'curls') for (let x = 18; x <= 46; x += 8) {
    pixelEllipse(ctx, x, headY - 8 + (x % 5), 6, 6, P.outline);
    pixelEllipse(ctx, x, headY - 8 + (x % 5), 4, 4, color);
  }
  if (style === 'wave') {
    rect(ctx, 17, headY - 9, 8, 21, P.outline); rect(ctx, 19, headY - 8, 4, 18, color);
    rect(ctx, 40, headY - 11, 8, 24, P.outline); rect(ctx, 42, headY - 9, 4, 20, color);
    rect(ctx, 19, headY + 8, 6, 4, lighten(color, 24));
  }
}

function drawChefHat(ctx: Ctx, headY: number): void {
  pixelEllipse(ctx, 32, headY - 27, 17, 8, P.outline); pixelEllipse(ctx, 23, headY - 29, 8, 8, P.white);
  pixelEllipse(ctx, 34, headY - 33, 10, 10, P.white); pixelEllipse(ctx, 44, headY - 27, 8, 8, P.white);
  rect(ctx, 17, headY - 25, 30, 8, P.white); rect(ctx, 19, headY - 20, 26, 3, P.creamShade);
}

function drawCarriedDish(ctx: Ctx, right: boolean, torsoY: number): void {
  const x = right ? 48 : 16; rect(ctx, x - 12, torsoY + 16, 28, 4, P.outline); rect(ctx, x - 8, torsoY + 14, 20, 2, P.steelBright);
  rect(ctx, x, torsoY + 8, 10, 6, P.terracotta); rect(ctx, x + 4, torsoY + 6, 6, 4, P.sageLight);
}

function drawCrate(ctx: Ctx, torsoY: number): void {
  rect(ctx, 14, torsoY + 16, 36, 18, P.outline); rect(ctx, 18, torsoY + 18, 28, 12, P.woodMid);
  rect(ctx, 24, torsoY + 14, 8, 6, P.sageLight); rect(ctx, 36, torsoY + 12, 8, 8, P.terracotta);
}

function rect(ctx: Ctx, x: number, y: number, width: number, height: number, color: string): void { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height)); }

function pixelEllipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: string): void {
  ctx.fillStyle = color;
  for (let y = -ry; y <= ry; y += 1) {
    const width = Math.max(1, Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / Math.max(1, ry * ry)))));
    ctx.fillRect(Math.round(cx - width), Math.round(cy + y), Math.round(width * 2 + 1), 1);
  }
}

function diamond(ctx: Ctx, cx: number, cy: number, halfWidth: number, halfHeight: number, color: string): void {
  ctx.fillStyle = color;
  for (let y = -halfHeight; y <= halfHeight; y += 1) {
    const width = Math.max(0, Math.floor(halfWidth * (1 - Math.abs(y) / Math.max(1, halfHeight))));
    ctx.fillRect(Math.round(cx - width), Math.round(cy + y), Math.max(1, Math.round(width * 2 + 1)), 1);
  }
}

function pixelQuad(ctx: Ctx, points: Point[], color: string): void {
  const minY = Math.ceil(Math.min(...points.map((point) => point.y)));
  const maxY = Math.floor(Math.max(...points.map((point) => point.y)));
  ctx.fillStyle = color;
  for (let y = minY; y <= maxY; y += 1) {
    const intersections: number[] = [];
    for (let index = 0; index < points.length; index += 1) {
      const a = points[index]; const b = points[(index + 1) % points.length];
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) intersections.push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y));
    }
    intersections.sort((a, b) => a - b);
    for (let index = 0; index + 1 < intersections.length; index += 2) {
      const start = Math.ceil(intersections[index]); const end = Math.floor(intersections[index + 1]);
      ctx.fillRect(start, y, Math.max(1, end - start + 1), 1);
    }
  }
}

function footprintCorners(widthCells: number, depthCells: number, centerX: number, centerY: number): { top: Point; right: Point; bottom: Point; left: Point } {
  const sum = widthCells + depthCells;
  const difference = widthCells - depthCells;
  return {
    top: { x: centerX - 8 * difference, y: centerY - 4 * sum },
    right: { x: centerX + 8 * sum, y: centerY + 4 * difference },
    bottom: { x: centerX + 8 * difference, y: centerY + 4 * sum },
    left: { x: centerX - 8 * sum, y: centerY - 4 * difference },
  };
}

function pixelLine(ctx: Ctx, from: Point, to: Point, color: string): void {
  let x0 = Math.round(from.x); let y0 = Math.round(from.y); const x1 = Math.round(to.x); const y1 = Math.round(to.y);
  const dx = Math.abs(x1 - x0); const sx = x0 < x1 ? 1 : -1; const dy = -Math.abs(y1 - y0); const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  ctx.fillStyle = color;
  while (true) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const doubled = 2 * error;
    if (doubled >= dy) { error += dy; x0 += sx; }
    if (doubled <= dx) { error += dx; y0 += sy; }
  }
}

function shade(color: string): string {
  const raw = color.replace('#', '');
  if (raw.length !== 6) return color;
  const value = Number.parseInt(raw, 16); const r = Math.max(0, ((value >> 16) & 255) - 28); const g = Math.max(0, ((value >> 8) & 255) - 28); const b = Math.max(0, (value & 255) - 28);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function lighten(color: string, amount: number): string {
  const raw = color.replace('#', '');
  if (raw.length !== 6) return color;
  const value = Number.parseInt(raw, 16);
  const r = Math.min(255, ((value >> 16) & 255) + amount);
  const g = Math.min(255, ((value >> 8) & 255) + amount);
  const b = Math.min(255, (value & 255) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
