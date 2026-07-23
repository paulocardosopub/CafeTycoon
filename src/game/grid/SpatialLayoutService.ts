import type {
  BuiltAreaRect, Direction, FurnitureDefinition, FurnitureHeightCategory, GridPoint, PlacedFurniture,
} from '../../core/types';
import { depthAtBase, VISUAL_METRICS } from '../../assets/pixel/VisualMetrics';

export const FURNITURE_VISUAL_METRICS = {
  tileBaseWidth: VISUAL_METRICS.isoTile.width,
  tileBaseDepth: VISUAL_METRICS.isoTile.height,
  lowFurnitureHeight: 0.9,
  standardCounterHeight: 1.65,
  tallFurnitureHeight: 2.35,
  maxAllowedVisualOverflow: VISUAL_METRICS.world.maxOverhangCells,
  // Os renders foram produzidos sobre a mesma base de 64 px. Escala 1 mantém
  // balcões baixos, geladeiras e módulos de serviço apoiados no mesmo tile;
  // exceções de enquadramento do arquivo-fonte ficam declaradas no catálogo.
  categoryScale: { LOW: 1, STANDARD_COUNTER: 1, TALL: 1 } as Record<FurnitureHeightCategory, number>,
} as const;

const ROTATION_ORDER: Direction[] = ['sw', 'se', 'ne', 'nw'];

export function snapToGrid(point: GridPoint): GridPoint {
  return { x: Math.round(point.x), y: Math.round(point.y) };
}

export function gridToWorld(point: GridPoint): GridPoint {
  const snapped = point;
  return {
    x: (snapped.x - snapped.y) * FURNITURE_VISUAL_METRICS.tileBaseWidth / 2,
    y: (snapped.x + snapped.y) * FURNITURE_VISUAL_METRICS.tileBaseDepth / 2 + FURNITURE_VISUAL_METRICS.tileBaseDepth / 2,
  };
}

export function worldToGrid(point: GridPoint): GridPoint {
  const centeredY = point.y - FURNITURE_VISUAL_METRICS.tileBaseDepth / 2;
  return snapToGrid({
    x: point.x / FURNITURE_VISUAL_METRICS.tileBaseWidth + centeredY / FURNITURE_VISUAL_METRICS.tileBaseDepth,
    y: centeredY / FURNITURE_VISUAL_METRICS.tileBaseDepth - point.x / FURNITURE_VISUAL_METRICS.tileBaseWidth,
  });
}

export function orientationTurns(orientation: Direction): number {
  return ROTATION_ORDER.indexOf(orientation);
}

export function getRotatedFootprint(definition: FurnitureDefinition, orientation: Direction): { width: number; depth: number } {
  return orientationTurns(orientation) % 2
    ? { width: definition.footprintDepth, depth: definition.footprintWidth }
    : { width: definition.footprintWidth, depth: definition.footprintDepth };
}

export function getFootprintCells(origin: GridPoint, footprint: { width: number; depth: number }): GridPoint[] {
  const cells: GridPoint[] = [];
  for (let y = 0; y < footprint.depth; y += 1) for (let x = 0; x < footprint.width; x += 1) cells.push({ x: origin.x + x, y: origin.y + y });
  return cells;
}

export function getFootprintCenter(origin: GridPoint, footprint: { width: number; depth: number }): GridPoint {
  return { x: origin.x + (footprint.width - 1) / 2, y: origin.y + (footprint.depth - 1) / 2 };
}

/**
 * Âncora visual no vértice inferior do losango ocupado pelo móvel.
 * Os renders usam o último pixel opaco como contato com o chão; prendê-lo ao
 * centro do tile deixa pés e rodízios visualmente suspensos meia célula acima.
 */
export function getFootprintFloorAnchorWorld(origin: GridPoint, footprint: { width: number; depth: number }): GridPoint {
  const center = gridToWorld(getFootprintCenter(origin, footprint));
  const bottomHalfHeight = (footprint.width + footprint.depth) * FURNITURE_VISUAL_METRICS.tileBaseDepth / 4;
  return { x: center.x, y: center.y + bottomHalfHeight };
}

