import type { GridPoint } from '../../core/types';

export type TileKind = 'floor' | 'wall' | 'entrance' | 'exit' | 'blocked' | 'outside';
export interface GridCell {
  kind: TileKind;
  walkable: boolean;
  occupiedBy?: string;
  reservedFor?: string;
  stationPart?: string;
  furniturePart?: string;
}

export class RestaurantGrid {
  readonly cells: GridCell[][];

  constructor(public readonly width: number, public readonly height: number) {
    this.cells = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => ({ kind: 'floor' as const, walkable: true })),
    );
  }

  inBounds(point: GridPoint): boolean {
    return point.x >= 0 && point.y >= 0 && point.x < this.width && point.y < this.height;
  }

  get(point: GridPoint): GridCell | undefined {
    return this.inBounds(point) ? this.cells[point.y][point.x] : undefined;
  }

  set(point: GridPoint, patch: Partial<GridCell>): void {
    const cell = this.get(point);
    if (cell) Object.assign(cell, patch);
  }

  setRect(origin: GridPoint, size: GridPoint, patch: Partial<GridCell>): void {
    for (let y = origin.y; y < origin.y + size.y; y += 1) {
      for (let x = origin.x; x < origin.x + size.x; x += 1) this.set({ x, y }, patch);
    }
  }

  isWalkable(point: GridPoint, ignoreOccupant?: string): boolean {
    const cell = this.get(point);
    return Boolean(cell?.walkable && (!cell.occupiedBy || cell.occupiedBy === ignoreOccupant));
  }

  occupy(point: GridPoint, actorId?: string): void {
    for (const row of this.cells) {
      for (const cell of row) if (cell.occupiedBy === actorId) cell.occupiedBy = undefined;
    }
    if (actorId) this.set(point, { occupiedBy: actorId });
  }

  clone(): RestaurantGrid {
    const copy = new RestaurantGrid(this.width, this.height);
    this.cells.forEach((row, y) => row.forEach((cell, x) => { copy.cells[y][x] = { ...cell }; }));
    return copy;
  }
}
