import type {
  BuiltAreaRect, Direction, FurnitureDefinition, FurnitureWorkSlot, GridPoint, PlacedFurniture,
} from '../../../core/types';
import { FURNITURE_BY_ID } from '../../data/furniture/catalog';
import {
  getFootprintCells, getFootprintCenter, getRotatedFootprint, getSpriteAnchor, getVisualBounds,
  gridToWorld, orientationTurns as spatialOrientationTurns, rotateOffset as spatialRotateOffset, snapToGrid, worldToGrid,
} from '../../grid/SpatialLayoutService';

const ROTATION_ORDER: Direction[] = ['sw', 'se', 'ne', 'nw'];

export interface ResolvedWorkSlot extends FurnitureWorkSlot {
  point: GridPoint;
  facing: Direction;
}

export interface PlacementValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  occupiedCells: GridPoint[];
  workSlots: ResolvedWorkSlot[];
}

export function orientationTurns(orientation: Direction): number {
  return spatialOrientationTurns(orientation);
}

export function rotateDirection(direction: Direction, turns: number): Direction {
  const index = ROTATION_ORDER.indexOf(direction);
  return ROTATION_ORDER[(index + turns + 4) % 4];
}

export function orientedFootprint(definition: FurnitureDefinition, orientation: Direction): { width: number; depth: number } {
  return getRotatedFootprint(definition, orientation);
}

export function rotateOffset(point: GridPoint, definition: FurnitureDefinition, orientation: Direction): GridPoint {
  return spatialRotateOffset(point, definition.footprintWidth, definition.footprintDepth, orientation);
}

export { getFootprintCells, getFootprintCenter, getSpriteAnchor, getVisualBounds, gridToWorld, snapToGrid, worldToGrid };

export function occupiedCells(item: PlacedFurniture, definition = FURNITURE_BY_ID[item.definitionId]): GridPoint[] {
  if (!definition) return [];
  return definition.collisionCells.map((cell) => {
    const offset = rotateOffset(cell, definition, item.orientation);
    return { x: item.gridX + offset.x, y: item.gridY + offset.y };
  });
}

export function resolvedWorkSlots(item: PlacedFurniture, definition = FURNITURE_BY_ID[item.definitionId]): ResolvedWorkSlot[] {
  if (!definition) return [];
  const turns = orientationTurns(item.orientation);
  return definition.workSlots.map((slot) => {
    const offset = rotateOffset(slot.offset, definition, item.orientation);
    return { ...slot, point: { x: item.gridX + offset.x, y: item.gridY + offset.y }, facing: rotateDirection(slot.facing, turns) };
  });
}

export function cellInBuiltArea(point: GridPoint, areas: readonly BuiltAreaRect[]): boolean {
  return areas.some((area) => point.x >= area.x && point.y >= area.y && point.x < area.x + area.width && point.y < area.y + area.depth);
}

