import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyEquipmentAsset, EQUIPMENT_ASSETS } from '../content/equipment/equipment';

interface ManifestAsset {
  assetId: string; kind: 'character' | 'furniture' | 'equipment'; category: string; sourceBlend: string;
  renderedFile: string; thumbnail: string; orientations: string[]; animations: Record<string, number>;
  frameCount: number; frameSize: number[]; footprint: number[]; anchor: number[]; visualLevel: number;
  transparent: boolean; nextLevelAssetId?: string | null;
}

interface AssetManifest {
  version: string;
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
      expect(asset.transparent).toBe(true);
      expect(asset.footprint[0]).toBeGreaterThan(0);
      const header = pngHeader(canonicalPng(asset));
      expect(header).toMatchObject({ width: asset.frameSize[0] * asset.frameCount, height: asset.frameSize[1] * 4, colorType: 6 });
      if (asset.kind === 'character') {
        expect(asset.anchor).toEqual([32, 88]);
        expect(Object.keys(asset.animations)).toEqual(expect.arrayContaining(required));
      }
    }
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
    expect(buildScript).toContain('--category');
    expect(buildScript).toContain('selected or item["assetId"] == selected');
  });
});
