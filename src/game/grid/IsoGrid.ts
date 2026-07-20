import type { GridPoint } from '../../core/types';
import { depthAtBase, roundPixel, VISUAL_METRICS } from '../../assets/pixel/VisualMetrics';

export const ISO_TILE = VISUAL_METRICS.isoTile;
export interface IsoView { offsetX: number; offsetY: number; zoom: number }
const DEFAULT_VIEW: IsoView = { offsetX: 0, offsetY: 0, zoom: 1 };

/** Returns the exact world-space center/feet anchor of one logical cell. */
export function gridToWorld(point: GridPoint): GridPoint {
  return {
    x: (point.x - point.y) * ISO_TILE.width / 2,
    y: (point.x + point.y) * ISO_TILE.height / 2 + ISO_TILE.height / 2,
  };
}

export function worldToGrid(point: GridPoint): GridPoint {
  const centeredY = point.y - ISO_TILE.height / 2;
  return {
    x: Math.round(point.x / ISO_TILE.width + centeredY / ISO_TILE.height),
    y: Math.round(centeredY / ISO_TILE.height - point.x / ISO_TILE.width),
  };
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
