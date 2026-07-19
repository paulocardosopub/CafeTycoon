import type { GridPoint } from '../../core/types';
import type { RestaurantGrid } from '../grid/Grid';

const key = (point: GridPoint) => `${point.x},${point.y}`;
const distance = (a: GridPoint, b: GridPoint) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export function findPath(grid: RestaurantGrid, start: GridPoint, goal: GridPoint, actorId?: string): GridPoint[] {
  if (!grid.inBounds(start) || !grid.inBounds(goal)) return [];
  if (start.x === goal.x && start.y === goal.y) return [];

  const open: GridPoint[] = [{ ...start }];
  const cameFrom = new Map<string, GridPoint>();
  const gScore = new Map<string, number>([[key(start), 0]]);
  const fScore = new Map<string, number>([[key(start), distance(start, goal)]]);
  const closed = new Set<string>();

  while (open.length) {
    open.sort((a, b) => (fScore.get(key(a)) ?? Infinity) - (fScore.get(key(b)) ?? Infinity));
    const current = open.shift()!;
    const currentKey = key(current);
    if (current.x === goal.x && current.y === goal.y) {
      const path: GridPoint[] = [];
      let cursor = current;
      while (key(cursor) !== key(start)) {
        path.unshift(cursor);
        const previous = cameFrom.get(key(cursor));
        if (!previous) return [];
        cursor = previous;
      }
      return path;
    }
    closed.add(currentKey);

    const neighbors = [
      { x: current.x + 1, y: current.y }, { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 }, { x: current.x, y: current.y - 1 },
    ];
    for (const neighbor of neighbors) {
      const neighborKey = key(neighbor);
      const isGoal = neighbor.x === goal.x && neighbor.y === goal.y;
      if (closed.has(neighborKey) || (!isGoal && !grid.isWalkable(neighbor, actorId))) continue;
      const tentative = (gScore.get(currentKey) ?? Infinity) + 1;
      if (tentative < (gScore.get(neighborKey) ?? Infinity)) {
        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentative);
        fScore.set(neighborKey, tentative + distance(neighbor, goal));
        if (!open.some((point) => key(point) === neighborKey)) open.push(neighbor);
      }
    }
  }
  return [];
}
