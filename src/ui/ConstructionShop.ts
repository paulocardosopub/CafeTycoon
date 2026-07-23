import type { Direction, FurnitureCategory, GameState, RecipeId, StaffStartPosition } from '../core/types';
import { gameEvents } from '../core/events';
import { RECIPES } from '../content/recipes/recipes';
import { EXPANSIONS } from '../game/data/expansions';
import { FURNITURE_BY_ID, FURNITURE_DEFINITIONS } from '../game/data/furniture/catalog';
import { STAFF_BY_ID, STAFF_CATALOG } from '../game/data/staff';
import { ConstructionEditor, type EditorResult } from '../game/systems/construction/ConstructionEditor';
import type { SaveRepository } from '../game/save/SaveRepository';
import type { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';
import { availableStaffFurniture, staffFurnitureRequirement } from '../game/systems/construction/StaffStartSystem';
import { C3_BR_LEGACY_ALIASES } from '../assets/pixel/c3brManifest';
import { playerSkinAsset } from '../content/characters/playerSkins';

const CONSTRUCTION_RELOAD_SESSION_KEY = 'bistro-bloom-construction-reload';
const ASSET_VERSION = '0.0.7-c3-br-2';

// Curated for the recipes and core restaurant loop currently available.
// Alternatives remain registered and save-safe, but no longer crowd purchases.
const CURRENT_PURCHASABLE_FURNITURE_IDS = new Set([
  'cooking.a1.stove', 'cooking.a2.convection', 'cooking.a3.griddle', 'cooking.a4.fryer', 'cooking.a5.kettle', 'cooking.a6.grill', 'cooking.a7.bakery', 'cooking.a8.coffee',
  'preparation.b3.counter', 'washing.b5.sink', 'preparation.b8.pastry', 'service.c1.isolated', 'service.c9.drinks',
  'dining.table.basic', 'dining.chair.basic',
]);

type CatalogGroup = 'all' | 'dining' | 'kitchen' | 'service' | 'decoration';

const GROUPS: { id: CatalogGroup; label: string }[] = [
  { id: 'all', label: 'Tudo' },
  { id: 'dining', label: 'Salão' },
  { id: 'kitchen', label: 'Cozinha' },
  { id: 'service', label: 'Balcões' },
  { id: 'decoration', label: 'Decoração' },
];

export class ConstructionShop {
  private editor?: ConstructionEditor;
  private overlay?: HTMLElement;
  private selectedItemId?: string;
  private pendingDefinitionId?: string;
  private pendingStoredItemId?: string;
  private moveMode = false;
  private staffPlacementId?: string;
  private staffPlacementFacing: Direction = 'ne';
  private group: CatalogGroup = 'all';
  private mode: 'shop' | 'organize' = 'shop';
  private selectedShopDefinitionId?: string;
  private pendingPurchaseDefinitionId?: string;
  private previewUnsubscribers: (() => void)[] = [];
  private pendingWorldCellTimer?: number;
  private lastWorldItemAt = 0;
  private lastEditorUiPointerAt = 0;
  private status = 'Escolha um móvel e toque em um quadrado livre.';
  private statusTone: 'info' | 'success' | 'warning' = 'info';
  private originalChairLayout = new Map<string, { gridX: number; gridY: number; orientation: Direction }>();

  constructor(
    private readonly root: HTMLElement,
    private readonly state: GameState,
    private readonly simulation: RestaurantSimulation,
    private readonly repository: SaveRepository,
  ) {}

  open(mode: 'shop' | 'organize' = 'shop', focusDefinitionId?: string): void {
    if (this.overlay) return;
    this.mode = mode;
    if (mode === 'shop') {
      this.group = 'all';
      this.selectedShopDefinitionId = focusDefinitionId;
    }
    this.status = mode === 'shop' ? 'Escolha um item para ver os detalhes e confirmar a compra.' : 'Escolha um móvel comprado e toque em um quadrado livre.';
    if (mode === 'organize' && !this.simulation.prepareConstructionMode()) return;
    this.editor = new ConstructionEditor(this.state);
    this.originalChairLayout = mode === 'organize' ? new Map(this.state.construction.placedFurniture
      .filter((item) => FURNITURE_BY_ID[item.definitionId]?.functionId === 'chair')
      .map((item) => [item.id, { gridX: item.gridX, gridY: item.gridY, orientation: item.orientation }])) : new Map();
    this.overlay = document.createElement('section');
    this.overlay.className = `construction-overlay construction-live-overlay ${mode === 'shop' ? 'shop-only-overlay' : 'editor-only-overlay'}`;
    this.overlay.setAttribute('aria-label', 'Loja e organização do restaurante');
    this.overlay.addEventListener('pointerdown', (event) => {
      if (!(event.target as HTMLElement).closest('.construction-header,.construction-toolbar,.construction-catalog,.construction-options,.construction-selected,.construction-live-hint')) return;
      this.lastEditorUiPointerAt = performance.now();
      event.stopPropagation();
    });
    this.overlay.addEventListener('click', (event) => { void this.handleClick(event); });
    this.root.append(this.overlay);
    this.previewUnsubscribers = mode === 'organize' ? [
      gameEvents.on<{ x: number; y: number }>('construction:world-cell', ({ x, y }) => this.queueWorldCell(x, y)),
      gameEvents.on<{ itemId: string }>('construction:world-item', ({ itemId }) => {
        // Durante uma compra ou posicionamento, o toque pertence ao piso,
        // mesmo quando o desenho alto de outro móvel passa sobre o losango.
        if (this.pendingDefinitionId || this.pendingStoredItemId || this.staffPlacementId) return;
        this.lastWorldItemAt = performance.now();
        if (this.pendingWorldCellTimer !== undefined) window.clearTimeout(this.pendingWorldCellTimer);
        this.pendingWorldCellTimer = undefined;
        this.selectItem(itemId);
      }),
      gameEvents.on<{ staffId: string }>('construction:world-staff', ({ staffId }) => {
        if (this.pendingDefinitionId || this.pendingStoredItemId || this.staffPlacementId) return;
        this.lastWorldItemAt = performance.now();
        if (this.pendingWorldCellTimer !== undefined) window.clearTimeout(this.pendingWorldCellTimer);
        this.pendingWorldCellTimer = undefined;
        this.selectStaff(staffId);
      }),
      gameEvents.on<{ itemId: string; x: number; y: number }>('construction:world-drag', ({ itemId, x, y }) => {
        if (this.pendingDefinitionId || this.pendingStoredItemId || this.staffPlacementId) return;
        if (this.selectedItemId !== itemId) this.selectItem(itemId);
        this.apply(this.editor!.previewFurnitureMove(itemId, x, y), 'Prévia reposicionada. Use ✓ para confirmar.');
      }),
      gameEvents.on('construction:edit-confirm', () => this.confirmSelectedEdit()),
      gameEvents.on('construction:edit-cancel', () => this.cancelSelectedEdit()),
    ] : [];
    const keyHandler = (event: KeyboardEvent) => { if (event.key === 'Escape' && this.editor?.editSession) this.cancelSelectedEdit(); };
    if (mode === 'organize') {
      window.addEventListener('keydown', keyHandler);
      this.previewUnsubscribers.push(() => window.removeEventListener('keydown', keyHandler));
    }
    this.render();
    if (focusDefinitionId) window.setTimeout(() => {
      const target = this.overlay?.querySelector<HTMLElement>(`[data-editor-action="shop-info"][data-id="${focusDefinitionId}"]`)?.closest<HTMLElement>('.shop-card');
      target?.classList.add('tutorial-target');
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target?.querySelector<HTMLElement>('button:not([disabled])')?.focus({ preventScroll: true });
    }, 0);
  }

  private queueWorldCell(x: number, y: number): void {
    if (this.pendingWorldCellTimer !== undefined) window.clearTimeout(this.pendingWorldCellTimer);
    this.pendingWorldCellTimer = window.setTimeout(() => {
      this.pendingWorldCellTimer = undefined;
      // Um único toque pode atingir o sprite e o losango que existe atrás
      // dele. A seleção do móvel sempre vence; o deslocamento exige o toque
      // seguinte, evitando teleporte ou desaparecimento acidental.
      if (performance.now() - this.lastWorldItemAt < 100 || performance.now() - this.lastEditorUiPointerAt < 250) return;
      this.useCell(x, y);
    }, 0);
  }

  private selectItem(itemId: string): void {
    if (!this.editor?.draft.construction.placedFurniture.some((item) => item.id === itemId)) return;
    this.selectedItemId = itemId;
    this.pendingDefinitionId = undefined;
    this.pendingStoredItemId = undefined;
    this.staffPlacementId = undefined;
    this.moveMode = true;
    this.editor?.beginFurnitureEdit(itemId);
    this.setStatus('Móvel selecionado. Clique ou arraste; ✓ confirma e × restaura.', 'info');
  }

  private selectStaff(staffId: string): void {
    const position = this.editor?.draft.construction.staffStartPositions.find((item) => item.staffId === staffId);
    if (!position) return;
    if (position.linkedFurnitureId) {
      const furniture = this.editor?.draft.construction.placedFurniture.find((item) => item.id === position.linkedFurnitureId);
      this.setStatus(`Este funcionário acompanha automaticamente ${furniture ? FURNITURE_BY_ID[furniture.definitionId].name : 'o móvel vinculado'}.`, 'info');
      return;
    }
    this.staffPlacementId = staffId;
    this.staffPlacementFacing = position.facing;
    this.selectedItemId = undefined;
    this.pendingDefinitionId = undefined;
    this.pendingStoredItemId = undefined;
    this.moveMode = false;
    this.setStatus('Funcionário selecionado. Escolha a direção e toque no novo quadrado do salão.', 'info');
  }

  private async handleClick(event: Event): Promise<void> {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-editor-action]');
    if (!target || !this.editor) return;
    const action = target.dataset.editorAction;
    if (action === 'category') {
      this.group = target.dataset.id as CatalogGroup;
      this.render();
      return;
    }
    if (action === 'shop-info') {
      this.selectedShopDefinitionId = target.dataset.id;
      this.render();
      return;
    }
    if (action === 'purchase') {
      this.pendingPurchaseDefinitionId = target.dataset.id!;
      this.render();
      return;
    }
    if (action === 'confirm-purchase') {
      const definitionId = this.pendingPurchaseDefinitionId;
      if (!definitionId) return;
      const result = this.editor.purchase(definitionId);
      if (!result.ok) { this.apply(result, ''); return; }
      const confirmed = this.editor.confirmPurchases();
      if (!confirmed.ok) { this.apply(confirmed, ''); return; }
      await this.repository.save(this.state);
      this.editor = new ConstructionEditor(this.state);
      this.pendingPurchaseDefinitionId = undefined;
      this.selectedShopDefinitionId = definitionId;
      this.setStatus('Item comprado! Acesse Editar restaurante para posicioná-lo.', 'success');
      return;
    }
    if (action === 'cancel-purchase') {
      this.pendingPurchaseDefinitionId = undefined;
      this.render();
      return;
    }
    if (action === 'stored') {
      const item = this.editor.draft.construction.storedFurniture.find((entry) => entry.id === target.dataset.id);
      if (!item) return;
      this.pendingDefinitionId = item.definitionId;
      this.pendingStoredItemId = item.id;
      this.selectedItemId = undefined;
      this.moveMode = false;
      this.staffPlacementId = undefined;
      this.mode = 'organize';
      this.setStatus('Item guardado selecionado. Escolha um quadrado livre.', 'info');
      return;
    }
    if (action === 'select-item') {
      this.selectItem(target.dataset.id!);
      return;
    }
    if (action === 'cell') {
      this.useCell(Number(target.dataset.x), Number(target.dataset.y));
      return;
    }
    if (action === 'move') {
      this.moveMode = Boolean(this.selectedItemId);
      this.setStatus(this.moveMode ? 'Toque no novo quadrado diretamente no restaurante.' : 'Selecione um móvel no restaurante primeiro.', this.moveMode ? 'info' : 'warning');
      return;
    }
    if (action === 'rotate' && this.selectedItemId) this.apply(this.editor.previewFurnitureRotation(this.selectedItemId), 'Prévia girada. Use ✓ para confirmar.');
    else if (action === 'confirm-item') this.confirmSelectedEdit();
    else if (action === 'cancel-item') this.cancelSelectedEdit();
    else if (action === 'store' && this.selectedItemId) this.apply(this.editor.store(this.selectedItemId, true), 'Móvel guardado sem perder a compra.');
    else if (action === 'sell' && this.selectedItemId) {
      if (!window.confirm('Vender este móvel pelo valor de revenda?')) return;
      this.apply(this.editor.sell(this.selectedItemId, true), 'Móvel vendido.');
    } else if (action === 'skin' && this.selectedItemId) this.apply(this.editor.changeSkin(this.selectedItemId, target.dataset.id!), 'Acabamento aplicado.');
    else if (action === 'counter-recipe' && this.selectedItemId) this.apply(this.editor.assignCounterRecipe(this.selectedItemId, target.dataset.id as RecipeId), 'Receita ligada a este módulo.');
    else if (action === 'surface') this.apply(this.editor.setSurface(target.dataset.kind as 'floor' | 'wall' | 'door' | 'window', target.dataset.id!, Number(target.dataset.price ?? 0)), 'Revestimento aplicado.');
    else if (action === 'expansion') this.apply(this.editor.previewExpansion(target.dataset.id!, target.dataset.side as 'north' | 'east' | 'south' | 'west'), 'Quadrados selecionados. Use ✓ para comprar ou × para cancelar.');
    else if (action === 'confirm-expansion') await this.confirmExpansionAndApply();
    else if (action === 'cancel-expansion') this.apply(this.editor.cancelExpansion(), 'Seleção de ampliação cancelada.');
    else if (action === 'hire-staff') {
      const staffId = target.dataset.id!;
      const result = this.editor.hireStaff(staffId);
      if (!result.ok) { this.apply(result, ''); return; }
      const hired = STAFF_BY_ID[staffId];
      this.staffPlacementId = undefined;
      this.selectedItemId = undefined;
      this.pendingDefinitionId = undefined;
      this.status = `${hired.name} foi contratado(a) e vinculado(a) ao móvel disponível.`;
      this.statusTone = 'success';
      this.render();
      return;
    } else if (action === 'staff-facing' && this.staffPlacementId) {
      const previous = this.editor.draft.construction.staffStartPositions.find((item) => item.staffId === this.staffPlacementId);
      if (!previous) return;
      this.staffPlacementFacing = target.dataset.id as Direction;
      this.apply(this.editor.setStaffStart({ ...previous, facing: this.staffPlacementFacing }), 'Direção inicial atualizada.');
      return;
    }
    else if (action === 'staff') {
      this.selectStaff(target.dataset.id!);
      return;
    } else if (action === 'undo') this.apply(this.editor.undo(), 'Última alteração desfeita.');
    else if (action === 'redo') this.apply(this.editor.redo(), 'Alteração refeita.');
    else if (action === 'cancel' || action === 'close-shop') this.cancel();
    else if (action === 'confirm') await this.confirm();
  }

  private useCell(x: number, y: number): void {
    if (!this.editor) return;
    if (this.staffPlacementId) {
      const position: StaffStartPosition = {
        staffId: this.staffPlacementId, gridX: x, gridY: y, facing: this.staffPlacementFacing, returnWhenIdle: true,
      };
      const result = this.editor.setStaffStart(position);
      if (result.ok) this.staffPlacementId = undefined;
      this.apply(result, 'Ponto inicial e direção atualizados.');
      return;
    }
    if (this.pendingDefinitionId) {
      const before = new Set(this.editor.draft.construction.placedFurniture.map((item) => item.id));
      const result = this.editor.place(this.pendingDefinitionId, x, y, 'sw', undefined, this.pendingStoredItemId);
      if (!result.ok && result.reason) result.reason = `Quadrado ${x},${y}: ${result.reason}`;
      if (result.ok) {
        this.selectedItemId = this.editor.draft.construction.placedFurniture.find((item) => !before.has(item.id))?.id;
        this.pendingDefinitionId = undefined;
        this.pendingStoredItemId = undefined;
        if (this.selectedItemId) this.editor.beginFurnitureEdit(this.selectedItemId);
      }
      this.apply(result, 'Móvel colocado.');
      return;
    }
    if (this.selectedItemId) {
      const result = this.editor.previewFurnitureMove(this.selectedItemId, x, y);
      if (!result.ok && result.reason) result.reason = `Quadrado ${x},${y}: ${result.reason}`;
      if (result.ok) this.moveMode = true;
      this.apply(result, 'Prévia reposicionada. Use ✓ para confirmar.');
      return;
    }
    this.setStatus('Escolha um móvel na loja ou selecione um item já colocado.', 'info');
  }

  private apply(result: EditorResult, success: string): void {
    if (result.ok) {
      this.status = result.warnings?.[0] ?? success;
      this.statusTone = result.warnings?.length ? 'warning' : 'success';
      if (this.selectedItemId && !this.editor?.draft.construction.placedFurniture.some((item) => item.id === this.selectedItemId)) this.selectedItemId = undefined;
    } else {
      this.status = result.reason ?? 'Não foi possível fazer essa alteração.';
      this.statusTone = 'warning';
    }
    this.render();
  }

  private setStatus(message: string, tone: 'info' | 'success' | 'warning'): void {
    this.status = message;
    this.statusTone = tone;
    this.render();
  }

  private confirmSelectedEdit(): void {
    if (!this.editor?.editSession) return;
    const result = this.editor.confirmFurnitureEdit();
    if (result.ok) { this.moveMode = false; this.selectedItemId = undefined; }
    this.apply(result, 'Posição confirmada. Móvel desselecionado.');
  }

  private cancelSelectedEdit(): void {
    if (!this.editor?.editSession) return;
    const result = this.editor.cancelFurnitureEdit();
    if (result.ok) { this.moveMode = false; this.selectedItemId = undefined; }
    this.apply(result, 'Alteração cancelada; posição original restaurada.');
  }

  private cancel(): void {
    this.editor?.cancel();
    if (this.pendingWorldCellTimer !== undefined) window.clearTimeout(this.pendingWorldCellTimer);
    this.pendingWorldCellTimer = undefined;
    gameEvents.emit('construction:preview-end', undefined);
    this.previewUnsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
    if (this.mode === 'organize') this.simulation.cancelConstructionMode();
    this.overlay?.remove();
    this.overlay = undefined;
    this.editor = undefined;
    this.originalChairLayout.clear();
  }

  private async confirm(): Promise<void> {
    if (!this.editor) return;
    const result = this.mode === 'shop' ? this.editor.confirmPurchases() : this.editor.confirm();
    if (!result.ok) {
      this.apply(result, '');
      return;
    }
    const currentChairs = new Map(this.state.construction.placedFurniture
      .filter((item) => FURNITURE_BY_ID[item.definitionId]?.functionId === 'chair')
      .map((item) => [item.id, item]));
    const movedChairIds = [...this.originalChairLayout].filter(([id, original]) => {
      const current = currentChairs.get(id);
      return !current || current.gridX !== original.gridX || current.gridY !== original.gridY || current.orientation !== original.orientation;
    }).map(([id]) => id);
    this.simulation.finalizeConstructionMode(movedChairIds);
    this.state.lastActiveAt = Date.now();
    if (this.pendingWorldCellTimer !== undefined) window.clearTimeout(this.pendingWorldCellTimer);
    this.pendingWorldCellTimer = undefined;
    gameEvents.emit('construction:preview-end', undefined);
    this.previewUnsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
    sessionStorage.setItem(CONSTRUCTION_RELOAD_SESSION_KEY, '1');
    await this.repository.save(this.state);
    const target = `${window.location.origin}${window.location.pathname}`;
    window.location.replace(target);
  }

  private async confirmExpansionAndApply(): Promise<void> {
    if (!this.editor) return;
    const result = this.editor.confirmExpansion();
    if (!result.ok) { this.apply(result, ''); return; }
    this.status = 'Expansão comprada. Atualizando o restaurante…';
    this.statusTone = 'success';
    this.render();
    await this.confirm();
  }

  private render(): void {
    if (!this.overlay || !this.editor) return;
    const draft = this.editor.draft;
    const selected = draft.construction.placedFurniture.find((item) => item.id === this.selectedItemId);
    const selectedDefinition = selected ? FURNITURE_BY_ID[selected.definitionId] : undefined;
    const editSession = this.editor.editSession;
    const selectedCounter = selected ? draft.construction.serviceCounters.find((module) => module.id === selected.id) : undefined;
    const groupedCatalog = FURNITURE_DEFINITIONS.filter((definition) => !['storage', 'refrigeration'].includes(definition.category) && definition.functionId !== 'storage')
      .filter((definition) => matchesGroup(definition.category, this.group))
      .filter((definition) => !['service.c2.left', 'service.c3.middle', 'service.c4.right'].includes(definition.id))
      .sort((left, right) => Number(left.level > this.state.restaurantLevel) - Number(right.level > this.state.restaurantLevel)
        || left.level - right.level || left.code.localeCompare(right.code, 'pt-BR'));
    const visibleCatalog = groupedCatalog.filter((definition) => CURRENT_PURCHASABLE_FURNITURE_IDS.has(definition.id));
    const unavailableCatalog = groupedCatalog.filter((definition) => !CURRENT_PURCHASABLE_FURNITURE_IDS.has(definition.id));
    const pendingExpansion = this.editor.pendingExpansion;
    const selectedPanel = selected && selectedDefinition ? `
      <article class="construction-selected">
        <img src="${thumbnail(selectedDefinition.spriteSet[selected.orientation])}" alt="" />
        <div><small>${selectedDefinition.code} · ${selectedDefinition.footprintWidth}×${selectedDefinition.footprintDepth}</small><strong>${escapeHtml(selectedDefinition.name)}</strong><span>Posição ${selected.gridX},${selected.gridY} · ${directionLabel(selected.orientation)}</span></div>
        <div class="construction-actions contextual"><button class="confirm-placement" data-editor-action="confirm-item" ${editSession?.validationState === 'invalid' ? 'disabled' : ''} aria-label="Confirmar posição">✓</button><button class="cancel-placement" data-editor-action="cancel-item" aria-label="Cancelar e restaurar">×</button><button data-editor-action="rotate">↻ Girar</button><button data-editor-action="store">Guardar</button><button data-editor-action="sell">Vender ${selectedDefinition.resaleValue}</button></div>
        ${editSession?.validationErrors.length ? `<p class="placement-error">${escapeHtml(editSession.validationErrors[0])}</p>` : ''}
        <div class="skin-actions">${selectedDefinition.skinIds.map((skin) => `<button data-editor-action="skin" data-id="${skin}" class="${selected.skinId === skin ? 'active' : ''}">${skin.replaceAll('-', ' ')}</button>`).join('')}${selectedCounter ? RECIPES.filter((recipe) => recipe.requiredLevel <= this.state.restaurantLevel).map((recipe) => `<button data-editor-action="counter-recipe" data-id="${recipe.id}" class="${selectedCounter.assignedRecipeId === recipe.id ? 'active' : ''}">${recipe.icon} ${escapeHtml(recipe.name)}</button>`).join('') : ''}</div>
      </article>` : '<div class="construction-empty-selection">Selecione um móvel colocado para editar.</div>';
    const stored = draft.construction.storedFurniture.map((item) => {
      const definition = FURNITURE_BY_ID[item.definitionId];
      return definition ? `<button class="stored-card" data-editor-action="stored" data-id="${item.id}"><img src="${thumbnail(definition.spriteSet.sw)}" alt=""/><span><b>${definition.code}</b>${escapeHtml(definition.name)}</span></button>` : '';
    }).join('');
    const selectedShopDefinition = this.selectedShopDefinitionId ? FURNITURE_BY_ID[this.selectedShopDefinitionId] : undefined;
    const pendingPurchase = this.pendingPurchaseDefinitionId ? FURNITURE_BY_ID[this.pendingPurchaseDefinitionId] : undefined;
    const shopCatalog = `
      <div class="catalog-tabs">${GROUPS.map((group) => `<button data-editor-action="category" data-id="${group.id}" class="${this.group === group.id ? 'active' : ''}">${group.label}</button>`).join('')}</div>
      <div class="catalog-items">${visibleCatalog.length ? visibleCatalog.map((definition) => `<article class="catalog-card shop-card ${this.selectedShopDefinitionId === definition.id ? 'selected' : ''}">
        <button class="shop-card-info" data-editor-action="shop-info" data-id="${definition.id}" ${definition.level > this.state.restaurantLevel ? 'disabled' : ''}><img src="${thumbnail(definition.spriteSet.sw)}" alt=""/><span><small>${definition.code} · ${definition.footprintWidth}×${definition.footprintDepth}</small><b>${escapeHtml(definition.name)}</b><em>${escapeHtml(furniturePurpose(definition.functionId))}</em></span></button>
        <p>${escapeHtml(furnitureDescription(definition.id, definition.functionId))}</p><button class="shop-buy" data-editor-action="purchase" data-id="${definition.id}" ${definition.level > this.state.restaurantLevel || draft.coins < definition.price ? 'disabled' : ''}>Comprar · ${definition.price} moedas</button>
      </article>`).join('') : '<p class="catalog-empty">Nenhum móvel funcional nesta categoria por enquanto.</p>'}</div>
      ${selectedShopDefinition ? `<section class="shop-detail"><strong>${escapeHtml(selectedShopDefinition.name)}</strong><span>${escapeHtml(furniturePurpose(selectedShopDefinition.functionId))}</span><p>${escapeHtml(furnitureDescription(selectedShopDefinition.id, selectedShopDefinition.functionId))}</p></section>` : ''}
      ${pendingPurchase ? `<div class="shop-purchase-confirm" role="dialog" aria-modal="true"><section><small>CONFIRMAR COMPRA</small><img src="${thumbnail(pendingPurchase.spriteSet.sw)}" alt=""/><strong>${escapeHtml(pendingPurchase.name)}</strong><p>${pendingPurchase.price} moedas serão descontadas uma única vez. O item ficará guardado.</p><div><button data-editor-action="cancel-purchase">Cancelar</button><button class="primary" data-editor-action="confirm-purchase">Confirmar compra</button></div></section></div>` : ''}
      ${unavailableCatalog.length ? `<details class="unavailable-catalog"><summary>Indisponíveis por enquanto (${unavailableCatalog.length})</summary><p>Alternativas sem função exclusiva nas receitas atuais.</p><div class="catalog-items unavailable-items">${unavailableCatalog.map((definition) => `<button class="catalog-card" disabled><img src="${thumbnail(definition.spriteSet.sw)}" alt=""/><span><small>${definition.code} · futuro</small><b>${escapeHtml(definition.name)}</b><em>Indisponível</em></span></button>`).join('')}</div></details>` : ''}`;
    const organizeCatalog = `<section class="organize-owned"><h2>Seus itens</h2><p>Somente móveis que você já comprou ou guardou aparecem aqui.</p><div class="stored-list">${stored || '<p>Nenhum item guardado. Compre um item na Loja para vê-lo aqui.</p>'}</div></section>`;
    const staffIds = new Set(draft.construction.staffStartPositions.map((item) => item.staffId));
    const activeStaff = [
      { id: 'player', label: this.state.profile?.name ? `${this.state.profile.name} · Jogador` : 'Jogador', assetId: playerSkinAsset(this.state.profile?.appearance) },
      ...STAFF_CATALOG.filter((staff) => staff.includedByDefault || staffIds.has(staff.id)).map((staff) => ({ id: staff.id, label: staff.label, assetId: staff.assetId })),
    ];
    const staffRoster = activeStaff.map((staff) => {
      const position = draft.construction.staffStartPositions.find((item) => item.staffId === staff.id);
      const linked = position?.linkedFurnitureId ? draft.construction.placedFurniture.find((item) => item.id === position.linkedFurnitureId) : undefined;
      return `<button class="staff-card ${this.staffPlacementId === staff.id ? 'selected' : ''}" data-editor-action="staff" data-id="${staff.id}"><img src="${thumbnail(staff.assetId)}" alt=""/><span><b>${escapeHtml(staff.label)}</b><small>${position ? linked ? `vinculado: ${escapeHtml(FURNITURE_BY_ID[linked.definitionId].name)} · quadrado ${position.gridX},${position.gridY}` : `quadrado ${position.gridX},${position.gridY} · ${directionLabel(position.facing)}` : 'definir posição'}</small></span></button>`;
    }).join('');
    const hireCards = STAFF_CATALOG.filter((staff) => !staff.includedByDefault && staff.minimumLevel <= this.state.restaurantLevel && !staffIds.has(staff.id)).map((staff) => {
      const requirement = staffFurnitureRequirement(staff.role, staff.id);
      const furniture = availableStaffFurniture(staff.role, draft.construction.placedFurniture, draft.construction.staffStartPositions, staff.id);
      return `<button class="hire-card" data-editor-action="hire-staff" data-id="${staff.id}" ${draft.coins < staff.hireCost || (requirement && !furniture) ? 'disabled' : ''}><img src="${thumbnail(staff.assetId)}" alt=""/><span><b>${escapeHtml(staff.label)}</b><small>${staff.hireCost} moedas · ${requirement ? furniture ? `${requirement} disponível` : `requer ${requirement} livre` : 'posição livre'}</small></span><em>Contratar</em></button>`;
    }).join('');
    this.overlay.innerHTML = `
      <div class="construction-shell construction-live-shell">
        <header class="construction-header"><div><small>${this.mode === 'shop' ? 'LOJA' : 'EDITAR RESTAURANTE'}</small><h1>${this.mode === 'shop' ? 'Compre para sua cozinha' : 'Posicione seus móveis'}</h1><p>${this.mode === 'shop' ? 'Compras ficam guardadas e nunca são colocadas automaticamente.' : 'Aqui aparecem somente itens que você já possui.'}</p></div><div class="construction-balance"><small>Saldo</small><strong>${draft.coins.toLocaleString('pt-BR')} moedas</strong></div></header>
        <div class="construction-toolbar">${this.mode === 'organize' ? `<button data-editor-action="undo" ${this.editor.canUndo ? '' : 'disabled'}>↶ Desfazer</button><button data-editor-action="redo" ${this.editor.canRedo ? '' : 'disabled'}>↷ Refazer</button>` : ''}<span class="construction-status ${this.statusTone}">${escapeHtml(this.status)}</span>${this.mode === 'shop' ? '<button class="primary" data-editor-action="close-shop">Fechar Loja</button>' : '<button class="secondary" data-editor-action="cancel">Cancelar</button><button class="primary" data-editor-action="confirm">Salvar edição e reabrir</button>'}</div>
        <div class="construction-workspace construction-live-workspace">
          <aside class="construction-catalog">
            ${this.mode === 'shop' ? shopCatalog : `${organizeCatalog}<section class="organize-paint-hint"><strong>Pintar o restaurante</strong><p>Use Revestimentos ao lado para aplicar uma única cor de piso em todo o espaço construído e trocar as paredes.</p></section>`}
          </aside>
          ${this.mode === 'organize' ? `<main class="construction-live-stage" aria-label="Edição diretamente no restaurante">
            <div class="construction-live-hint"><strong>Editando no próprio salão</strong><span>Toque em um móvel e depois no quadrado de destino. A prévia aparece imediatamente.</span></div>
            ${selectedPanel}
          </main>` : ''}
          <aside class="construction-options ${this.mode === 'shop' ? 'shop-hidden-options' : ''}">
            <details open><summary>Revestimentos</summary><div class="option-buttons"><button data-editor-action="surface" data-kind="floor" data-id="floor-terracotta">Piso terracota</button><button data-editor-action="surface" data-kind="floor" data-id="floor-cream">Piso creme</button><button data-editor-action="surface" data-kind="wall" data-id="wall-cream-green">Parede verde</button><button data-editor-action="surface" data-kind="wall" data-id="wall-cream-wood">Parede madeira</button></div></details>
            <details open><summary>Melhorias do restaurante</summary><p class="option-help">Cada etapa acrescenta uma área inteira de 18×18. A posição é automática para manter o formato correto.</p>${EXPANSIONS.map((expansion, index) => { const purchased = draft.construction.builtAreas.some((area) => area.expansionDefinitionId === expansion.id) && pendingExpansion?.definition.id !== expansion.id; const prerequisitesMet = expansion.prerequisites.every((id) => draft.construction.builtAreas.some((area) => area.expansionDefinitionId === id)); const shape = ['36×18 · dobro do original', 'L · três áreas originais', 'quatro áreas originais'][index]; const side = expansion.allowedSides[0]; return `<article class="expansion-card ${pendingExpansion?.definition.id === expansion.id ? 'selected' : ''}"><strong>Etapa ${index + 1} · ${shape}</strong><small>Nível ${expansion.unlockLevel} · ${expansion.coinCost.toLocaleString('pt-BR')} moedas${purchased ? ' · comprado' : ''}</small><div><button data-editor-action="expansion" data-id="${expansion.id}" data-side="${side}" class="${pendingExpansion?.definition.id === expansion.id ? 'active' : ''}" ${this.state.restaurantLevel < expansion.unlockLevel || purchased || !prerequisitesMet ? 'disabled' : ''}>${purchased ? 'Adquirida' : 'Pré-visualizar melhoria'}</button></div>${pendingExpansion?.definition.id === expansion.id ? '<div class="expansion-confirm"><button class="confirm-placement" data-editor-action="confirm-expansion" aria-label="Confirmar ampliação">✓ Comprar expansão</button><button class="cancel-placement" data-editor-action="cancel-expansion" aria-label="Cancelar ampliação">× Cancelar</button></div>' : ''}</article>`; }).join('')}</details>
            <details open><summary>Equipe e contratação</summary><p class="option-help">Funcionários vinculados ficam diante do móvel e acompanham seus movimentos automaticamente.</p><div class="staff-roster">${staffRoster}</div>${this.staffPlacementId ? `<div class="staff-facing"><small>Direção inicial</small><button data-editor-action="staff-facing" data-id="ne" class="${this.staffPlacementFacing === 'ne' ? 'active' : ''}">↗ NE</button><button data-editor-action="staff-facing" data-id="nw" class="${this.staffPlacementFacing === 'nw' ? 'active' : ''}">↖ NO</button><button data-editor-action="staff-facing" data-id="se" class="${this.staffPlacementFacing === 'se' ? 'active' : ''}">↘ SE</button><button data-editor-action="staff-facing" data-id="sw" class="${this.staffPlacementFacing === 'sw' ? 'active' : ''}">↙ SO</button></div>` : ''}${hireCards ? `<div class="hire-list"><small>Novas contratações</small>${hireCards}</div>` : '<p class="option-help">Todos os profissionais disponíveis já foram contratados.</p>'}</details>
            <div class="construction-rules"><strong>Para o salão funcionar</strong><span>• Cadeiras precisam ficar ao lado da mesa.</span><span>• A entrada e os pontos de trabalho devem ficar livres.</span><span>• Fogão, geladeira, preparo, pia e balcão são essenciais.</span></div>
          </aside>
        </div>
      </div>`;
    if (this.mode === 'organize') gameEvents.emit('construction:preview', {
      construction: draft.construction,
      selectedItemId: this.selectedItemId,
      selectedStaffId: this.staffPlacementId,
      editSession: this.editor.editSession,
      interactionMode: this.pendingDefinitionId || this.pendingStoredItemId ? 'place' : this.staffPlacementId ? 'staff' : this.selectedItemId ? 'move' : 'select',
      placementActive: Boolean(this.pendingDefinitionId || this.pendingStoredItemId || this.staffPlacementId || this.selectedItemId),
    });
  }

}

