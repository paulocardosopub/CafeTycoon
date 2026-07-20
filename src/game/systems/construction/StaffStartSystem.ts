import type { BuiltAreaRect, Direction, GridPoint, PlacedFurniture, StaffStartPosition } from '../../../core/types';
import { cellInBuiltArea, occupiedCells, resolvedWorkSlots } from '../furniture/FurniturePlacement';

export interface StaffStartValidation { valid: boolean; reason?: string }

export function validateStaffStartPosition(
  position: StaffStartPosition,
  furniture: readonly PlacedFurniture[],
  builtAreas: readonly BuiltAreaRect[],
  entrance: GridPoint = { x: 9, y: 17 },
): StaffStartValidation {
  const point = { x: position.gridX, y: position.gridY };
  if (!cellInBuiltArea(point, builtAreas)) return { valid: false, reason: 'Posição fora da área construída.' };
  const blocked = new Set(furniture.flatMap((item) => occupiedCells(item)).map(key));
  if (blocked.has(key(point))) return { valid: false, reason: 'Posição dentro de um móvel.' };
  const slots = new Set(furniture.flatMap((item) => resolvedWorkSlots(item).filter((slot) => slot.required).map((slot) => key(slot.point))));
  if (slots.has(key(point))) return { valid: false, reason: 'Posição sobre um WorkSlot obrigatório.' };
  if (point.x === entrance.x && point.y === entrance.y) return { valid: false, reason: 'Posição bloqueia a entrada.' };
  if (!hasEscape(point, builtAreas, blocked)) return { valid: false, reason: 'Posição sem saída.' };
  return { valid: true };
}

export function nearestSafeStaffStart(
  staffId: string,
  desired: GridPoint,
  facing: Direction,
  furniture: readonly PlacedFurniture[],
  builtAreas: readonly BuiltAreaRect[],
): StaffStartPosition {
  for (let radius = 0; radius < 12; radius += 1) for (let y = desired.y - radius; y <= desired.y + radius; y += 1) for (let x = desired.x - radius; x <= desired.x + radius; x += 1) {
    const candidate = { staffId, gridX: x, gridY: y, facing, returnWhenIdle: true };
    if (validateStaffStartPosition(candidate, furniture, builtAreas).valid) return candidate;
  }
  return { staffId, gridX: 9, gridY: 15, facing: 'ne', returnWhenIdle: true };
}

function hasEscape(point: GridPoint, areas: readonly BuiltAreaRect[], blocked: Set<string>): boolean {
  return [{ x: point.x + 1, y: point.y }, { x: point.x - 1, y: point.y }, { x: point.x, y: point.y + 1 }, { x: point.x, y: point.y - 1 }]
    .some((next) => cellInBuiltArea(next, areas) && !blocked.has(key(next)));
}

const key = (point: GridPoint): string => `${point.x},${point.y}`;

