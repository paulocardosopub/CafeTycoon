import type {
  ConstructionSaveState, Direction, ExpansionDefinition, FurnitureEditSession, GameState, PlacedFurniture, RecipeId, StaffStartPosition,
} from '../../../core/types';
import { createPersistentId } from '../../../core/id';
import { EXPANSION_BY_ID } from '../../data/expansions';
import { FURNITURE_BY_ID } from '../../data/furniture/catalog';
import { STAFF_BY_ID } from '../../data/staff';
import { orientedFootprint, resolvedWorkSlots, validateFurniturePlacement, validateLayout } from '../furniture/FurniturePlacement';
import { getApproachSlotCells, getSpriteAnchor, getVisualScale, snapToGrid } from '../../grid/SpatialLayoutService';
import { seatFacingTowardTable } from '../../map/initialMap';
import { modulesFromFurniture } from '../service-counter/ServiceCounterSystem';
import { availableStaffFurniture, linkedStaffStart, nearestSafeStaffStart, staffFurnitureRequirement, syncLinkedStaffStarts, validateStaffStartPosition } from './StaffStartSystem';
import { storageHasContents } from '../../inventory/StorageService';
import { createStaffInstance } from '../../staff/StaffService';

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
  private furnitureEdit?: { session: FurnitureEditSession; before: ConstructionDraft };
  private expansionEdit?: { definition: ExpansionDefinition; side: ExpansionDefinition['allowedSides'][number]; before: ConstructionDraft };

  constructor(private readonly state: GameState) {
    this.original = clone({ construction: state.construction, coins: state.coins });
    this.current = clone(this.original);
  }

  get draft(): Readonly<ConstructionDraft> { return this.current; }
  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
  get editSession(): Readonly<FurnitureEditSession> | undefined { return this.furnitureEdit?.session; }
  get pendingExpansion(): Readonly<{ definition: ExpansionDefinition; side: ExpansionDefinition['allowedSides'][number] }> | undefined {
    return this.expansionEdit ? { definition: this.expansionEdit.definition, side: this.expansionEdit.side } : undefined;
  }

  beginFurnitureEdit(id: string): EditorResult {
    if (this.furnitureEdit?.session.furnitureId === id) return { ok: true };
    if (this.furnitureEdit) this.cancelFurnitureEdit();
    const item = this.current.construction.placedFurniture.find((entry) => entry.id === id);
    const definition = item ? FURNITURE_BY_ID[item.definitionId] : undefined;
    if (!item || !definition) return { ok: false, reason: 'Móvel não encontrado.' };
    const attached = this.current.construction.placedFurniture.filter((entry) => entry.state.linkedTableId === id);
    this.furnitureEdit = {
      before: clone(this.current),
      session: {
        furnitureId: id,
        originalGridPosition: { x: item.gridX, y: item.gridY }, originalRotation: item.orientation,
        originalAttachedFurniture: clone(attached), originalWorkSlots: clone(definition.workSlots),
        previewGridPosition: { x: item.gridX, y: item.gridY }, previewRotation: item.orientation,
        previewAttachedFurniture: clone(attached), validationState: 'valid', validationErrors: [], startedAt: Date.now(),
      },
    };
    return { ok: true };
  }

  previewFurnitureMove(id: string, gridX: number, gridY: number): EditorResult {
    const started = this.beginFurnitureEdit(id); if (!started.ok) return started;
    const point = snapToGrid({ x: gridX, y: gridY });
    return this.applyFurniturePreview(point, this.furnitureEdit!.session.previewRotation);
  }

  previewFurnitureRotation(id: string): EditorResult {
    const started = this.beginFurnitureEdit(id); if (!started.ok) return started;
    const session = this.furnitureEdit!.session;
    const definition = FURNITURE_BY_ID[this.furnitureEdit!.before.construction.placedFurniture.find((item) => item.id === id)!.definitionId];
    if (!definition.rotatable) return { ok: false, reason: 'Este móvel não pode ser girado.' };
    const index = definition.allowedOrientations.indexOf(session.previewRotation);
    const orientation = definition.allowedOrientations[(index + 1) % definition.allowedOrientations.length];
    return this.applyFurniturePreview(session.previewGridPosition, orientation);
  }

  confirmFurnitureEdit(): EditorResult {
    if (!this.furnitureEdit) return { ok: false, reason: 'Nenhuma alteração pendente.' };
    if (this.furnitureEdit.session.validationState !== 'valid') return { ok: false, reason: this.furnitureEdit.session.validationErrors[0] ?? 'Posição inválida.' };
    this.undoStack.push(clone(this.furnitureEdit.before)); this.redoStack = [];
    this.furnitureEdit = undefined; this.refreshFurnitureRelationships();
    return { ok: true };
  }

  cancelFurnitureEdit(): EditorResult {
    if (!this.furnitureEdit) return { ok: false, reason: 'Nenhuma alteração pendente.' };
    this.current = clone(this.furnitureEdit.before); this.furnitureEdit = undefined;
    return { ok: true };
  }

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
    Object.assign(item, { gridX: Math.round(gridX), gridY: Math.round(gridY), footprint: orientedFootprint(definition, orientation), anchor: getSpriteAnchor(definition), visualScale: getVisualScale(definition), heightCategory: definition.heightCategory, workSlotIds: definition.workSlots.map((slot) => slot.id) });
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
    if (this.current.construction.staffStartPositions.some((start) => start.linkedFurnitureId === id)) return { ok: false, reason: 'Este móvel está vinculado a um funcionário. Demita-o ou vincule-o a outro móvel antes de guardar.' };
    const module = this.current.construction.serviceCounters.find((entry) => entry.id === id);
    if (module && (module.currentQuantity || module.reservedQuantity) && !confirmFood) return { ok: false, reason: 'Confirme o armazenamento do balcão com comida.' };
    if (storageHasContents(this.state, id) && !confirmFood) return { ok: false, reason: 'Confirme o armazenamento deste móvel com ingredientes. Os itens serão preservados.' };
    this.record();
    this.current.construction.placedFurniture = this.current.construction.placedFurniture.filter((entry) => entry.id !== id);
    this.current.construction.storedFurniture.push(item); this.refreshFurnitureRelationships(); return { ok: true };
  }

  sell(id: string, confirmFood = false): EditorResult {
    const item = this.current.construction.placedFurniture.find((entry) => entry.id === id);
    const definition = item ? FURNITURE_BY_ID[item.definitionId] : undefined;
    if (!item || !definition) return { ok: false, reason: 'Móvel não encontrado.' };
    if (this.current.construction.staffStartPositions.some((start) => start.linkedFurnitureId === id)) return { ok: false, reason: 'Este móvel está vinculado a um funcionário e não pode ser vendido.' };
    const module = this.current.construction.serviceCounters.find((entry) => entry.id === id);
    if (module && (module.currentQuantity || module.reservedQuantity) && !confirmFood) return { ok: false, reason: 'Confirme a venda do balcão e a devolução do estoque.' };
    if (storageHasContents(this.state, id) && !confirmFood) return { ok: false, reason: 'Este armazenamento contém ingredientes. Confirme para redistribuir sem apagar itens.' };
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
    const preview = this.previewExpansion(definitionId, side);
    return preview.ok ? this.confirmExpansion() : preview;
  }

  previewExpansion(definitionId: string, side: ExpansionDefinition['allowedSides'][number]): EditorResult {
    if (this.expansionEdit) { this.current = clone(this.expansionEdit.before); this.expansionEdit = undefined; }
    const definition = EXPANSION_BY_ID[definitionId];
    if (!definition) return { ok: false, reason: 'Expansão desconhecida.' };
    if (!definition.allowedSides.includes(side)) return { ok: false, reason: 'Lado não permitido.' };
    if (this.state.restaurantLevel < definition.unlockLevel) return { ok: false, reason: `Requer nível ${definition.unlockLevel}.` };
    if (this.current.construction.builtAreas.some((area) => area.expansionDefinitionId === definition.id)) return { ok: false, reason: 'Expansão já adquirida.' };
    if (definition.prerequisites.some((id) => !this.current.construction.builtAreas.some((area) => area.expansionDefinitionId === id))) return { ok: false, reason: 'Pré-requisito de expansão ausente.' };
    if (this.current.coins < definition.coinCost) return { ok: false, reason: 'Moedas insuficientes.' };
    const area = expansionArea(definition, side, this.current.construction.builtAreas);
    const before = clone(this.current);
    this.current.construction.builtAreas.push(area);
    this.expansionEdit = { definition, side, before };
    return { ok: true };
  }

  confirmExpansion(): EditorResult {
    if (!this.expansionEdit) return { ok: false, reason: 'Nenhuma ampliação selecionada.' };
    this.undoStack.push(clone(this.expansionEdit.before)); this.redoStack = [];
    this.current.coins -= this.expansionEdit.definition.coinCost;
    this.expansionEdit = undefined;
    return { ok: true };
  }

  cancelExpansion(): EditorResult {
    if (!this.expansionEdit) return { ok: false, reason: 'Nenhuma ampliação selecionada.' };
    this.current = clone(this.expansionEdit.before);
    this.expansionEdit = undefined;
    return { ok: true };
  }

  setStaffStart(position: StaffStartPosition): EditorResult {
    const existing = this.current.construction.staffStartPositions.find((item) => item.staffId === position.staffId);
    if (existing?.linkedFurnitureId) return { ok: false, reason: 'A posição deste funcionário acompanha automaticamente o móvel vinculado.' };
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
    const requiredFurniture = staffFurnitureRequirement(definition.role);
    const furniture = availableStaffFurniture(definition.role, this.current.construction.placedFurniture, this.current.construction.staffStartPositions);
    if (requiredFurniture && !furniture) return { ok: false, reason: `Instale um ${requiredFurniture} livre antes desta contratação.` };
    const start = furniture ? linkedStaffStart(staffId, definition.role, furniture)
      : nearestSafeStaffStart(staffId, definition.suggestedStart, definition.facing, this.current.construction.placedFurniture, this.current.construction.builtAreas);
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
    if (this.furnitureEdit) return { ok: false, reason: 'Confirme no ✓ ou cancele no × a alteração do móvel selecionado.' };
    if (this.expansionEdit) return { ok: false, reason: 'Confirme no ✓ ou cancele no × a ampliação selecionada.' };
    this.refreshFurnitureRelationships();
    const definitions = this.current.construction.placedFurniture.map((item) => FURNITURE_BY_ID[item.definitionId]).filter(Boolean);
    const missingEssential = Object.values(FURNITURE_BY_ID).find((definition) => definition.essential && !definitions.some((candidate) => candidate.id === definition.id));
    if (missingEssential) return { ok: false, reason: `${missingEssential.name} é essencial para reabrir o restaurante.` };
    const tables = this.current.construction.placedFurniture.filter((item) => FURNITURE_BY_ID[item.definitionId]?.functionId === 'table');
    const linkedChairs = this.current.construction.placedFurniture.filter((item) => FURNITURE_BY_ID[item.definitionId]?.functionId === 'chair' && typeof item.state.linkedTableId === 'string');
    const orphanChair = this.current.construction.placedFurniture.find((item) => FURNITURE_BY_ID[item.definitionId]?.functionId === 'chair' && typeof item.state.linkedTableId !== 'string');
    if (orphanChair) return { ok: false, reason: 'Toda cadeira instalada precisa pertencer a uma mesa com espaço em lado oposto.' };
    if (!tables.length || !linkedChairs.length) return { ok: false, reason: 'Coloque ao menos uma mesa com uma cadeira ao lado para reabrir.' };
    for (const start of this.current.construction.staffStartPositions) {
      const definition = STAFF_BY_ID[start.staffId];
      if (definition && !definition.includedByDefault && staffFurnitureRequirement(definition.role) && !start.linkedFurnitureId) return { ok: false, reason: `${definition.name} precisa permanecer vinculado a um ${staffFurnitureRequirement(definition.role)}.` };
      const staffValidation = validateStaffStartPosition(start, this.current.construction.placedFurniture, this.current.construction.builtAreas);
      if (!staffValidation.valid) return { ok: false, reason: `Ponto inicial de ${start.staffId}: ${staffValidation.reason}` };
    }
    const validation = validateLayout(this.current.construction.placedFurniture, this.current.construction.builtAreas);
    if (!validation.valid) return { ok: false, reason: validation.errors[0], warnings: validation.warnings };
    for (const start of this.current.construction.staffStartPositions) {
      const existing = this.state.staff.instances.find((instance) => instance.id === start.staffId || instance.definitionId === start.staffId);
      if (existing) { existing.startPosition = { x: start.gridX, y: start.gridY }; existing.currentFacing = start.facing; continue; }
      const definition = STAFF_BY_ID[start.staffId];
      if (definition) this.state.staff.instances.push(createStaffInstance(definition, Date.now(), { x: start.gridX, y: start.gridY }));
    }
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
    for (const chair of chairs) { chair.state = { ...chair.state }; delete chair.state.linkedTableId; delete chair.state.seatFacing; }
    syncLinkedStaffStarts(this.current.construction.staffStartPositions, this.current.construction.placedFurniture);
    const assigned = new Set<string>();
    for (const table of tables) {
      const adjacent = chairs.filter((chair) => !assigned.has(chair.id) && Math.abs(table.gridX - chair.gridX) + Math.abs(table.gridY - chair.gridY) === 1)
        .sort((a, b) => a.id.localeCompare(b.id));
      let selected: PlacedFurniture[] = [];
      outer: for (let i = 0; i < adjacent.length; i += 1) for (let j = i + 1; j < adjacent.length; j += 1) {
        if (adjacent[i].gridX + adjacent[j].gridX === table.gridX * 2 && adjacent[i].gridY + adjacent[j].gridY === table.gridY * 2) { selected = [adjacent[i], adjacent[j]]; break outer; }
      }
      if (!selected.length && adjacent[0]) selected = [adjacent[0]];
      for (const chair of selected) {
        assigned.add(chair.id); const facing = seatFacingTowardTable({ x: chair.gridX, y: chair.gridY }, { x: table.gridX, y: table.gridY });
        chair.state = { ...chair.state, linkedTableId: table.id, seatFacing: facing }; chair.orientation = facing;
        chair.seatSlotIds = [`${chair.id}:seat`]; chair.approachSlotIds = [`${chair.id}:approach`];
      }
      table.attachedFurnitureIds = selected.map((chair) => chair.id);
      table.seatSlotIds = selected.map((chair) => `${chair.id}:seat`);
      table.approachSlotIds = getApproachSlotCells(table, selected).map((point) => `${point.x},${point.y}`);
    }
    this.refreshCounters();
    for (const module of this.current.construction.serviceCounters) module.assignedRecipeId ??= 'omelette';
  }

  private furnitureRelationshipErrors(): string[] {
    const errors: string[] = [];
    const furniture = this.current.construction.placedFurniture;
    const chairs = furniture.filter((item) => FURNITURE_BY_ID[item.definitionId]?.functionId === 'chair');
    for (const chair of chairs) {
      if (typeof chair.state.linkedTableId !== 'string') errors.push(`A cadeira ${chair.id} precisa ficar adjacente e oposta a outra cadeira da mesa.`);
    }
    for (const table of furniture.filter((item) => FURNITURE_BY_ID[item.definitionId]?.functionId === 'table')) {
      const attached = chairs.filter((chair) => chair.state.linkedTableId === table.id);
      if (attached.length > 2) errors.push(`A mesa ${table.id} aceita no máximo duas cadeiras.`);
      if (attached.length === 2 && (attached[0].gridX + attached[1].gridX !== table.gridX * 2 || attached[0].gridY + attached[1].gridY !== table.gridY * 2)) {
        errors.push(`As duas cadeiras da mesa ${table.id} precisam ficar em lados opostos.`);
      }
    }
    return errors;
  }

  private applyFurniturePreview(position: { x: number; y: number }, orientation: Direction): EditorResult {
    const edit = this.furnitureEdit!;
    this.current = clone(edit.before);
    const item = this.current.construction.placedFurniture.find((entry) => entry.id === edit.session.furnitureId)!;
    const definition = FURNITURE_BY_ID[item.definitionId];
    item.gridX = position.x; item.gridY = position.y; item.orientation = orientation; item.footprint = orientedFootprint(definition, orientation);
    const turns = (definition.allowedOrientations.indexOf(orientation) - definition.allowedOrientations.indexOf(edit.session.originalRotation) + 4) % 4;
    for (const originalChair of edit.session.originalAttachedFurniture) {
      const chair = this.current.construction.placedFurniture.find((entry) => entry.id === originalChair.id); if (!chair) continue;
      let dx = originalChair.gridX - edit.session.originalGridPosition.x; let dy = originalChair.gridY - edit.session.originalGridPosition.y;
      for (let turn = 0; turn < turns; turn += 1) [dx, dy] = [-dy, dx];
      chair.gridX = position.x + dx; chair.gridY = position.y + dy; chair.orientation = seatFacingTowardTable({ x: chair.gridX, y: chair.gridY }, { x: item.gridX, y: item.gridY });
      chair.state = { ...chair.state, linkedTableId: item.id, seatFacing: chair.orientation };
    }
    this.refreshFurnitureRelationships();
    const validation = validateLayout(this.current.construction.placedFurniture, this.current.construction.builtAreas);
    const relationshipErrors = this.furnitureRelationshipErrors();
    const validationErrors = [...validation.errors, ...relationshipErrors];
    edit.session.previewGridPosition = { ...position }; edit.session.previewRotation = orientation;
    edit.session.previewAttachedFurniture = clone(this.current.construction.placedFurniture.filter((entry) => entry.state.linkedTableId === item.id));
    edit.session.validationState = validation.valid && relationshipErrors.length === 0 ? 'valid' : 'invalid'; edit.session.validationErrors = validationErrors;
    return { ok: edit.session.validationState === 'valid', reason: validationErrors[0], warnings: validation.warnings };
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
