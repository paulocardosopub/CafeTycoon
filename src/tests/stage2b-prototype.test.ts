import { describe, expect, it } from 'vitest';
import { STAGE_2B_FURNITURE_ASSETS, STAGE_2B_PLAYER_ASSET, STAGE_2B_RENDERED_ASSETS } from '../assets/pixel/stage2bPrototypeManifest';
import type { Direction, PlacedFurniture } from '../core/types';
import { FURNITURE_BY_ID } from '../game/data/furniture/catalog';
import { createInitialConstructionState } from '../game/map/initialConstruction';
import { createStations } from '../game/map/initialMap';
import { createDefaultState } from '../game/save/defaultState';
import { migrateAndSanitizeSave } from '../game/save/migrations';
import { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';
import { occupiedCells, orientedFootprint, resolvedWorkSlots } from '../game/systems/furniture/FurniturePlacement';

const placed = (id: string, definitionId: string, gridX: number, orientation: Direction): PlacedFurniture => ({
  id, definitionId, gridX, gridY: 8, orientation, skinId: 'steel-standard', level: 1, state: {},
});

describe('0.0.7 etapa 2B — contrato 1×1 e protótipo masculino', () => {
  it.each(['sw', 'se', 'ne', 'nw'] as Direction[])('pia e fogão ocupam uma célula em %s', (orientation) => {
    for (const id of ['cooking.a1.stove', 'washing.b5.sink']) {
      const definition = FURNITURE_BY_ID[id];
      expect(orientedFootprint(definition, orientation)).toEqual({ width: 1, depth: 1 });
      expect(occupiedCells(placed(id, id, 5, orientation))).toHaveLength(1);
      expect(resolvedWorkSlots(placed(id, id, 5, orientation), definition)).toHaveLength(1);
    }
  });

  it('preserva identidade, função e preço dos móveis corrigidos', () => {
    expect(FURNITURE_BY_ID['cooking.a1.stove']).toMatchObject({ code: 'A1', price: 260, functionId: 'stove' });
    expect(FURNITURE_BY_ID['washing.b5.sink']).toMatchObject({ code: 'B5', price: 130, functionId: 'sink' });
  });

  it('permite sequência contínua bancada | pia | bancada | fogão | bancada', () => {
    const sequence = [
      placed('counter:a', 'preparation.b3.counter', 2, 'sw'),
      placed('sink', 'washing.b5.sink', 3, 'sw'),
      placed('counter:b', 'preparation.b3.counter', 4, 'sw'),
      placed('stove', 'cooking.a1.stove', 5, 'sw'),
      placed('counter:c', 'preparation.b3.counter', 6, 'sw'),
    ];
    const keys = sequence.flatMap((item) => occupiedCells(item).map((cell) => `${cell.x},${cell.y}`));
    expect(new Set(keys).size).toBe(5);
  });

  it('gera estações reais 1×1 com um slot e migração idempotente', () => {
    const construction = createInitialConstructionState();
    const stations = createStations(construction);
    expect(stations.find((station) => station.id === 'stove')).toMatchObject({ size: { x: 1, y: 1 } });
    expect(stations.find((station) => station.id === 'sink')).toMatchObject({ size: { x: 1, y: 1 } });
    const once = migrateAndSanitizeSave(createDefaultState(0));
    const twice = migrateAndSanitizeSave(once);
    expect(twice.construction.placedFurniture).toEqual(once.construction.placedFurniture);
  });

  it('mantem a mesma escala e ancora para a pia no restaurante e na edicao', () => {
    const sinkDefinition = FURNITURE_BY_ID['washing.b5.sink'];
    const sinkStation = createStations(createInitialConstructionState()).find((station) => station.id === 'sink');
    expect(sinkDefinition.baseAnchor).toEqual({ x: .5, y: 174 / 192 });
    expect(sinkStation?.visualScale).toBe(sinkDefinition.visualScale);
    expect(sinkStation?.anchor).toEqual(sinkDefinition.baseAnchor);
  });

  it('descarta a escala antiga da pia gravada no save operacional', () => {
    const state = createDefaultState(0);
    const source = new RestaurantSimulation(state);
    const operation = source.prepareSave(10);
    const savedSink = operation.stations.find((station) => station.id === 'sink')!;
    savedSink.visualScale = .55;
    savedSink.heightCategory = 'LOW';
    state.operation = operation;
    const restoredSink = new RestaurantSimulation(state).stations.find((station) => station.id === 'sink')!;
    expect(restoredSink.visualScale).toBe(FURNITURE_BY_ID['washing.b5.sink'].visualScale);
    expect(restoredSink.heightCategory).toBe(FURNITURE_BY_ID['washing.b5.sink'].heightCategory);
  });

  it('expõe somente o masculino nesta etapa com ações reais do protótipo', () => {
    expect(STAGE_2B_RENDERED_ASSETS.filter((asset) => asset.kind === 'character')).toEqual([STAGE_2B_PLAYER_ASSET]);
    expect(STAGE_2B_PLAYER_ASSET.animations).toEqual({ idle: 4, walk: 8, turn: 6, prep_counter: 8 });
    expect(STAGE_2B_PLAYER_ASSET.sourceBlend).toContain('c3_br_player_male_rig_stage_2b.blend');
    expect(STAGE_2B_PLAYER_ASSET.nativeScale).toBe(.72);
  });

  it('troca o pacote aprovado inteiro e mantém cadeira em duas camadas', () => {
    expect(STAGE_2B_FURNITURE_ASSETS).toHaveLength(26);
    expect(STAGE_2B_FURNITURE_ASSETS.every((asset) => asset.renderVersion.includes('exact-tile-v4'))).toBe(true);
    expect(STAGE_2B_FURNITURE_ASSETS.every((asset) => asset.footprint[0] === 1 && asset.footprint[1] === 1)).toBe(true);
    expect(STAGE_2B_FURNITURE_ASSETS.every((asset) => asset.anchor[1] === 174 / 192)).toBe(true);
    expect(FURNITURE_BY_ID['dining.table.basic']).toMatchObject({ footprintWidth: 1, footprintDepth: 1, visualScale: 1 });
    expect(FURNITURE_BY_ID['dining.chair.basic']).toMatchObject({ footprintWidth: 1, footprintDepth: 1, visualScale: .93 });
    expect(STAGE_2B_FURNITURE_ASSETS.find((asset) => asset.assetId === 'chair_wood_back')?.layerRole).toBe('back');
    expect(STAGE_2B_FURNITURE_ASSETS.find((asset) => asset.assetId === 'chair_wood_front')?.layerRole).toBe('front');
    expect(STAGE_2B_FURNITURE_ASSETS.find((asset) => asset.assetId === 'table_two')).toBeDefined();
    expect(STAGE_2B_FURNITURE_ASSETS.find((asset) => asset.assetId === 'plant')?.footprint).toEqual([1, 1]);
    expect(STAGE_2B_FURNITURE_ASSETS.find((asset) => asset.assetId === 'c8_waste_recycling')?.visualBounds?.widthCells).toBe(1);
  });
});
