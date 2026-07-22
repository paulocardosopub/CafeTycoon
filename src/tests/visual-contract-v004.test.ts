import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEV_SKIN_SETS, REQUIRED_CHARACTER_ANIMATIONS, VISUAL_SKINS } from '../assets/pixel/manifest';
import { footprintContains, gridDeltaToFacing, VISUAL_METRICS } from '../assets/pixel/VisualMetrics';
import { STATIONS } from '../content/stations/stations';
import { createGraphicsSaveState, createTables } from '../game/map/initialMap';
import { CHARACTER_VARIANTS } from '../assets/pixel/PixelAtlasFactory';

describe('contrato visual central da 0.0.4', () => {
  it('mantém grade, zoom, frame e âncora de pés em uma fonte única', () => {
    expect(VISUAL_METRICS.isoTile).toEqual({ width: 64, height: 32 });
    expect(VISUAL_METRICS.zoomLevels).toEqual([.5, 1, 2]);
    expect(VISUAL_METRICS.character).toMatchObject({
      frame: { width: 96, height: 144 }, feetAnchor: { x: 48, y: 136 },
      logicalFootprint: { width: 1, depth: 1 }, expectedHeightBlocks: { min: 1.5, max: 2 },
    });
    expect(VISUAL_METRICS.depth.chairBack).toBeLessThan(VISUAL_METRICS.depth.seatedCharacter);
    expect(VISUAL_METRICS.depth.seatedCharacter).toBeLessThan(VISUAL_METRICS.depth.chairFront);
  });

  it('converte os quatro deltas de grade para a direção isométrica correta', () => {
    expect(gridDeltaToFacing(1, 0)).toBe('se');
    expect(gridDeltaToFacing(-1, 0)).toBe('nw');
    expect(gridDeltaToFacing(0, 1)).toBe('sw');
    expect(gridDeltaToFacing(0, -1)).toBe('ne');
    expect(gridDeltaToFacing(0, 0, 'nw')).toBe('nw');
  });

  it('declara todas as poses sem reutilizar caminhada como idle', () => {
    expect(Object.keys(REQUIRED_CHARACTER_ANIMATIONS)).toEqual(expect.arrayContaining([
      'idle', 'walk', 'sit-down', 'seated-idle', 'seated-waiting', 'seated-eating', 'stand-up',
      'carry-plate', 'carry-ingredients', 'cook', 'use-appliance', 'serve', 'clean', 'receive-payment',
    ]));
    expect(REQUIRED_CHARACTER_ANIMATIONS.walk.frames).toBe(6);
    expect(REQUIRED_CHARACTER_ANIMATIONS.idle.frames).toBeGreaterThan(0);
    expect(CHARACTER_VARIANTS.filter((variant) => variant.startsWith('customer-'))).toHaveLength(8);
  });

  it('mantém work slots fora dos footprints dos equipamentos', () => {
    for (const station of STATIONS) {
      const footprint = { width: station.size.x, depth: station.size.y };
      for (const point of [station.primaryWorkSlot, ...station.optionalWorkSlots]) {
        expect(footprintContains(station.position, footprint, point), `${station.id}:${point.x},${point.y}`).toBe(false);
      }
      expect(station.clearanceCells).toEqual(expect.arrayContaining(station.interactionPoints));
      expect(station.visualBounds.overhangCells).toBeLessThanOrEqual(VISUAL_METRICS.world.maxOverhangCells);
    }
  });

  it('usa três cadeiras estruturais e intercala assento entre suas camadas', () => {
    const seats = createTables().flatMap((table) => table.chairs);
    expect(new Set(seats.map((seat) => seat.visualSkinId))).toEqual(new Set(['chair-wood']));
    for (const seat of seats) {
      expect(Math.abs(seat.seatAnchor.x - seat.sitPoint.x)).toBeLessThanOrEqual(.281);
      expect(Math.abs(seat.seatAnchor.y - seat.sitPoint.y)).toBeLessThanOrEqual(.281);
      expect(seat.seatAnchor).toEqual(seat.visualPosition);
      expect(seat.seatAnchor).toEqual(seat.sitPoint);
      expect(seat.layerAssetIds.back).toMatch(/_back$/);
      expect(seat.layerAssetIds.front).toMatch(/_front$/);
      expect(seat.footprint).toEqual({ width: 1, depth: 1 });
    }
  });

  it('prepara skins trocáveis sem alterar footprint lógico', () => {
    expect(Object.values(VISUAL_SKINS).filter((skin) => skin.family === 'floor')).toHaveLength(2);
    expect(Object.values(VISUAL_SKINS).filter((skin) => skin.family === 'wall')).toHaveLength(2);
    expect(Object.values(VISUAL_SKINS).filter((skin) => skin.family === 'chair')).toHaveLength(3);
    expect(DEV_SKIN_SETS.bloom.floor).not.toBe(DEV_SKIN_SETS.sage.floor);
    const objects = createGraphicsSaveState().objects;
    expect(objects.every((item) => item.visualSkinId && item.visualBounds && Number.isFinite(item.depthOffset))).toBe(true);
  });

  it('mostra os sprites Blender definitivos no criador de personagem', () => {
    const creator = readFileSync(resolve(import.meta.dirname, '../ui/characterCreator.ts'), 'utf8');
    expect(creator).toContain('character-preview-sprite');
    expect(creator).toContain('/assets/pixel/rendered/thumbnails/player-style-${styleIndex}.png?v=0.0.6-blender-7');
    expect(creator).not.toContain('preview-legs"></div><div class="preview-body');
  });
});
