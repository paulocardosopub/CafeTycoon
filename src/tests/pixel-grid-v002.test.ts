import { describe, expect, it } from 'vitest';
import { CHARACTER_DIRECTIONS, CHARACTER_FOOT_ANCHOR, REQUIRED_CHARACTER_ANIMATIONS, WORLD_ASSETS, characterFrame } from '../assets/pixel/manifest';
import { SAVE_SCHEMA_VERSION } from '../config/balance';
import type { GameState, GridPoint } from '../core/types';
import { RestaurantGrid } from '../game/grid/Grid';
import { gridToScreen, gridToWorld, isoDepth, screenToGrid, worldToGrid } from '../game/grid/IsoGrid';
import { createGraphicsSaveState, createInitialGrid, createStations, createTables } from '../game/map/initialMap';
import { findPath } from '../game/navigation/AStar';
import { advanceTileMover } from '../game/navigation/TileMovement';
import { createDefaultState } from '../game/save/defaultState';
import { migrateAndSanitizeSave } from '../game/save/migrations';
import { STATION_BY_ID } from '../content/stations/stations';

describe('grade isométrica 0.0.2', () => {
  it('converte grade, mundo e tela sem perder a célula lógica', () => {
    const points: GridPoint[] = [{ x: 0, y: 0 }, { x: 3, y: 9 }, { x: 17, y: 17 }, { x: 11, y: 4 }];
    for (const point of points) {
      expect(worldToGrid(gridToWorld(point))).toEqual(point);
      expect(screenToGrid(gridToScreen(point, { offsetX: -120, offsetY: 75, zoom: 2 }), { offsetX: -120, offsetY: 75, zoom: 2 })).toEqual(point);
    }
  });

  it('ordena pelos pés/base, não pelo centro visual', () => {
    expect(isoDepth({ x: 5, y: 7 }, 50)).toBeGreaterThan(isoDepth({ x: 5, y: 6 }, 99));
    expect(CHARACTER_FOOT_ANCHOR).toEqual({ x: 48, y: 136 });
  });
});

describe('movimento tile-to-tile e reservas', () => {
  it('reserva a próxima célula e termina exatamente no centro lógico', () => {
    const grid = new RestaurantGrid(4, 4);
    const mover = { id: 'actor-a', position: { x: 0, y: 0 }, visual: { x: 0, y: 0 }, path: [{ x: 1, y: 0 }], moveProgress: 0, direction: 'se' as const };
    grid.occupy(mover.position, mover.id);
    const halfway = advanceTileMover(grid, mover, .25, 2);
    expect(halfway.moved).toBe(true);
    expect(grid.get({ x: 1, y: 0 })?.reservedBy).toBe(mover.id);
    expect(mover.visual).toEqual({ x: .5, y: 0 });
    const arrived = advanceTileMover(grid, mover, .25, 2);
    expect(arrived.completedTile).toBe(true);
    expect(mover.position).toEqual({ x: 1, y: 0 });
    expect(mover.visual).toEqual({ x: 1, y: 0 });
    expect(grid.get({ x: 1, y: 0 })?.occupiedBy).toBe(mover.id);
    expect(grid.get({ x: 1, y: 0 })?.reservedBy).toBeUndefined();
  });

  it('impede duas pessoas de reservar a mesma célula', () => {
    const grid = new RestaurantGrid(3, 3);
    expect(grid.reserve({ x: 1, y: 1 }, 'a')).toBe(true);
    expect(grid.reserve({ x: 1, y: 1 }, 'b')).toBe(false);
    grid.releaseReservations('a');
    expect(grid.reserve({ x: 1, y: 1 }, 'b')).toBe(true);
  });

  it('não cria caminho para dentro de um móvel bloqueado', () => {
    const grid = new RestaurantGrid(3, 3);
    grid.set({ x: 2, y: 2 }, { walkable: false, kind: 'blocked' });
    expect(findPath(grid, { x: 0, y: 0 }, { x: 2, y: 2 })).toEqual([]);
  });
});

describe('footprints e frentes', () => {
  it('usa 3 células na mesa de 2 e 5 na mesa de 4', () => {
    const tables = createTables();
    expect(tables).toHaveLength(1);
    expect(tables[0].maxCustomers).toBe(2);
    expect(tables[0].occupiedCells).toHaveLength(3);
    expect(tables.every((table) => table.size.x === 1 && table.size.y === 1)).toBe(true);
  });

  it('mantém todas as cadeiras viradas para a mesa associada', () => {
    for (const table of createTables()) {
      for (const chair of table.chairs) {
        expect(chair.tableId).toBe(table.id);
        if (chair.position.x < table.position.x) expect(chair.orientation).toBe('se');
        if (chair.position.x > table.position.x) expect(chair.orientation).toBe('nw');
        if (chair.position.y < table.position.y) expect(chair.orientation).toBe('sw');
        if (chair.position.y > table.position.y) expect(chair.orientation).toBe('ne');
      }
    }
  });

  it('declara fogão, forno e geladeira em 2×1 e com frente livre', () => {
    for (const id of ['stove', 'oven', 'fridge'] as const) {
      const station = STATION_BY_ID[id];
      expect(station.size).toEqual({ x: 2, y: 1 });
      expect(station.interactionPoints).toContainEqual(station.interaction);
      expect(station.front).toBe('sw');
      expect(station.blocksMovement).toBe(true);
    }
  });

  it('separa os pontos do cozinheiro e do garçom no balcão', () => {
    const stations = createStations();
    const pickup = stations.find((station) => station.id === 'pickup')!;
    expect(pickup.size).toEqual({ x: 1, y: 1 });
    expect(pickup.interactionPoints).toContainEqual(pickup.primaryWorkSlot);
    expect(pickup.interactionPoints).toContainEqual(pickup.serviceInteraction);
    expect(pickup.primaryWorkSlot.y).toBeLessThan(pickup.position.y);
    expect(pickup.serviceInteraction!.y).toBeGreaterThan(pickup.position.y);
    expect(createInitialGrid(createTables(), stations).get(pickup.position)?.walkable).toBe(false);
  });
});

describe('save e atlas 0.0.2', () => {
  it('migra o save 0.0.1 e preserva recursos', () => {
    const { graphics: _graphics, ...legacy } = createDefaultState(10);
    legacy.schemaVersion = 1;
    legacy.gameVersion = '0.0.1';
    legacy.coins = 777;
    const migrated = migrateAndSanitizeSave(legacy as GameState, 20);
    expect(migrated.coins).toBe(777);
    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated.graphics.dataVersion).toBe(2);
    expect(migrated.graphics.objects.length).toBe(createGraphicsSaveState().objects.length);
  });

  it('possui todas as direções e animações obrigatórias no manifesto', () => {
    expect(CHARACTER_DIRECTIONS).toEqual(['ne', 'nw', 'se', 'sw']);
    expect(REQUIRED_CHARACTER_ANIMATIONS.walk.frames).toBe(6);
    for (const animation of ['idle', 'walk', 'carry-plate', 'carry-ingredients', 'cook', 'sit-down', 'seated-idle', 'seated-eating'] as const) {
      for (const direction of CHARACTER_DIRECTIONS) expect(characterFrame('player', animation, direction, 0)).toContain(`/${animation}/${direction}/0`);
    }
    expect(WORLD_ASSETS.stove.footprint).toEqual({ width: 2, depth: 1 });
    expect(WORLD_ASSETS.fridge.footprint).toEqual({ width: 2, depth: 1 });
    expect(WORLD_ASSETS.oven.footprint).toEqual({ width: 2, depth: 1 });
  });
});
