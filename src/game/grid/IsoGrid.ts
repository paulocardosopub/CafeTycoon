import type { GridPoint } from '../../core/types';
import { depthAtBase, roundPixel, VISUAL_METRICS } from '../../assets/pixel/VisualMetrics';
import { gridToWorld as spatialGridToWorld, worldToGrid as spatialWorldToGrid } from './SpatialLayoutService';

export const ISO_TILE = VISUAL_METRICS.isoTile;
export interface IsoView { offsetX: number; offsetY: number; zoom: number }
const DEFAULT_VIEW: IsoView = { offsetX: 0, offsetY: 0, zoom: 1 };

/** Returns the exact world-space center/feet anchor of one logical cell. */
export function gridToWorld(point: GridPoint): GridPoint {
  return spatialGridToWorld(point);
}

export function worldToGrid(point: GridPoint): GridPoint {
  return spatialWorldToGrid(point);
}

export function gridToScreen(point: GridPoint, view: IsoView = DEFAULT_VIEW): GridPoint {
  const world = gridToWorld(point);
  return { x: roundPixel((world.x - view.offsetX) * view.zoom), y: roundPixel((world.y - view.offsetY) * view.zoom) };
}

export function screenToGrid(point: GridPoint, view: IsoView = DEFAULT_VIEW): GridPoint {
  return worldToGrid({ x: point.x / view.zoom + view.offsetX, y: point.y / view.zoom + view.offsetY });
}

export function isoDepth(point: GridPoint, layer = 0): number {
  return depthAtBase(point, layer);
}
