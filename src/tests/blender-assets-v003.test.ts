import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyEquipmentAsset, EQUIPMENT_ASSETS } from '../content/equipment/equipment';

interface ManifestAsset {
  assetId: string; kind: 'character' | 'furniture' | 'equipment'; category: string; sourceBlend: string;
  renderedFile: string; thumbnail: string; orientations: string[]; animations: Record<string, number>;
  frameCount: number; frameSize: number[]; footprint: number[]; anchor: number[]; visualLevel: number;
  transparent: boolean; nextLevelAssetId?: string | null; qualityProfile: string; nativeScale: number;
  referenceSource?: string; referenceMode?: string;
}

interface AssetManifest {
  version: string;
  qualityProfile: string;
  camera: { projection: string; horizontalAngle: number; inclination: number; frameGrid: string };
  assets: ManifestAsset[];
}

const projectRoot = resolve(import.meta.dirname, '../..');
const manifest = JSON.parse(readFileSync(resolve(projectRoot, 'public/assets/pixel/rendered/asset-manifest.json'), 'utf8')) as AssetManifest;

function canonicalPng(asset: ManifestAsset): string {
  return resolve(projectRoot, 'assets/pixel/rendered', asset.category, `${asset.assetId}.png`);
}

function pngHeader(path: string): { width: number; height: number; colorType: number } {
  const data = readFileSync(path);
  expect(data.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), colorType: data[25] };
}

describe('pipeline Blender 0.0.3', () => {
  it('mantÃ©m a versÃ£o do jogo e evolui apenas a revisÃ£o visual', () => {
    expect(manifest.version).toBe('0.0.3-blender-4');
    expect(manifest.qualityProfile).toBe('reference-canonical-v3');
  });

  it('mantém câmera isométrica ortográfica padronizada', () => {
    expect(manifest.camera).toMatchObject({ projection: 'orthographic', horizontalAngle: 45, frameGrid: '64x32' });
    expect(manifest.camera.inclination).toBeCloseTo(35.264, 3);
  });

  it('gera os 36 assets individuais e suas fontes editáveis', () => {
    expect(manifest.assets).toHaveLength(36);
    expect(manifest.assets.filter((item) => item.kind === 'character')).toHaveLength(18);
    expect(manifest.assets.filter((item) => item.kind === 'furniture')).toHaveLength(9);
    expect(manifest.assets.filter((item) => item.kind === 'equipment')).toHaveLength(9);
    for (const asset of manifest.assets) {
      expect(statSync(resolve(projectRoot, asset.sourceBlend)).size).toBeGreaterThan(10_000);
      expect(statSync(canonicalPng(asset)).size).toBeGreaterThan(100);
      expect(statSync(resolve(projectRoot, 'public', asset.renderedFile.slice(1))).size).toBeGreaterThan(100);
      expect(statSync(resolve(projectRoot, 'public', asset.thumbnail.slice(1))).size).toBeGreaterThan(100);
    }
  });

  it('preserva quatro direções, pés, animações e PNG RGBA nítido', () => {
    const required = ['idle', 'walk', 'carry-dish', 'carry-ingredients', 'cook', 'serve', 'clean', 'sit', 'seated', 'eat', 'stand'];
    for (const asset of manifest.assets) {
      expect(asset.orientations).toEqual(['ne', 'nw', 'se', 'sw']);
      expect(asset.visualLevel).toBe(1);
      expect(asset.qualityProfile).toBe('reference-canonical-v3');
      expect(asset.nativeScale).toBe(1);
      expect(asset.transparent).toBe(true);
      expect(asset.footprint[0]).toBeGreaterThan(0);
      const header = pngHeader(canonicalPng(asset));
      expect(header).toMatchObject({ width: asset.frameSize[0] * asset.frameCount, height: asset.frameSize[1] * 4, colorType: 6 });
      if (asset.kind === 'character') {
        expect(asset.frameSize).toEqual([96, 144]);
        expect(asset.anchor).toEqual([48, 136]);
        expect(asset.animations.walk).toBe(6);
        expect(Object.keys(asset.animations)).toEqual(expect.arrayContaining(required));
      } else if (asset.assetId === 'pickup_counter') {
        expect(asset.frameSize).toEqual([256, 192]);
      } else {
        expect(asset.frameSize).toEqual([192, 192]);
      }
    }
  });

  it('implementa os estados e footprints das quatro referÃªncias visuais', () => {
    const cook = manifest.assets.find((item) => item.assetId === 'cook-0')!;
    const customer = manifest.assets.find((item) => item.assetId === 'customer-0')!;
    const stove = manifest.assets.find((item) => item.assetId === 'stove_level_1')!;
    const refrigerator = manifest.assets.find((item) => item.assetId === 'refrigerator_level_1')!;
    for (const character of [cook, customer]) {
      expect(character.orientations).toHaveLength(4);
      expect(character.animations.walk).toBe(6);
    }
    expect(stove).toMatchObject({ footprint: [2, 1], animations: { off: 1, active: 2, complete: 1 } });
    expect(refrigerator).toMatchObject({ footprint: [2, 1], animations: { closed: 1, open: 2, complete: 1 } });
    for (const asset of [cook, customer, stove, refrigerator]) {
      expect(asset.referenceMode).toBe('canonical-chroma-key');
      expect(asset.referenceSource).toBeTruthy();
      expect(statSync(resolve(projectRoot, asset.referenceSource!)).size).toBeGreaterThan(100_000);
    }
  });

  it('serve sprites públicos e invalida cache por revisão visual', () => {
    const scene = readFileSync(resolve(projectRoot, 'src/scenes/RestaurantScene.ts'), 'utf8');
    const worker = readFileSync(resolve(projectRoot, 'scripts/build-worker.mjs'), 'utf8');
    expect(scene).toContain('?v=${encodeURIComponent(asset.renderVersion)}');
    expect(worker).toContain('env?.ASSETS?.fetch');
  });

  it('mantém dados visuais separados e troca futura sem mover a estação', () => {
    expect(EQUIPMENT_ASSETS).toHaveLength(9);
    for (const definition of EQUIPMENT_ASSETS) {
      expect(definition).toMatchObject({ visualLevel: 1, gameplayLevel: 1, animationSet: 'equipment-basic-v1' });
      expect(definition.nextLevelAssetId).toBe(`${definition.equipmentFamilyId}_level_2`);
      const runtime = { id: 'station', position: { x: 4, y: 5 }, orientation: 'sw', activeOrderId: 'order-7' } as const;
      const upgraded = applyEquipmentAsset(runtime, definition);
      expect(upgraded.position).toBe(runtime.position);
      expect(upgraded.orientation).toBe(runtime.orientation);
      expect(upgraded.activeOrderId).toBe(runtime.activeOrderId);
    }
  });

  it('oferece renderização por categoria e por ID', () => {
    const buildScript = readFileSync(resolve(projectRoot, 'tools/blender/build_assets.py'), 'utf8');
    expect(buildScript).toContain('parser.add_argument("--asset")');
    expect(buildScript).toContain('parser.add_argument("--assets")');
    expect(buildScript).toContain('--category');
    expect(buildScript).toContain('item["assetId"] in selected_ids');
  });
});
