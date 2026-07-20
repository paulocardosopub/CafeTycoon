import type { Direction, GridPoint } from '../../core/types';
import { facingBetween } from '../../assets/pixel/VisualMetrics';
import type { RestaurantGrid } from '../grid/Grid';

export interface TileMover {
  id: string;
  position: GridPoint;
  visual: GridPoint;
  path: GridPoint[];
  moveProgress: number;
  direction: Direction;
}

export interface MovementResult { moved: boolean; completedTile: boolean; blocked: boolean }

export function directionBetween(from: GridPoint, to: GridPoint, fallback: Direction = 'se'): Direction {
  return facingBetween(from, to, fallback);
}

export function advanceTileMover(grid: RestaurantGrid, mover: TileMover, deltaSeconds: number, blocksPerSecond: number): MovementResult {
  const target = mover.path[0];
  if (!target) {
    mover.visual = { ...mover.position };
    grid.releaseReservations(mover.id);
    return { moved: false, completedTile: false, blocked: false };
  }
  if (!grid.canEnter(target, mover.id) || !grid.reserve(target, mover.id)) {
    mover.visual = { ...mover.position };
    return { moved: false, completedTile: false, blocked: true };
  }
  mover.direction = directionBetween(mover.position, target, mover.direction);
  mover.moveProgress += Math.max(0, deltaSeconds) * blocksPerSecond;
  const amount = Math.min(1, mover.moveProgress);
  mover.visual = {
    x: mover.position.x + (target.x - mover.position.x) * amount,
    y: mover.position.y + (target.y - mover.position.y) * amount,
  };
  if (mover.moveProgress < 1) return { moved: true, completedTile: false, blocked: false };
  mover.position = { ...target };
  mover.visual = { ...target };
  mover.path.shift();
  mover.moveProgress = 0;
  grid.occupy(mover.position, mover.id);
  return { moved: true, completedTile: true, blocked: false };
}