export function getSpriteAnchor(definition: FurnitureDefinition): GridPoint {
  return { ...definition.baseAnchor };
}

export function getVisualScale(definition: FurnitureDefinition): number {
  return definition.visualScale || FURNITURE_VISUAL_METRICS.categoryScale[definition.heightCategory];
}

export function getVisualBounds(item: PlacedFurniture, definition: FurnitureDefinition) {
  const footprint = getRotatedFootprint(definition, item.orientation);
  const center = getFootprintCenter({ x: item.gridX, y: item.gridY }, footprint);
  const base = getFootprintFloorAnchorWorld({ x: item.gridX, y: item.gridY }, footprint);
  const heightBlocks = definition.heightCategory === 'TALL'
    ? FURNITURE_VISUAL_METRICS.tallFurnitureHeight
    : definition.heightCategory === 'LOW'
      ? FURNITURE_VISUAL_METRICS.lowFurnitureHeight
      : FURNITURE_VISUAL_METRICS.standardCounterHeight;
  return { base, center, footprint, heightPixels: heightBlocks * FURNITURE_VISUAL_METRICS.tileBaseDepth, scale: getVisualScale(definition) };
}

export function getDepthOrder(item: PlacedFurniture, definition: FurnitureDefinition, layer = VISUAL_METRICS.depth.furnitureBase): number {
  return depthAtBase(getFootprintCenter({ x: item.gridX, y: item.gridY }, getRotatedFootprint(definition, item.orientation)), layer);
}

export function rotateOffset(point: GridPoint, width: number, depth: number, orientation: Direction): GridPoint {
  const turns = orientationTurns(orientation);
  // Visual clockwise rotation SW -> SE moves the front from +Y to +X in
  // isometric grid coordinates. These formulas therefore mirror the usual
  // Cartesian turn so WorkSlots remain on the rendered front of the asset.
  if (turns === 1) return { x: point.y, y: width - 1 - point.x };
  if (turns === 2) return { x: width - 1 - point.x, y: depth - 1 - point.y };
  if (turns === 3) return { x: depth - 1 - point.y, y: point.x };
  return { ...point };
}

export function getAttachedChairCells(table: PlacedFurniture, furniture: readonly PlacedFurniture[]): GridPoint[] {
  return furniture.filter((item) => item.state.linkedTableId === table.id).map((item) => ({ x: item.gridX, y: item.gridY }));
}

export function getWorkSlotCells(item: PlacedFurniture, definition: FurnitureDefinition): GridPoint[] {
  return definition.workSlots.map((slot) => {
    const offset = rotateOffset(slot.offset, definition.footprintWidth, definition.footprintDepth, item.orientation);
    return { x: item.gridX + offset.x, y: item.gridY + offset.y };
  });
}

export function canPlaceAt(
  item: PlacedFurniture,
  definition: FurnitureDefinition,
  occupied: readonly GridPoint[],
  builtAreas: readonly BuiltAreaRect[],
): boolean {
  if (!isIntegerGridPosition(item)) return false;
  const occupiedKeys = new Set(occupied.map((cell) => `${cell.x},${cell.y}`));
  return getFootprintCells({ x: item.gridX, y: item.gridY }, getRotatedFootprint(definition, item.orientation)).every((cell) =>
    builtAreas.some((area) => cell.x >= area.x && cell.y >= area.y && cell.x < area.x + area.width && cell.y < area.y + area.depth)
      && !occupiedKeys.has(`${cell.x},${cell.y}`));
}

export function getSeatSlotCells(table: PlacedFurniture, furniture: readonly PlacedFurniture[]): GridPoint[] {
  return getAttachedChairCells(table, furniture);
}

export function getApproachSlotCells(table: PlacedFurniture, furniture: readonly PlacedFurniture[]): GridPoint[] {
  return getAttachedChairCells(table, furniture).map((chair) => ({
    x: chair.x + Math.sign(chair.x - table.gridX),
    y: chair.y + Math.sign(chair.y - table.gridY),
  }));
}

export function isIntegerGridPosition(item: Pick<PlacedFurniture, 'gridX' | 'gridY'>): boolean {
  return Number.isInteger(item.gridX) && Number.isInteger(item.gridY);
}
