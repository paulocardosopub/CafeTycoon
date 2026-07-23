import type { BuiltAreaRect, Direction, GridPoint, PlacedFurniture, StaffRole, StaffStartPosition } from '../../../core/types';
import { cellInBuiltArea, occupiedCells, resolvedWorkSlots } from '../furniture/FurniturePlacement';
import { FURNITURE_BY_ID } from '../../data/furniture/catalog';
import { STAFF_BY_ID, STAFF_CATALOG } from '../../data/staff';

export interface StaffStartValidation { valid: boolean; reason?: string }

const STAFF_FURNITURE: Partial<Record<StaffRole, { label: string; matches: (item: PlacedFurniture) => boolean }>> = {
  waiter: { label: 'balcão de serviço', matches: (item) => FURNITURE_BY_ID[item.definitionId]?.functionId === 'pickup' },
  cleaner: { label: 'pia', matches: (item) => FURNITURE_BY_ID[item.definitionId]?.functionId === 'sink' },
  stocker: { label: 'despensa', matches: (item) => item.definitionId === 'storage.c5.pantry' },
  cook: { label: 'estação de cozinha compatível', matches: (item) => ['coffee_machine','oven','cauldron','stove','grill','assembly'].includes(FURNITURE_BY_ID[item.definitionId]?.functionId ?? '') },
};

function staffRequirement(role: StaffRole, staffDefinitionId?: string): { label: string; matches: (item: PlacedFurniture) => boolean } | undefined {
  const staff = staffDefinitionId ? STAFF_BY_ID[staffDefinitionId] : undefined;
  if (role === 'cook' && staff?.compatibleStationId) {
    const functionId = ({ coffee_machine: 'coffee_machine', oven: 'oven', cauldron: 'cauldron', stove: 'stove', grill: 'grill', fryer: 'grill', prep: 'assembly' } as Record<string,string>)[staff.compatibleStationId] ?? staff.compatibleStationId;
    const label = ({ coffee_machine: 'Cafeteira', oven: 'Forno', cauldron: 'Sopeira', stove: 'Fogão', grill: 'Chapa', assembly: 'Bancada de preparo' } as Record<string,string>)[functionId] ?? 'estação compatível';
    return { label, matches: (item) => FURNITURE_BY_ID[item.definitionId]?.functionId === functionId };
  }
  return STAFF_FURNITURE[role];
}

export function staffFurnitureRequirement(role: StaffRole, staffDefinitionId?: string): string | undefined { return staffRequirement(role, staffDefinitionId)?.label; }

export function availableStaffFurniture(role: StaffRole, furniture: readonly PlacedFurniture[], starts: readonly StaffStartPosition[], staffDefinitionId?: string): PlacedFurniture | undefined {
  const requirement = staffRequirement(role, staffDefinitionId);
  if (!requirement) return undefined;
  const used = new Set(starts.map((start) => start.linkedFurnitureId).filter(Boolean));
  return furniture.find((item) => requirement.matches(item) && !used.has(item.id));
}

export function linkedStaffStart(staffId: string, role: StaffRole, furniture: PlacedFurniture): StaffStartPosition {
  const slots = resolvedWorkSlots(furniture);
  const preferred = role === 'waiter' ? slots.find((slot) => slot.purpose === 'waiter-pickup')
    : role === 'cook' ? slots.find((slot) => slot.purpose === 'work')
      : slots.find((slot) => slot.purpose === 'ingredients' || slot.purpose === 'work');
  const slot = preferred ?? slots[0];
  const fallback = { point: { x: furniture.gridX, y: furniture.gridY + 1 }, facing: 'ne' as Direction };
  return { staffId, linkedFurnitureId: furniture.id, gridX: (slot ?? fallback).point.x, gridY: (slot ?? fallback).point.y, facing: (slot ?? fallback).facing, returnWhenIdle: true };
}

export function syncLinkedStaffStarts(starts: StaffStartPosition[], furniture: readonly PlacedFurniture[]): void {
  for (const start of starts) {
    if (!start.linkedFurnitureId) continue;
    const item = furniture.find((candidate) => candidate.id === start.linkedFurnitureId);
    const definition = STAFF_BY_ID[start.staffId] ?? STAFF_CATALOG.find((candidate) => candidate.actorId === start.staffId);
    if (!item || !definition) continue;
    Object.assign(start, linkedStaffStart(start.staffId, definition.role, item));
  }
}

export function validateStaffStartPosition(
  position: StaffStartPosition,
  furniture: readonly PlacedFurniture[],
  builtAreas: readonly BuiltAreaRect[],
  entrance: GridPoint = { x: 9, y: 17 },
): StaffStartValidation {
  const point = { x: position.gridX, y: position.gridY };
  if (!cellInBuiltArea(point, builtAreas)) return { valid: false, reason: 'Posição fora da área construída.' };
  if (position.linkedFurnitureId) {
    const linked = furniture.find((item) => item.id === position.linkedFurnitureId);
    const definition = STAFF_BY_ID[position.staffId] ?? STAFF_CATALOG.find((candidate) => candidate.actorId === position.staffId);
    if (!linked || !definition) return { valid: false, reason: 'Móvel vinculado ao funcionário não está instalado.' };
    const expected = linkedStaffStart(position.staffId, definition.role, linked);
    if (expected.gridX !== point.x || expected.gridY !== point.y) return { valid: false, reason: `A posição deve permanecer diante do ${staffFurnitureRequirement(definition.role, definition.id) ?? 'móvel vinculado'}.` };
  }
  const blocked = new Set(furniture.flatMap((item) => occupiedCells(item)).map(key));
  if (blocked.has(key(point))) return { valid: false, reason: 'Posição dentro de um móvel.' };
  const slots = new Set(furniture.filter((item) => item.id !== position.linkedFurnitureId).flatMap((item) => resolvedWorkSlots(item).filter((slot) => slot.required).map((slot) => key(slot.point))));
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