function matchesGroup(category: FurnitureCategory, group: CatalogGroup): boolean {
  if (group === 'all') return true;
  if (group === 'dining') return category === 'tables' || category === 'chairs';
  if (group === 'kitchen') return ['cooking', 'preparation', 'washing'].includes(category);
  return category === group;
}

function thumbnail(assetId: string): string { return `/assets/pixel/rendered/thumbnails/${C3_BR_LEGACY_ALIASES[assetId] ?? assetId}.png?v=${ASSET_VERSION}`; }
function escapeHtml(value: string): string { const element = document.createElement('div'); element.textContent = value; return element.innerHTML; }
function directionLabel(direction: Direction): string { return ({ ne: 'nordeste', nw: 'noroeste', se: 'sudeste', sw: 'sudoeste' } as Record<Direction, string>)[direction]; }
function furniturePurpose(functionId?: string): string {
  return ({ stove: 'Cozimento de receitas', oven: 'Assar receitas', grill: 'Grelhar receitas', cauldron: 'Cozimento em caldeira', coffee_machine: 'Preparo de bebidas', prep: 'Preparação de receitas', assembly: 'Montagem de receitas', sink: 'Limpeza de louças', pickup: 'Entrega de pratos', table: 'Atendimento aos clientes', chair: 'Assento para clientes', decoration: 'Conforto e decoração' } as Record<string, string>)[functionId ?? ''] ?? 'Equipamento do restaurante';
}
function furnitureDescription(id: string, functionId?: string): string {
  const exact: Record<string, string> = {
    'cooking.a8.coffee': 'Prepara bebidas quentes para ampliar o cardápio da cafeteria.',
    'preparation.b4.ingredients': 'Bancada de montagem para receitas compatíveis.',
    'service.c7.plates': 'Organiza pratos limpos para o serviço funcionar sem interrupções.',
    'dining.table.basic': 'Mesa robusta onde os clientes recebem e consomem os pedidos.',
    'dining.chair.basic': 'Banco robusto que deve ser colocado ao lado de uma mesa.',
  };
  return exact[id] ?? ({ stove: 'Usado para cozinhar receitas compatíveis do cardápio.', oven: 'Assa receitas que precisam de calor uniforme.', grill: 'Prepara receitas grelhadas na cozinha.', cauldron: 'Cozinha receitas em grande volume.', coffee_machine: 'Prepara bebidas quentes para os clientes.', prep: 'Oferece uma superfície segura para preparar receitas.', assembly: 'Bancada para finalizar receitas com múltiplas etapas.', sink: 'Lava a louça usada e a devolve ao fluxo de atendimento.', pickup: 'Recebe pratos prontos antes de serem levados às mesas.', table: 'Recebe os pedidos e refeições dos clientes.', chair: 'Permite que um cliente se sente junto a uma mesa.', decoration: 'Melhora o visual e deixa o salão mais acolhedor.' } as Record<string, string>)[functionId ?? ''] ?? 'Item funcional para montar e melhorar o restaurante.';
}
