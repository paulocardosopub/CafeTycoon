import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyEquipmentAsset, EQUIPMENT_ASSETS } from '../content/equipment/equipment';

interface ManifestAsset {
  assetId: string; kind: 'character' | 'furniture' | 'equipment'; category: string; sourceBlend: string;
  renderedFile: string; thumbnail: string; orientations: string[]; animations: Record<string, number>;
  frameCount: number; frameSize: number[]; footprint: number[]; anchor: number[]; visualLevel: number;
  transparent: boolean; nextLevelAssetId?: string | null; qualityProfile: string; nativeScale: number;
  identityProfile?: string; bodyProfile?: string; visualSkinId?: string; layerRole?: string;
  referenceSource?: string; referenceMode?: string; visualBounds?: { overhangCells: number };
}

interface AssetManifest {
  version: string; qualityProfile: string; designReference: string;
  visualContract: { characterLogicalFootprint: number[]; characterHeightBlocks: number[]; feetAnchor: number[]; worldFloorY: number };
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

describe('pipeline Blender 0.0.4', () => {
  it('registra a reconstrução original e o contrato isométrico', () => {
    expect(manifest.version).toBe('0.0.4-blender-7');
    expect(manifest.qualityProfile).toBe('bistro-bloom-character-bible-v2');
    expect(manifest.visualContract).toMatchObject({
      characterLogicalFootprint: [1, 1], characterHeightBlocks: [1.5, 2], feetAnchor: [48, 136], worldFloorY: 178,
    });
    expect(statSync(resolve(projectRoot, manifest.designReference)).size).toBeGreaterThan(100_000);
    expect(manifest.camera).toMatchObject({ projection: 'orthographic', horizontalAngle: 45, frameGrid: '64x32' });
    expect(manifest.camera.inclination).toBeCloseTo(35.264, 3);
  });

  it('gera 72 assets individuais, fontes editáveis e thumbnails', () => {
    expect(manifest.assets).toHaveLength(72);
    expect(manifest.assets.filter((item) => item.kind === 'character')).toHaveLength(16);
    expect(manifest.assets.filter((item) => item.kind === 'furniture')).toHaveLength(31);
    expect(manifest.assets.filter((item) => item.kind === 'equipment')).toHaveLength(25);
    for (const asset of manifest.assets) {
      expect(statSync(resolve(projectRoot, asset.sourceBlend)).size).toBeGreaterThan(10_000);
      expect(statSync(canonicalPng(asset)).size).toBeGreaterThan(100);
      expect(statSync(resolve(projectRoot, 'public', asset.renderedFile.slice(1))).size).toBeGreaterThan(100);
      expect(statSync(resolve(projectRoot, 'public', asset.thumbnail.slice(1))).size).toBeGreaterThan(100);
    }
  });

  it('preserva quatro direções, pés, poses completas e PNG RGBA nítido', () => {
    const required = ['idle', 'walk', 'sit-down', 'seated-idle', 'seated-waiting', 'seated-eating', 'stand-up', 'carry-plate', 'carry-ingredients', 'cook', 'use-appliance', 'serve', 'clean', 'receive-payment'];
    for (const asset of manifest.assets) {
      expect(asset.orientations).toEqual(['ne', 'nw', 'se', 'sw']);
      expect(asset.visualLevel).toBe(1);
      expect(asset.qualityProfile).toBe('bistro-bloom-character-bible-v2');
      expect(asset.nativeScale).toBe(1);
      expect(asset.transparent).toBe(true);
      expect(asset.visualSkinId).toBeTruthy();
      expect(asset.visualBounds?.overhangCells).toBeLessThanOrEqual(.35);
      const header = pngHeader(canonicalPng(asset));
      expect(header.height).toBe(asset.frameSize[1] * asset.orientations.length);
      expect(header.width % asset.frameSize[0]).toBe(0);
      expect(header.width).toBeGreaterThanOrEqual(asset.frameSize[0] * asset.frameCount);
      expect(header.width).toBeLessThanOrEqual(asset.frameSize[0] * Math.max(asset.frameCount, asset.orientations.length));
      expect(header.colorType).toBe(6);
      if (asset.kind === 'character') {
        expect(asset.frameSize).toEqual([96, 144]);
        expect(asset.anchor).toEqual([48, 136]);
        expect(asset.animations.walk).toBe(6);
        expect(Object.keys(asset.animations)).toEqual(expect.arrayContaining(required));
      } else if (asset.assetId.startsWith('pickup_counter')) {
        expect(asset.frameSize).toEqual([256, 192]);
        expect(asset.anchor[1]).toBeCloseTo(178 / 192, 5);
      } else {
        expect(asset.frameSize).toEqual([192, 192]);
        expect(asset.anchor[1]).toBeCloseTo(178 / 192, 5);
      }
    }
  });

  it('usa os oito consumidores e personagens autorizados do pacote Cafe Mania', () => {
    const customers = manifest.assets.filter((item) => item.assetId.startsWith('customer-'));
    expect(customers).toHaveLength(8);
    expect(new Set(customers.map((item) => item.identityProfile)).size).toBe(8);
    expect(new Set(customers.map((item) => item.bodyProfile)).size).toBe(8);
    expect(manifest.assets.filter((item) => item.kind === 'character').every((item) => item.referenceMode === 'authorized-character-sheet' && item.referenceSource)).toBe(true);
    const authorized = manifest.assets.filter((item) => item.referenceMode === 'authorized-canonical-chroma-key');
    expect(authorized.length).toBeGreaterThanOrEqual(15);
    expect(authorized.every((item) => item.kind !== 'character' && item.referenceSource)).toBe(true);
  });

  it('divide três cadeiras estruturais em encosto, conjunto completo e frente', () => {
    for (const skin of ['wood', 'upholstered', 'bistro']) {
      const chairAssets = manifest.assets.filter((item) => item.assetId.startsWith(`chair_${skin}`));
      expect(chairAssets).toHaveLength(3);
      expect(new Set(chairAssets.map((item) => item.layerRole))).toEqual(new Set(['full', 'back', 'front']));
    }
  });

  it('mantém estados/footprints dos equipamentos de nível 1', () => {
    const stove = manifest.assets.find((item) => item.assetId === 'stove_level_1')!;
    const refrigerator = manifest.assets.find((item) => item.assetId === 'refrigerator_level_1')!;
    expect(stove).toMatchObject({ footprint: [2, 1], animations: { off: 1, active: 2, complete: 1 } });
    expect(refrigerator).toMatchObject({ footprint: [2, 1], animations: { closed: 1, open: 2, complete: 1 } });
    expect(EQUIPMENT_ASSETS).toHaveLength(9);
    for (const definition of EQUIPMENT_ASSETS) {
      const runtime = { id: 'station', position: { x: 4, y: 5 }, orientation: 'sw', activeOrderId: 'order-7' } as const;
      const upgraded = applyEquipmentAsset(runtime, definition);
      expect(upgraded.position).toBe(runtime.position);
      expect(upgraded.orientation).toBe(runtime.orientation);
      expect(upgraded.activeOrderId).toBe(runtime.activeOrderId);
      expect(definition.nextLevelAssetId).toBe(`${definition.equipmentFamilyId}_level_2`);
    }
  });

  it('serve os sprites novos e invalida o cache visual antigo', () => {
    const scene = readFileSync(resolve(projectRoot, 'src/scenes/RestaurantScene.ts'), 'utf8');
    const worker = readFileSync(resolve(projectRoot, 'scripts/build-worker.mjs'), 'utf8');
    expect(scene).toContain('?v=${encodeURIComponent(asset.renderVersion)}');
    expect(scene).toContain('variant >= 0 && variant <= 7');
    expect(scene).toContain('VISUAL_METRICS.depth.chairBack');
    expect(scene).toContain('VISUAL_METRICS.depth.chairFront');
    expect(worker).toContain('env?.ASSETS?.fetch');
  });
});
