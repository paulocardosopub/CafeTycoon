import type {
  ConstructionSaveState, Direction, ExpansionDefinition, GameState, PlacedFurniture, RecipeId, StaffStartPosition,
} from '../../../core/types';
import { createPersistentId } from '../../../core/id';
import { EXPANSION_BY_ID } from '../../data/expansions';
import { FURNITURE_BY_ID } from '../../data/furniture/catalog';
import { STAFF_BY_ID } from '../../data/staff';
import { validateFurniturePlacement, validateLayout } from '../furniture/FurniturePlacement';
import { modulesFromFurniture } from '../service-counter/ServiceCounterSystem';
import { nearestSafeStaffStart, validateStaffStartPosition } from './StaffStartSystem';

export interface ConstructionDraft {
  construction: ConstructionSaveState;
  coins: number;
}

export interface EditorResult { ok: boolean; reason?: string; warnings?: string[] }

export class ConstructionEditor {
  private readonly original: ConstructionDraft;
  private current: ConstructionDraft;
  private undoStack: ConstructionDraft[] = [];
  private redoStack: ConstructionDraft[] = [];
  private active = true;

  constructor(private readonly state: GameState) {
    this.original = clone({ construction: state.construction, coins: state.coins });
    this.current = clone(this.original);
  }

  get draft(): Readonly<ConstructionDraft> { return this.current; }
  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }

  place(definitionId: string, gridX: number, gridY: number, orientation: Direction = 'sw', skinId?: string, storedItemId?: string): EditorResult {
    const definition = FURNITURE_BY_ID[definitionId];
    if (!definition) return { ok: false, reason: `Móvel desconhecido: ${definitionId}.` };
    const stored = storedItemId ? this.current.construction.storedFurniture.find((item) => item.id === storedItemId) : undefined;
    if (storedItemId && !stored) return { ok: false, reason: 'Item guardado não encontrado.' };
    if (!stored && this.current.coins < definition.price) return { ok: false, reason: 'Moedas insuficientes.' };
    const item: PlacedFurniture = stored ? { ...clone(stored), gridX, gridY, orientation } : {
      id: createPersistentId('furniture'), definitionId, gridX, gridY, orientation,
      skinId: skinId ?? definition.skinIds[0], level: 1, state: {},
    };
    const validation = validateFurniturePlacement(item, this.current.construction.placedFurniture, this.current.construction.builtAreas);
    if (!validation.valid) return { ok: false, reason: validation.errors[0], warnings: validation.warnings };
    this.record();
    if (stored) this.current.construction.storedFurniture = this.current.construction.storedFurniture.filter((entry) => entry.id !== stored.id);
    else this.current.coins -= definition.price;
    this.current.construction.placedFurniture.push(item);
    this.refreshFurnitureRelationships();
    return { ok: true, warnings: validation.warnings };
  }

  move(id: string, gridX: number, gridY: number): EditorResult {
    const item = this.current.construction.placedFurniture.find((entry) => entry.id === id);
    if (!item) return { ok: false, reason: 'Móvel não encontrado.' };
    const candidate = { ...item, gridX, gridY };
    const validation = validateFurniturePlacement(candidate, this.current.construction.placedFurniture, this.current.construction.builtAreas);
    if (!validation.valid) return { ok: false, reason: validation.errors[0], warnings: validation.warnings };
    this.record(); Object.assign(item, candidate); this.refreshFurnitureRelationships(); return { ok: true, warnings: validation.warnings };
  }

  rotate(id: string): EditorResult {
    const item = this.current.construction.placedFurniture.find((entry) => entry.id === id);
    const definition = item ? FURNITURE_BY_ID[item.definitionId] : undefined;
    if (!item || !definition) return { ok: false, reason: 'Móvel não encontrado.' };
    if (!definition.rotatable) return { ok: false, reason: 'Este móvel não pode ser girado.' };
    const index = definition.allowedOrientations.indexOf(item.orientation);
    const orientation = definition.allowedOrientations[(index + 1) % definition.allowedOrientations.length];
    const candidate = { ...item, orientation };
    const validation = validateFurniturePlacement(candidate, this.current.construction.placedFurniture, this.current.construction.builtAreas);
    if (!validation.valid) return { ok: false, reason: validation.errors[0], warnings: validation.warnings };
    this.record(); item.orientation = orientation; this.refreshFurnitureRelationships(); return { ok: true, warnings: validation.warnings };
  }

  store(id: string, confirmFood = false): EditorResult {
    const item = this.current.construction.placedFurniture.find((entry) => entry.id === id);
    if (!item) return { ok: false, reason: 'Móvel não encontrado.' };
    const module = this.current.construction.serviceCounters.find((entry) => entry.id === id);
    if (module && (module.currentQuantity || module.reservedQuantity) && !confirmFood) return { ok: false, reason: 'Confirme o armazenamento do balcão com comida.' };
    this.record();
    this.current.construction.placedFurniture = this.current.construction.placedFurniture.filter((entry) => entry.id !== id);
    this.current.construction.storedFurniture.push(item); this.refreshFurnitureRelationships(); return { ok: true };
  }

  sell(id: string, confirmFood = false): EditorResult {
    const item = this.current.construction.placedFurniture.find((entry) => entry.id === id);
    const definition = item ? FURNITURE_BY_ID[item.definitionId] : undefined;
    if (!item || !definition) return { ok: false, reason: 'Móvel não encontrado.' };
    const module = this.current.construction.serviceCounters.find((entry) => entry.id === id);
    if (module && (module.currentQuantity || module.reservedQuantity) && !confirmFood) return { ok: false, reason: 'Confirme a venda do balcão e a devolução do estoque.' };
    this.record(); this.current.construction.placedFurniture = this.current.construction.placedFurniture.filter((entry) => entry.id !== id);
    this.current.coins += definition.resaleValue; this.refreshFurnitureRelationships(); return { ok: true };
  }

  changeSkin(id: string, skinId: string): EditorResult {
    const item = this.current.construction.placedFurniture.find((entry) => entry.id === id);
    const definition = item ? FURNITURE_BY_ID[item.definitionId] : undefined;
    if (!item || !definition || !definition.skinIds.includes(skinId)) return { ok: false, reason: 'Skin incompatível.' };
    const price = skinId === definition.skinIds[0] ? 0 : Math.max(20, Math.floor(definition.price * .2));
    if (this.current.coins < price) return { ok: false, reason: 'Moedas insuficientes.' };
    this.record(); this.current.coins -= price; item.skinId = skinId; this.refreshCounters(); return { ok: true };
  }

  setSurface(kind: 'floor' | 'wall' | 'door' | 'window', skinId: string, price = 0): EditorResult {
    if (this.current.coins < price) return { ok: false, reason: 'Moedas insuficientes.' };
    this.record(); this.current.coins -= price;
    const key = `${kind}SkinId` as const;
    this.current.construction[key] = skinId;
    return { ok: true };
  }

  assignCounterRecipe(moduleId: string, recipeId: RecipeId): EditorResult {
    const module = this.current.construction.serviceCounters.find((item) => item.id === moduleId);
    if (!module) return { ok: false, reason: 'Módulo de balcão não encontrado.' };
    if (module.currentQuantity > 0 || module.reservedQuantity > 0) return { ok: false, reason: 'Esvazie o módulo antes de trocar a receita.' };
    this.record();
    module.assignedRecipeId = recipeId;
    return { ok: true };
  }

  buyExpansion(definitionId: string, side: ExpansionDefinition['allowedSides'][number]): EditorResult {
    const definition = EXPANSION_BY_ID[definitionId];
    if (!definition) return { ok: false, reason: 'Expansão desconhecida.' };
    if (!definition.allowedSides.includes(side)) return { ok: false, reason: 'Lado não permitido.' };
    if (this.state.restaurantLevel < definition.unlockLevel) return { ok: false, reason: `Requer nível ${definition.unlockLevel}.` };
    if (this.current.construction.builtAreas.some((area) => area.expansionDefinitionId === definition.id)) return { ok: false, reason: 'Expansão já adquirida.' };
    if (definition.prerequisites.some((id) => !this.current.construction.builtAreas.some((area) => area.expansionDefinitionId === id))) return { ok: false, reason: 'Pré-requisito de expansão ausente.' };
    if (this.current.coins < definition.coinCost) return { ok: false, reason: 'Moedas insuficientes.' };
    const area = expansionArea(definition, side, this.current.construction.builtAreas);
    this.record(); this.current.coins -= definition.coinCost; this.current.construction.builtAreas.push(area); return { ok: true };
  }

  setStaffStart(position: StaffStartPosition): EditorResult {
    if (this.current.construction.staffStartPositions.some((item) => item.staffId !== position.staffId && item.gridX === position.gridX && item.gridY === position.gridY)) {
      return { ok: false, reason: 'Outro funcionário já começa nesse quadrado.' };
    }
    const validation = validateStaffStartPosition(position, this.current.construction.placedFurniture, this.current.construction.builtAreas);
    if (!validation.valid) return { ok: false, reason: validation.reason };
    this.record();
    this.current.construction.staffStartPositions = this.current.construction.staffStartPositions.filter((item) => item.staffId !== position.staffId);
    this.current.construction.staffStartPositions.push({ ...position });
    return { ok: true };
  }

  hireStaff(staffId: string): EditorResult {
    const definition = STAFF_BY_ID[staffId];
    if (!definition || definition.includedByDefault) return { ok: false, reason: 'Funcionário indisponível para contratação.' };
    if (this.current.construction.staffStartPositions.some((item) => item.staffId === staffId)) return { ok: false, reason: 'Este funcionário já faz parte da equipe.' };
    if (this.current.coins < definition.hireCost) return { ok: false, reason: 'Moedas insuficientes para esta contratação.' };
    const start = nearestSafeStaffStart(staffId, definition.suggestedStart, definition.facing, this.current.construction.placedFurniture, this.current.construction.builtAreas);
    const validation = validateStaffStartPosition(start, this.current.construction.placedFurniture, this.current.construction.builtAreas);
    if (!validation.valid) return { ok: false, reason: validation.reason };
    this.record();
    this.current.coins -= definition.hireCost;
    this.current.construction.staffStartPositions.push(start);
    return { ok: true };
  }

  undo(): EditorResult {
    const previous = this.undoStack.pop(); if (!previous) return { ok: false, reason: 'Nada para desfazer.' };
    this.redoStack.push(clone(this.current)); this.current = previous; return { ok: true };
  }

  redo(): EditorResult {
    const next = this.redoStack.pop(); if (!next) return { ok: false, reason: 'Nada para refazer.' };
    this.undoStack.push(clone(this.current)); this.current = next; return { ok: true };
  }

  confirm(): EditorResult {
    if (!this.active) return { ok: false, reason: 'Editor encerrado.' };
    this.refreshFurnitureRelationships();
    const definitions = this.current.construction.placedFurniture.map((item) => FURNITURE_BY_ID[item.definitionId]).filter(Boolean);
    const missingEssential = Object.values(FURNITURE_BY_ID).find((definition) => definition.essential && !definitions.some((candidate) => candidate.id === definition.id));
    if (missingEssential) return { ok: false, reason: `${missingEssential.name} é essencial para reabrir o restaurante.` };
    const tables = this.current.construction.placedFurniture.filter((item) => FURNITURE_BY_ID[item.definitionId]?.functionId === 'table');
    const linkedChairs = this.current.construction.placedFurniture.filter((item) => FURNITURE_BY_ID[item.definitionId]?.functionId === 'chair' && typeof item.state.linkedTableId === 'string');
    if (!tables.length || !linkedChairs.length) return { ok: false, reason: 'Coloque ao menos uma mesa com uma cadeira ao lado para reabrir.' };
    for (const start of this.current.construction.staffStartPositions) {
      const staffValidation = validateStaffStartPosition(start, this.current.construction.placedFurniture, this.current.construction.builtAreas);
      if (!staffValidation.valid) return { ok: false, reason: `Ponto inicial de ${start.staffId}: ${staffValidation.reason}` };
    }
    const validation = validateLayout(this.current.construction.placedFurniture, this.current.construction.builtAreas);
    if (!validation.valid) return { ok: false, reason: validation.errors[0], warnings: validation.warnings };
    this.state.construction = clone(this.current.construction); this.state.coins = this.current.coins; this.active = false;
    return { ok: true, warnings: validation.warnings };
  }

  cancel(): EditorResult {
    if (!this.active) return { ok: false, reason: 'Editor encerrado.' };
    this.current = clone(this.original); this.active = false; return { ok: true };
  }

  private record(): void { this.undoStack.push(clone(this.current)); this.redoStack = []; }
  private refreshCounters(): void { this.current.construction.serviceCounters = modulesFromFurniture(this.current.construction.placedFurniture, this.current.construction.serviceCounters); }

  private refreshFurnitureRelationships(): void {
    const tables = this.current.construction.placedFurniture.filter((item) => FURNITURE_BY_ID[item.definitionId]?.functionId === 'table');
    const chairs = this.current.construction.placedFurniture.filter((item) => FURNITURE_BY_ID[item.definitionId]?.functionId === 'chair');
    for (const chair of chairs) {
      const adjacent = tables
        .map((table) => ({ table, distance: Math.abs(table.gridX - chair.gridX) + Math.abs(table.gridY - chair.gridY) }))
        .filter((candidate) => candidate.distance === 1)
        .sort((left, right) => left.table.id.localeCompare(right.table.id));
      const table = adjacent[0]?.table;
      chair.state = { ...chair.state };
      if (!table) {
        delete chair.state.linkedTableId;
        delete chair.state.seatFacing;
        continue;
      }
      chair.state.linkedTableId = table.id;
      chair.state.seatFacing = chair.gridX < table.gridX ? 'se'
        : chair.gridX > table.gridX ? 'nw'
          : chair.gridY < table.gridY ? 'sw' : 'ne';
    }
    this.refreshCounters();
    for (const module of this.current.construction.serviceCounters) module.assignedRecipeId ??= 'omelette';
  }
}

function expansionArea(definition: ExpansionDefinition, side: ExpansionDefinition['allowedSides'][number], areas: ConstructionSaveState['builtAreas']): ConstructionSaveState['builtAreas'][number] {
  const minX = Math.min(...areas.map((area) => area.x)); const minY = Math.min(...areas.map((area) => area.y));
  const maxX = Math.max(...areas.map((area) => area.x + area.width)); const maxY = Math.max(...areas.map((area) => area.y + area.depth));
  const horizontalCenter = Math.floor((minX + maxX - definition.width) / 2);
  const verticalCenter = Math.floor((minY + maxY - definition.depth) / 2);
  const origin = side === 'north' ? { x: horizontalCenter, y: minY - definition.depth }
    : side === 'south' ? { x: horizontalCenter, y: maxY }
      : side === 'west' ? { x: minX - definition.width, y: verticalCenter }
        : { x: maxX, y: verticalCenter };
  return { id: createPersistentId('area'), ...origin, width: definition.width, depth: definition.depth, kind: 'expansion', expansionDefinitionId: definition.id };
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
