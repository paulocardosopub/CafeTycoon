import { describe, expect, it } from 'vitest';
import { createInitialGrid, createStations, createTablesFromConstruction, seatFacingTowardTable } from '../game/map/initialMap';
import { validateRestaurantMap } from '../game/map/validateMap';
import { characterMotionState } from '../game/systems/animation/CharacterAnimationState';
import { depthAtBase, footprintDepthPoint, VISUAL_METRICS } from '../assets/pixel/VisualMetrics';
import { createDefaultState } from '../game/save/defaultState';
import { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';

describe('regressões visuais de assento e movimento da 0.0.5', () => {
  it('vira cada cadeira para a mesa pelas coordenadas atuais', () => {
    const table = { x: 8, y: 8 };
    expect(seatFacingTowardTable({ x: 7, y: 8 }, table)).toBe('se');
    expect(seatFacingTowardTable({ x: 9, y: 8 }, table)).toBe('nw');
    expect(seatFacingTowardTable({ x: 8, y: 7 }, table)).toBe('sw');
    expect(seatFacingTowardTable({ x: 8, y: 9 }, table)).toBe('ne');
  });

  it('mantém mesa com quatro cadeiras acessível por um ponto livre do atendente', () => {
    const state = createDefaultState(0);
    const table = state.construction.placedFurniture.find((item) => item.definitionId === 'dining.table.basic')!;
    const extra = [
      { id: 'chair:north', x: table.gridX, y: table.gridY - 1 },
      { id: 'chair:south', x: table.gridX, y: table.gridY + 1 },
    ];
    state.construction.placedFurniture.push(...extra.map((entry) => ({ id: entry.id, definitionId: 'dining.chair.basic', gridX: entry.x, gridY: entry.y, orientation: 'sw' as const, skinId: 'chair-wood', level: 1, state: { linkedTableId: table.id } })));
    const tables = createTablesFromConstruction(state.construction);
    const stations = createStations(state.construction);
    const grid = createInitialGrid(tables, stations, state.construction);
    expect(validateRestaurantMap(grid, tables, stations).valid).toBe(true);
    expect(tables[0].accessible).toBe(true);
    expect(tables[0].chairs).toHaveLength(4);
    expect(new Set(tables[0].chairs.map((chair) => `${chair.servicePoint.x},${chair.servicePoint.y}`)).size).toBe(4);
    expect(tables[0].chairs.every((chair) => chair.servicePoint.x !== chair.approach.x || chair.servicePoint.y !== chair.approach.y)).toBe(true);
  });

  it('troca explicitamente entre walk e idle e para ao bloquear ou chegar', () => {
    expect(characterMotionState({ pathStatus: 'moving' })).toBe('walk');
    expect(characterMotionState({ pathStatus: 'arrived' })).toBe('idle');
    expect(characterMotionState({ pathStatus: 'blocked' })).toBe('idle');
    expect(characterMotionState({ pathStatus: 'no_path' })).toBe('idle');
    expect(characterMotionState({ pathStatus: 'idle' })).toBe('idle');
    expect(characterMotionState({ pathStatus: 'moving', motionState: 'idle' })).toBe('idle');
    expect(characterMotionState({ pathStatus: 'arrived', motionState: 'walk' })).toBe('walk');
  });

  it('ordena o móvel pelo centro do footprint e mantém visível quem está à frente', () => {
    const furniture = footprintDepthPoint({ x: 5, y: 7 }, { width: 6, depth: 1 });
    const characterInFront = { x: 7, y: 8 };
    expect(depthAtBase(characterInFront, VISUAL_METRICS.depth.standingCharacter))
      .toBeGreaterThan(depthAtBase(furniture, VISUAL_METRICS.depth.furnitureBase));
  });

  it('não deixa uma operação antiga restaurar o balcão legado 6x1', () => {
    const state = createDefaultState(1_000);
    const original = new RestaurantSimulation(state);
    const operation = original.prepareSave(2_000);
    const oldPickup = operation.stations.find((item) => item.id === 'pickup')!;
    Object.assign(oldPickup, {
      position: { x: 5, y: 7 }, size: { x: 6, y: 1 }, renderedAssetId: 'pickup_counter_level_1',
    });
    state.operation = operation;

    const restoredPickup = new RestaurantSimulation(state).stations.find((item) => item.id === 'pickup')!;
    expect(restoredPickup.size).toEqual({ x: 1, y: 1 });
    expect(restoredPickup.position).toEqual({ x: 8, y: 6 });
    expect(restoredPickup.renderedAssetId).toBe('c1_service_isolated');
  });
});
