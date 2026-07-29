import { describe, expect, it } from 'vitest';
import {
  PRODUCTION_V003_CHARACTER_ASSETS,
  PRODUCTION_V003_CUSTOMER_ASSET_IDS,
  PRODUCTION_V003_FURNITURE_ASSETS,
  PRODUCTION_V003_FURNITURE_SPECS,
  PRODUCTION_V003_STAFF_ASSET_BY_DEFINITION_ID,
  productionFurnitureAnchor,
  productionFurnitureAssetId,
} from '../assets/pixel/productionV003Manifest';
import { CUSTOMER_CHARACTER_ASSET_IDS } from '../assets/pixel/characterVariantManifest';
import { STAFF_CATALOG } from '../game/data/staff';
import {
  ACTIVE_PRODUCTION_V003_FURNITURE_IDS,
  FURNITURE_LEVEL_UNLOCKS,
  MAX_FURNITURE_LEVEL,
  clampFurnitureLevel,
  furnitureLevelAssetId,
  furnitureUpgradeCost,
} from '../game/data/furniture/levels';
import { createDefaultState } from '../game/save/defaultState';
import { migrateAndSanitizeSave } from '../game/save/migrations';
import { ConstructionEditor } from '../game/systems/construction/ConstructionEditor';

describe('produção visual v003', () => {
  it('acrescenta exatamente 30 clientes únicos ao conjunto anterior', () => {
    expect(PRODUCTION_V003_CUSTOMER_ASSET_IDS).toHaveLength(30);
    expect(new Set(PRODUCTION_V003_CUSTOMER_ASSET_IDS)).toHaveLength(30);
    expect(CUSTOMER_CHARACTER_ASSET_IDS).toHaveLength(53);
    expect(new Set(CUSTOMER_CHARACTER_ASSET_IDS)).toHaveLength(53);
    for (const assetId of PRODUCTION_V003_CUSTOMER_ASSET_IDS) {
      const asset = PRODUCTION_V003_CHARACTER_ASSETS.find((candidate) => candidate.assetId === assetId)!;
      expect(asset.frameSize).toEqual([112, 168]);
      expect(asset.anchor).toEqual([56, 158]);
      expect(asset.orientations).toEqual(['sw', 'nw', 'ne', 'se']);
      expect(asset.animations).toMatchObject({ idle: 4, walk: 8, sit_down: 6, seated_idle: 4, eat: 8, drink: 8, stand_up: 6 });
    }
  });

  it('mapeia as 13 contratações para 12 profissões canônicas sem fallback genérico', () => {
    expect(Object.keys(PRODUCTION_V003_STAFF_ASSET_BY_DEFINITION_ID)).toHaveLength(13);
    expect(new Set(Object.values(PRODUCTION_V003_STAFF_ASSET_BY_DEFINITION_ID))).toHaveLength(12);
    expect(STAFF_CATALOG).toHaveLength(13);
    for (const staff of STAFF_CATALOG) expect(staff.assetId).toBe(PRODUCTION_V003_STAFF_ASSET_BY_DEFINITION_ID[staff.id as keyof typeof PRODUCTION_V003_STAFF_ASSET_BY_DEFINITION_ID]);
  });

  it('cobre os 15 móveis ativos em cinco níveis e 100 folhas renderizadas', () => {
    expect(PRODUCTION_V003_FURNITURE_SPECS).toHaveLength(15);
    expect(ACTIVE_PRODUCTION_V003_FURNITURE_IDS.size).toBe(15);
    expect(PRODUCTION_V003_FURNITURE_ASSETS).toHaveLength(100);
    expect(new Set(PRODUCTION_V003_FURNITURE_ASSETS.map((asset) => asset.assetId))).toHaveLength(100);
    expect(new Set(PRODUCTION_V003_FURNITURE_ASSETS.map((asset) => asset.gameplayLevel))).toEqual(new Set([1]));
    for (const spec of PRODUCTION_V003_FURNITURE_SPECS) {
      for (let level = 1; level <= 5; level += 1) {
        const id = productionFurnitureAssetId(spec.furnitureId, level);
        expect(id).toBeTruthy();
        expect(furnitureLevelAssetId(spec.furnitureId, level)).toBe(id);
      }
    }
    expect(productionFurnitureAssetId('service.c1.isolated', 3, 'middle')).toBe('v003_c1_service_middle_l3');
    expect(furnitureLevelAssetId('service.c3.middle', 3, 'middle')).toBe('v003_c1_service_middle_l3');
    expect(productionFurnitureAssetId('dining.chair.basic', 5, undefined, 'back')).toBe('v003_dining_chair_l5_back');
    expect(productionFurnitureAnchor([1, 1])).toEqual([.5, 174 / 192]);
    expect(productionFurnitureAnchor([2, 1])).toEqual([.5, 182 / 192]);
    for (const asset of PRODUCTION_V003_FURNITURE_ASSETS) {
      expect(asset.anchor).toEqual(productionFurnitureAnchor(asset.footprint as [number, number]));
    }
    expect(FURNITURE_LEVEL_UNLOCKS).toEqual([1, 8, 20, 40, 65]);
  });

  it('faz o upgrade como transação atômica, com custo, desbloqueio e teto', () => {
    const state = createDefaultState(0);
    state.coins = 100_000;
    const editor = new ConstructionEditor(state);
    expect(editor.purchase('cooking.a1.stove').ok).toBe(true);
    const source = editor.draft.construction.storedFurniture.find((item) => item.definitionId === 'cooking.a1.stove')!;
    const beforeCoins = editor.draft.coins;
    expect(editor.upgradeFurniture(source.id, 7).ok).toBe(false);
    expect(editor.draft.coins).toBe(beforeCoins);
    expect(editor.draft.construction.storedFurniture.find((item) => item.id === source.id)?.level).toBe(1);

    const cost = furnitureUpgradeCost(source.definitionId, 1)!;
    expect(editor.upgradeFurniture(source.id, 8)).toEqual({ ok: true });
    expect(editor.draft.coins).toBe(beforeCoins - cost);
    expect(editor.draft.construction.storedFurniture.find((item) => item.id === source.id)?.level).toBe(2);
    expect(state.coins).toBe(100_000);
    expect(state.construction.storedFurniture.find((item) => item.id === source.id)).toBeUndefined();
    expect(editor.confirmPurchases().ok).toBe(true);
    expect(state.coins).toBe(beforeCoins - cost);
    expect(state.construction.storedFurniture.find((item) => item.id === source.id)?.level).toBe(2);
  });

  it('preserva posição e orientação e impede qualquer avanço além do nível 5', () => {
    const state = createDefaultState(0);
    state.coins = 1_000_000;
    const editor = new ConstructionEditor(state);
    expect(editor.purchase('dining.table.basic').ok).toBe(true);
    const stored = editor.draft.construction.storedFurniture.find((item) => item.definitionId === 'dining.table.basic')!;
    expect(editor.place('dining.table.basic', 6, 7, 'ne', undefined, stored.id).ok).toBe(true);
    for (let level = 1; level < 5; level += 1) expect(editor.upgradeFurniture(stored.id, 100).ok).toBe(true);
    const upgraded = editor.draft.construction.placedFurniture.find((item) => item.id === stored.id)!;
    expect(upgraded).toMatchObject({ gridX: 6, gridY: 7, orientation: 'ne', level: 5 });
    const beforeRejectedUpgrade = editor.draft.coins;
    expect(editor.upgradeFurniture(stored.id, 100).ok).toBe(false);
    expect(editor.draft.coins).toBe(beforeRejectedUpgrade);
    expect(editor.draft.construction.placedFurniture.find((item) => item.id === stored.id)?.level).toBe(5);
  });

  it('preserva e saneia níveis visuais ao salvar e carregar', () => {
    expect(clampFurnitureLevel(undefined)).toBe(1);
    expect(clampFurnitureLevel(-10)).toBe(1);
    expect(clampFurnitureLevel(99)).toBe(MAX_FURNITURE_LEVEL);
    const raw = createDefaultState(0);
    raw.coins = 100_000;
    const editor = new ConstructionEditor(raw);
    expect(editor.purchase('cooking.a1.stove').ok).toBe(true);
    expect(editor.purchase('dining.chair.basic').ok).toBe(true);
    expect(editor.confirmPurchases().ok).toBe(true);
    raw.construction.storedFurniture[0].level = 99;
    raw.construction.storedFurniture[1].level = 0;
    const loaded = migrateAndSanitizeSave(structuredClone(raw), 1);
    expect(loaded.construction.storedFurniture.find((item) => item.id === raw.construction.storedFurniture[0].id)?.level).toBe(5);
    expect(loaded.construction.storedFurniture.find((item) => item.id === raw.construction.storedFurniture[1].id)?.level).toBe(1);
  });
});
