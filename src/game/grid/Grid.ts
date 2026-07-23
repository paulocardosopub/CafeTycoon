import type { GridPoint } from '../../core/types';

export type TileKind = 'floor' | 'wall' | 'entrance' | 'exit' | 'blocked' | 'outside';
export interface GridCell {
  kind: TileKind;
  walkable: boolean;
  occupiedBy?: string;
  reservedFor?: string;
  reservedBy?: string;
  stationPart?: string;
  furniturePart?: string;
}

export class RestaurantGrid {
  readonly cells: GridCell[][];
  private readonly occupiedCellByActor = new Map<string, GridPoint>();
  private readonly reservedCellByActor = new Map<string, GridPoint>();

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
    return Boolean(cell?.walkable && (!cell.occupiedBy || cell.occupiedBy === ignoreOccupant) && (!cell.reservedBy || cell.reservedBy === ignoreOccupant));
  }

  canEnter(point: GridPoint, actorId: string): boolean { return this.isWalkable(point, actorId); }

  reserve(point: GridPoint, actorId: string): boolean {
    const cell = this.get(point);
    if (!cell || !this.canEnter(point, actorId)) return false;
    this.releaseReservations(actorId);
    cell.reservedBy = actorId;
    this.reservedCellByActor.set(actorId, { ...point });
    return true;
  }

  releaseReservations(actorId: string): void {
    const point = this.reservedCellByActor.get(actorId);
    const cell = point ? this.get(point) : undefined;
    if (cell?.reservedBy === actorId) cell.reservedBy = undefined;
    this.reservedCellByActor.delete(actorId);
  }

  occupy(point: GridPoint, actorId: string): boolean {
    const target = this.get(point);
    if (!target?.walkable || (target.occupiedBy && target.occupiedBy !== actorId) || (target.reservedBy && target.reservedBy !== actorId)) return false;
    this.vacate(actorId);
    this.releaseReservations(actorId);
    target.occupiedBy = actorId;
    this.occupiedCellByActor.set(actorId, { ...point });
    return true;
  }

  vacate(actorId: string): void {
    const point = this.occupiedCellByActor.get(actorId);
    const cell = point ? this.get(point) : undefined;
    if (cell?.occupiedBy === actorId) cell.occupiedBy = undefined;
    this.occupiedCellByActor.delete(actorId);
    this.releaseReservations(actorId);
  }

  clone(): RestaurantGrid {
    const copy = new RestaurantGrid(this.width, this.height);
    this.cells.forEach((row, y) => row.forEach((cell, x) => {
      copy.cells[y][x] = { ...cell };
      if (cell.occupiedBy) copy.occupiedCellByActor.set(cell.occupiedBy, { x, y });
      if (cell.reservedBy) copy.reservedCellByActor.set(cell.reservedBy, { x, y });
    }));
    return copy;
  }
}