export function validateFurniturePlacement(
  candidate: PlacedFurniture,
  furniture: readonly PlacedFurniture[],
  builtAreas: readonly BuiltAreaRect[],
  entrance: GridPoint = { x: 9, y: 17 },
): PlacementValidation {
  const definition = FURNITURE_BY_ID[candidate.definitionId];
  if (!definition) return { valid: false, errors: [`Definição ausente: ${candidate.definitionId}`], warnings: [], occupiedCells: [], workSlots: [] };
  if (!definition.allowedOrientations.includes(candidate.orientation)) return { valid: false, errors: ['Orientação não permitida.'], warnings: [], occupiedCells: [], workSlots: [] };
  const cells = occupiedCells(candidate, definition);
  const slots = resolvedWorkSlots(candidate, definition);
  const errors: string[] = [];
  const warnings: string[] = [];
  const occupiedByOthers = new Set(furniture.filter((item) => item.id !== candidate.id).flatMap((item) => occupiedCells(item)).map(key));
  if (cells.some((cell) => !cellInBuiltArea(cell, builtAreas))) errors.push('O footprint está fora da área construída.');
  if (cells.some((cell) => isStructuralWall(cell, builtAreas, entrance))) errors.push('O footprint invade uma parede.');
  if (cells.some((cell) => (cell.x === entrance.x || cell.x === entrance.x + 1) && cell.y === entrance.y)) errors.push('A entrada e a saída precisam ficar livres.');
  if (cells.some((cell) => occupiedByOthers.has(key(cell)))) errors.push('O footprint sobrepõe outro móvel.');
  const allBlocked = new Set([...occupiedByOthers, ...cells.map(key)]);
  for (const slot of slots.filter((item) => item.required)) {
    if (!cellInBuiltArea(slot.point, builtAreas)) errors.push(`WorkSlot obrigatório fora da área: ${slot.id}.`);
    else if (isStructuralWall(slot.point, builtAreas, entrance)) errors.push(`WorkSlot obrigatório bloqueado por parede: ${slot.id}.`);
    else if (allBlocked.has(key(slot.point))) errors.push(`WorkSlot obrigatório bloqueado: ${slot.id}.`);
  }
  const reachable = reachableCells(entrance, builtAreas, allBlocked);
  for (const slot of slots.filter((item) => item.required)) if (!reachable.has(key(slot.point))) errors.push(`WorkSlot inacessível: ${slot.id}.`);
  if (definition.category === 'service' && definition.code >= 'C1' && definition.code <= 'C4') {
    const purposes = new Set(slots.map((slot) => slot.purpose));
    if (!purposes.has('kitchen-drop') || !purposes.has('waiter-pickup')) errors.push('Balcão sem acesso traseiro e frontal.');
  }
  if (!slots.length && !['tables', 'chairs', 'decoration'].includes(definition.category)) warnings.push('Móvel funcional sem slots de interação.');
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings, occupiedCells: cells, workSlots: slots };
}

export function validateLayout(furniture: readonly PlacedFurniture[], builtAreas: readonly BuiltAreaRect[], entrance: GridPoint = { x: 9, y: 17 }): PlacementValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const item of furniture) {
    const result = validateFurniturePlacement(item, furniture, builtAreas, entrance);
    errors.push(...result.errors.map((error) => `${item.id}: ${error}`));
    warnings.push(...result.warnings.map((warning) => `${item.id}: ${warning}`));
  }
  return { valid: errors.length === 0, errors, warnings, occupiedCells: furniture.flatMap((item) => occupiedCells(item)), workSlots: furniture.flatMap((item) => resolvedWorkSlots(item)) };
}

function reachableCells(start: GridPoint, areas: readonly BuiltAreaRect[], blocked: Set<string>): Set<string> {
  const first = cellInBuiltArea(start, areas) && !blocked.has(key(start)) ? start : nearestBuiltCell(start, areas, blocked);
  if (!first) return new Set();
  const seen = new Set<string>([key(first)]);
  const queue = [first];
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of [{ x: current.x + 1, y: current.y }, { x: current.x - 1, y: current.y }, { x: current.x, y: current.y + 1 }, { x: current.x, y: current.y - 1 }]) {
      const nextKey = key(next);
      if (seen.has(nextKey) || blocked.has(nextKey) || !cellInBuiltArea(next, areas)) continue;
      seen.add(nextKey); queue.push(next);
    }
  }
  return seen;
}

function isStructuralWall(point: GridPoint, areas: readonly BuiltAreaRect[], entrance: GridPoint): boolean {
  const base = areas.find((area) => area.kind === 'base');
  if (!base) return false;
  const onEdge = point.x === base.x || point.y === base.y || point.x === base.x + base.width - 1 || point.y === base.y + base.depth - 1;
  const doorway = point.y === entrance.y && (point.x === entrance.x || point.x === entrance.x + 1);
  return onEdge && !doorway;
}

function nearestBuiltCell(point: GridPoint, areas: readonly BuiltAreaRect[], blocked: Set<string>): GridPoint | undefined {
  for (let radius = 0; radius < 8; radius += 1) for (let y = point.y - radius; y <= point.y + radius; y += 1) for (let x = point.x - radius; x <= point.x + radius; x += 1) {
    const candidate = { x, y };
    if (cellInBuiltArea(candidate, areas) && !blocked.has(key(candidate))) return candidate;
  }
  return undefined;
}

const key = (point: GridPoint): string => `${point.x},${point.y}`;
