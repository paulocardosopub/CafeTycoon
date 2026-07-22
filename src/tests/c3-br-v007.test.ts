import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { C3_BR_CHARACTER_ASSETS, C3_BR_LEGACY_ALIASES } from '../assets/pixel/c3brManifest';

const projectRoot = resolve(import.meta.dirname, '../..');
const manifestPath = resolve(projectRoot, 'public/assets/pixel/rendered/c3-br-character-manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  version: string;
  gameVersion: string;
  frame: { size: number[]; feetAnchor: number[]; transparent: boolean };
  camera: { projection: string; horizontalAngle: number; inclination: number; tile: number[]; zooms: number[] };
  legacyAliases: Record<string, string>;
  assets: typeof C3_BR_CHARACTER_ASSETS;
};

const shared = ['idle', 'walk', 'sit_down', 'seated_idle', 'stand_up', 'talk', 'wait', 'react_happy'];
const roleAnimations = {
  player: ['carry_plate_idle', 'carry_plate_walk', 'carry_tray_idle', 'carry_tray_walk', 'pickup_dish', 'place_dish', 'pickup_ingredient', 'cook_stove', 'prep_counter', 'wash_sink', 'serve_table', 'clear_table', 'clean_table'],
  cook: ['carry_plate_idle', 'carry_plate_walk', 'pickup_ingredient', 'cook_stove', 'prep_counter', 'wash_sink', 'place_dish', 'wait_workstation'],
  waiter: ['carry_plate_idle', 'carry_plate_walk', 'carry_tray_idle', 'carry_tray_walk', 'pickup_dish', 'serve_table', 'clear_table', 'clean_table', 'wait_service'],
  customer: ['wait_food', 'eat', 'drink', 'talk_seated', 'react_impatient'],
} as const;

function pngHeader(path: string): { width: number; height: number; colorType: number } {
  const data = readFileSync(path);
  expect(data.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), colorType: data[25] };
}

describe('pacote definitivo C3-BR 0.0.7', () => {
  it('registra exatamente os dez personagens e a câmera real do jogo', () => {
    expect(manifest.assets).toHaveLength(10);
    expect(C3_BR_CHARACTER_ASSETS).toHaveLength(10);
    expect(new Set(manifest.assets.map((asset) => asset.assetId)).size).toBe(10);
    expect(manifest.assets.filter((asset) => asset.role === 'player')).toHaveLength(2);
    expect(manifest.assets.filter((asset) => asset.role === 'cook')).toHaveLength(1);
    expect(manifest.assets.filter((asset) => asset.role === 'waiter')).toHaveLength(1);
    expect(manifest.assets.filter((asset) => asset.role === 'customer')).toHaveLength(6);
    expect(manifest.camera).toMatchObject({ projection: 'orthographic', horizontalAngle: 45, tile: [64, 32], zooms: [.5, 1, 2] });
    expect(manifest.camera.inclination).toBeCloseTo(35.264, 3);
  });

  it('possui rigs editáveis, quatro direções reais e todas as animações funcionais', () => {
    expect(statSync(resolve(projectRoot, 'art_source/blender/characters/c3_br_characters.blend')).size).toBeGreaterThan(1_000_000);
    expect(statSync(resolve(projectRoot, 'art_source/blender/render_scene/c3_br_render_scene.blend')).size).toBeGreaterThan(1_000_000);
    for (const asset of manifest.assets) {
      expect(asset.orientations).toEqual(['ne', 'nw', 'se', 'sw']);
      expect(asset.rigId).toBe('C3BR_Humanoid_v1');
      expect(asset.facialRig).toBe('bones+shape-keys');
      expect(asset.fallback).toBe('idle');
      expect(Object.keys(asset.animations)).toEqual(expect.arrayContaining([...shared, ...roleAnimations[asset.role]]));
      expect(asset.animations.idle).toBeGreaterThanOrEqual(4);
      expect(asset.animations.walk).toBe(8);
      expect(asset.animations.sit_down).toBe(6);
      expect(asset.animations.stand_up).toBe(6);
      expect(Object.keys(asset.fps)).toEqual(Object.keys(asset.animations));
      expect(Object.keys(asset.loops)).toEqual(Object.keys(asset.animations));
    }
  });

  it('exporta folhas RGBA nítidas, pivô estável e todos os PNGs individuais', () => {
    for (const asset of manifest.assets) {
      expect(asset.frameSize).toEqual(manifest.frame.size);
      expect(asset.anchor).toEqual(manifest.frame.feetAnchor);
      expect(asset.transparent).toBe(true);
      const sheet = resolve(projectRoot, 'public', asset.spriteSheet.slice(1));
      const header = pngHeader(sheet);
      expect(header.width).toBe(asset.frameSize[0] * asset.frameCount);
      expect(header.height).toBe(asset.frameSize[1] * 4);
      expect(header.colorType).toBe(6);
      expect(statSync(sheet).size).toBeGreaterThan(10_000);
      const sourceDir = resolve(projectRoot, 'assets/characters/c3_br', asset.assetId.replace('char_', ''));
      expect(readdirSync(sourceDir, { recursive: true }).filter((name) => String(name).endsWith('.png'))).toHaveLength(asset.frameCount * 4);
    }
  });

  it('mantém os IDs antigos como aliases sem apagar saves existentes', () => {
    for (const id of ['player-style-0', 'player-style-1', 'cook-0', 'waiter-0', 'cleaner-0', 'stocker-0']) {
      expect(C3_BR_LEGACY_ALIASES[id]).toMatch(/^char_/);
      expect(manifest.legacyAliases[id]).toBe(C3_BR_LEGACY_ALIASES[id]);
    }
    expect(new Set(Array.from({ length: 10 }, (_, index) => C3_BR_LEGACY_ALIASES[`customer-${index}`]))).toHaveLength(6);
    const simulation = readFileSync(resolve(projectRoot, 'src/game/simulation/RestaurantSimulation.ts'), 'utf8');
    expect(simulation).toContain('variant: (this.customerSequence - 1) % 6');
    const scene = readFileSync(resolve(projectRoot, 'src/scenes/RestaurantScene.ts'), 'utf8');
    expect(scene).toContain("asset.animations[animation] ? animation : ('fallback' in asset ? asset.fallback : 'idle')");
  });
});
