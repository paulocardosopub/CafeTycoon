import type { ConstructionSaveState, Direction, PlacedFurniture, ServiceCounterModule } from '../../core/types';
import { modulesFromFurniture } from '../systems/service-counter/ServiceCounterSystem';
import { FURNITURE_BY_ID } from '../data/furniture/catalog';
import { getRotatedFootprint, getSpriteAnchor, getVisualScale } from '../grid/SpatialLayoutService';

export const MOVABLE_DECORATION_MIGRATION = 'Plantas e lixeira fixas convertidas em mÃ³veis editÃ¡veis.';

const placed = (id: string, definitionId: string, gridX: number, gridY: number, orientation: Direction = 'sw', skinId = 'steel-standard', state: Record<string, unknown> = {}): PlacedFurniture => {
  const definition = FURNITURE_BY_ID[definitionId];
  return {
    id, definitionId, gridX, gridY, orientation, skinId, level: 1, state,
    footprint: getRotatedFootprint(definition, orientation), anchor: getSpriteAnchor(definition), visualScale: getVisualScale(definition),
    heightCategory: definition.heightCategory, workSlotIds: definition.workSlots.map((slot) => slot.id),
    seatSlotIds: definition.functionId === 'chair' ? [`${id}:seat`] : [], approachSlotIds: definition.functionId === 'chair' ? [`${id}:approach`] : [],
  };
};

export function createInitialConstructionState(): ConstructionSaveState {
  const placedFurniture: PlacedFurniture[] = [];
  const serviceCounters: ServiceCounterModule[] = [];
  return {
    dataVersion: 1,
    placedFurniture,
    storedFurniture: [],
    serviceCounters,
    builtAreas: [{ id: 'area:base', x: 0, y: 0, width: 18, depth: 18, kind: 'base' }],
    floorSkinId: 'floor-terracotta',
    wallSkinId: 'wall-cream-green',
    doorSkinId: 'door-green',
    windowSkinId: 'window-green',
    staffStartPositions: [{ staffId: 'player', gridX: 9, gridY: 14, facing: 'ne', returnWhenIdle: true }],
    migrationLog: [MOVABLE_DECORATION_MIGRATION],
  };
}
