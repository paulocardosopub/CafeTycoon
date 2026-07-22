import { BALANCE, GAME_VERSION } from '../config/balance';
import { INGREDIENTS, INGREDIENT_BY_ID } from '../content/ingredients/ingredients';
import { RECIPES, RECIPE_BY_ID } from '../content/recipes/recipes';
import { EQUIPMENT_ASSETS } from '../content/equipment/equipment';
import { gameEvents } from '../core/events';
import type { GameState, HelpRole, IngredientId, OfflineReport, ProfessionId, RecipeId } from '../core/types';
import { enqueueProduction, readyDishCapacity, readyDishUsed } from '../game/cooking/ProductionService';
import { canConsumeRecipe, inventoryCapacity, inventoryUsed, quotePurchase, type PurchaseMode, type PurchaseQuote } from '../game/inventory/InventoryService';
import { calculateOfflineProgress } from '../game/offline/OfflineService';
import { SAVE_RESET_SESSION_KEY, type SaveRepository } from '../game/save/SaveRepository';
import type { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';
import type { AudioService } from '../game/audio/AudioService';
import { ConstructionShop } from './ConstructionShop';
import { STAFF_BY_ID, STAFF_CANDIDATES } from '../game/data/staff';
import { cancelTraining, dismissStaff, estimatedPayrollCost, hireStaff, setStaffEnabled, startTraining } from '../game/staff/StaffService';
import { planStorageAllocation, storageCapacityByType, storageUsed } from '../game/inventory/StorageService';
import { approvePurchaseRequest, cancelPurchaseRequest, createPurchaseRequest, evaluateAutoPurchases } from '../game/inventory/ProcurementService';
import { cancelProductionPlan, createProductionPlan, pauseProductionPlan, preparedQuantity } from '../game/cooking/ProductionPlanningService';
import { FURNITURE_BY_ID } from '../game/data/furniture/catalog';
import { availableStaffFurniture, staffFurnitureRequirement } from '../game/systems/construction/StaffStartSystem';
import { recipeRequirements } from '../game/recipes/RecipeAvailability';

type PanelId = 'staff' | 'stock' | 'recipes' | 'production' | 'orders' | 'upgrades' | 'player' | 'roles' | 'professions' | 'offline' | 'settings' | 'tasks';

function playerSpriteThumb(_hairStyle: string, presentation?: string): string {
  const assetId = presentation === 'masculina' ? 'char_player_male_01' : 'char_player_female_01';
  return `/assets/pixel/rendered/thumbnails/${assetId}.png?v=0.0.7-c3-br-1`;
}

const ROLE_INFO: Record<HelpRole, { name: string; icon: string; profession: ProfessionId; text: string }> = {
  kitchen: { name: 'Cozinha', icon: '🍳', profession: 'cook', text: 'Ajuda no preparo e reduz a fila da cozinha.' },
  service: { name: 'Atendimento', icon: '🔔', profession: 'waiter', text: 'Anota pedidos, serve e recebe pagamentos.' },
  cleaning: { name: 'Limpeza', icon: '✨', profession: 'cleaner', text: 'Libera mesas para os próximos clientes.' },
  stock: { name: 'Estoque e apoio', icon: '📦', profession: 'stocker', text: 'Organiza insumos e apoia a operação.' },
};

export class GameUI {
  private activePanel?: PanelId;
  private zoom = 1;
  private latestOffline?: OfflineReport;
  private renderQueued = false;
  private technicalMode = false;
  private readonly technicalFilters = new Set(['customers', 'kitchen', 'service', 'stock', 'production', 'pathfinding', 'reservations']);
  private pendingPurchases: PurchaseQuote[] = [];
  private pendingHireId?: string;
  private pendingTrainingStaffId?: string;
  private pendingDismissStaffId?: string;
  private resetArmed = false;
  private readonly constructionShop: ConstructionShop;

  constructor(
    private readonly root: HTMLElement,
    private readonly state: GameState,
    private readonly simulation: RestaurantSimulation,
    private readonly repository: SaveRepository,
    private readonly audio: AudioService,
  ) {
    this.constructionShop = new ConstructionShop(root, state, simulation, repository);
    this.renderShell();
    this.bindEvents();
    gameEvents.on<number>('camera:zoom', (zoom) => { this.zoom = zoom; this.queueRender(); });
    gameEvents.on<{ message: string; tone: string }>('toast', ({ message, tone }) => this.toast(message, tone));
    gameEvents.on('ui:open-player', () => this.open('player'));
    gameEvents.on<boolean>('technical:changed', (enabled) => { this.technicalMode = enabled; if (this.activePanel === 'settings') this.renderPanel(); });
    setInterval(() => { this.renderDynamic(); this.refreshProductionPanel(); }, 500);
  }

  get canvasParentId(): string { return 'game-canvas'; }

  showOffline(report: OfflineReport): void {
    this.latestOffline = report;
    this.open('offline');
  }

  private renderShell(): void {
    this.root.innerHTML = `
      <div class="game-shell">
        <header class="topbar">
          <div class="game-brand"><span>✿</span><div><strong>Bistrô Bloom</strong><small>v${GAME_VERSION}</small></div></div>
          <div class="hud-stats" id="hud-stats"></div>
          <div class="speed-controls" aria-label="Velocidade do jogo">${[0, 1, 2, 4].map((speed) => `<button data-action="set-speed" data-speed="${speed}" aria-label="${speed === 0 ? 'Pausar' : `Velocidade ${speed} vezes`}">${speed === 0 ? 'Ⅱ' : `${speed}×`}</button>`).join('')}</div>
          <button class="icon-button" data-open="settings" aria-label="Configurações">⚙</button>
        </header>
        <main class="game-stage">
          <div id="game-canvas" aria-label="Restaurante isométrico"></div>
          <div class="operation-alerts" id="operation-alerts" aria-live="polite"></div>
          <section class="owner-card" id="owner-card"></section>
          <div class="shift-card"><span class="live-dot"></span><div><small>TURNO ABERTO</small><strong id="shift-customers">0 clientes no salão</strong><b id="shift-occupancy">OCUPAÇÃO: 0/10</b></div></div>
          <div class="camera-hint">Arraste para mover · Role para zoom${developmentMode() ? ' · D: modo técnico' : ''}</div>
          <div class="mobile-camera-controls" aria-label="Zoom do restaurante">
            <button data-action="camera-zoom-out" aria-label="Diminuir zoom">−</button>
            <span id="mobile-zoom">100%</span>
            <button data-action="camera-zoom-in" aria-label="Aumentar zoom">+</button>
          </div>
          <aside class="panel-host" id="panel-host" aria-live="polite"></aside>
        </main>
        <nav class="management-bar" aria-label="Gestão do restaurante">
          ${navButton('staff', '♟', 'Equipe')}${navButton('stock', '▦', 'Estoque')}${navButton('recipes', '▤', 'Receitas')}${navButton('production', '▶', 'Produção')}
          ${navButton('orders', '✎', 'Pedidos')}${navButton('upgrades', '↑', 'Melhorias')}<button data-action="open-construction"><span>▧</span><small>Organizar</small></button>${navButton('tasks', '✓', 'Tarefas')}
        </nav>
        <div class="toast-stack" id="toast-stack"></div>
      </div>`;
    this.renderDynamic();
  }

  private bindEvents(): void {
    this.root.addEventListener('click', async (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-open],[data-action]');
      if (!target) return;
      const panel = target.dataset.open as PanelId | undefined;
      if (panel) { this.open(panel); return; }
      const action = target.dataset.action;
      if (action === 'close-panel') this.close();
      else if (action === 'prepare-purchase') this.preparePurchase(target.dataset.id as IngredientId, target.dataset.mode as PurchaseMode);
      else if (action === 'prepare-chosen-purchase') this.prepareChosenPurchase(target.dataset.id as IngredientId);
      else if (action === 'prepare-critical') this.prepareBatchPurchase('critical');
      else if (action === 'prepare-pending') this.prepareBatchPurchase('pending');
      else if (action === 'confirm-purchase') this.confirmPurchase();
      else if (action === 'remove-purchase-item') { this.pendingPurchases = this.pendingPurchases.filter((quote) => quote.ingredientId !== target.dataset.id); this.renderPanel(); }
      else if (action === 'cancel-purchase') { this.pendingPurchases = []; this.renderPanel(); }
      else if (action === 'select-hire') { this.pendingHireId = target.dataset.id; this.renderPanel(); }
      else if (action === 'cancel-hire') { this.pendingHireId = undefined; this.renderPanel(); }
      else if (action === 'confirm-hire') this.confirmHire();
      else if (action === 'toggle-staff') this.toggleStaff(target.dataset.id!);
      else if (action === 'request-training') { this.pendingTrainingStaffId = target.dataset.id; this.renderPanel(); }
      else if (action === 'confirm-training') this.confirmTraining();
      else if (action === 'cancel-training') { this.pendingTrainingStaffId = undefined; this.renderPanel(); }
      else if (action === 'stop-training') this.stopTraining(target.dataset.id!);
      else if (action === 'request-dismiss') { this.pendingDismissStaffId = target.dataset.id; this.renderPanel(); }
      else if (action === 'confirm-dismiss') this.confirmDismiss();
      else if (action === 'cancel-dismiss') { this.pendingDismissStaffId = undefined; this.renderPanel(); }
      else if (action === 'locate-staff') gameEvents.emit('camera:focus-actor', target.dataset.id!);
      else if (action === 'toggle-auto-purchase') this.toggleAutoPurchase();
      else if (action === 'save-purchase-policy') this.savePurchasePolicy(target.dataset.id as IngredientId);
      else if (action === 'run-auto-purchase') { evaluateAutoPurchases(this.state, true, Date.now()); this.renderPanel(); }
      else if (action === 'toggle-recipe-serving') this.toggleRecipeServing(target.dataset.id as RecipeId);
      else if (action === 'approve-request') { approvePurchaseRequest(this.state, target.dataset.id!); this.renderPanel(); }
      else if (action === 'cancel-request') { cancelPurchaseRequest(this.state, target.dataset.id!); this.renderPanel(); }
      else if (action === 'enqueue') this.enqueue(target.dataset.id as RecipeId);
      else if (action === 'cancel-production') this.cancelProduction(target.dataset.id!);
      else if (action === 'adjust-production') this.adjustProductionQuantity(target.dataset.id as RecipeId, Number(target.dataset.amount));
      else if (action === 'create-production-plan') this.createPlan(target.dataset.id as RecipeId);
      else if (action === 'toggle-production-plan') { pauseProductionPlan(this.state, target.dataset.id!, target.dataset.enabled === 'true'); this.renderPanel(); }
      else if (action === 'cancel-production-plan') { cancelProductionPlan(this.state, target.dataset.id!, this.simulation.counterModules); this.renderPanel(); }
      else if (action === 'save-stock-target') this.saveStockTarget(target.dataset.id as RecipeId);
      else if (action === 'choose-role') this.chooseRole(target.dataset.id as HelpRole);
      else if (action === 'prioritize-task') this.prioritizeTask(target.dataset.id!);
      else if (action === 'cancel-player-task') this.cancelPlayerTask();
      else if (action === 'buy-upgrade') this.buyUpgrade(target.dataset.id as keyof GameState['upgrades']);
      else if (action === 'simulate-offline') this.simulateOffline(Number(target.dataset.seconds));
      else if (action === 'toggle-mute') { this.audio.update({ muted: !this.audio.settings.muted }); this.open('settings'); }
      else if (action === 'toggle-technical') gameEvents.emit('technical:toggle', undefined);
      else if (action === 'toggle-technical-filter') this.toggleTechnicalFilter(target.dataset.id!);
      else if (action === 'open-construction') { this.close(); this.constructionShop.open(); }
      else if (action === 'set-speed') { this.simulation.setTimeScale(Number(target.dataset.speed)); this.renderDynamic(); }
      else if (action === 'camera-zoom-out') gameEvents.emit('camera:zoom-step', -1);
      else if (action === 'camera-zoom-in') gameEvents.emit('camera:zoom-step', 1);
      else if (action === 'dev-add-customer') this.simulation.debugAddCustomer();
      else if (action === 'dev-add-group') this.simulation.debugAddGroup(4);
      else if (action === 'dev-simulate-order') this.toast(this.simulation.debugSimulateOrder() ? 'Pedido de teste criado.' : 'Não foi possível criar o pedido.', 'info');
      else if (action === 'dev-low-patience') this.simulation.debugReducePatience();
      else if (action === 'dev-dirty-seat') this.simulation.debugDirtySeat();
      else if (action === 'dev-add-stock') { for (const item of INGREDIENTS) this.state.inventory[item.id] = Math.min(item.maxStock, this.state.inventory[item.id] + item.quickBuyPackSize); this.simulation.retryBlockedOrders(); }
      else if (action === 'dev-empty-stock') { for (const item of INGREDIENTS) this.state.inventory[item.id] = this.state.inventoryReserved[item.id]; }
      else if (action === 'dev-fill-stock') { for (const item of INGREDIENTS) this.state.inventory[item.id] = item.maxStock; }
      else if (action === 'dev-swap-skins') { const next = sessionStorage.getItem('bb:visual-skin-set') === 'sage' ? 'bloom' : 'sage'; sessionStorage.setItem('bb:visual-skin-set', next); window.location.reload(); }
      else if (action === 'reset-save') { this.resetArmed = true; this.renderPanel(); }
      else if (action === 'cancel-reset') { this.resetArmed = false; this.renderPanel(); }
      else if (action === 'confirm-reset') await this.resetSave();
    });
    this.root.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      if (target.dataset.audio === 'master') { this.audio.update({ master: Number(target.value) }); this.renderSettingsValues(); }
      if (target.dataset.audio === 'effects') { this.audio.update({ effects: Number(target.value) }); this.renderSettingsValues(); }
    });
  }

  private open(panel: PanelId): void {
    this.activePanel = panel;
    this.root.querySelectorAll('[data-open]').forEach((item) => item.classList.toggle('active', (item as HTMLElement).dataset.open === panel));
    this.renderPanel();
  }

  private close(): void {
    this.activePanel = undefined;
    this.root.querySelector<HTMLElement>('#panel-host')!.innerHTML = '';
    this.root.querySelectorAll('[data-open]').forEach((item) => item.classList.remove('active'));
  }

  private queueRender(): void {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => { this.renderQueued = false; this.renderDynamic(); });
  }

  private renderDynamic(): void {
    const stock = `${inventoryUsed(this.state)}/${inventoryCapacity(this.state)}`;
    const xpStart = BALANCE.restaurantLevels[this.state.restaurantLevel - 1] ?? 0;
    const xpEnd = BALANCE.restaurantLevels[this.state.restaurantLevel] ?? BALANCE.restaurantLevels.at(-1)!;
    const xpRatio = this.state.restaurantLevel >= 3 ? 1 : (this.state.restaurantXp - xpStart) / Math.max(1, xpEnd - xpStart);
    const missing = this.simulation.missingIngredients();
    const outCount = INGREDIENTS.filter((item) => this.state.inventory[item.id] === 0).length;
    const lowCount = INGREDIENTS.filter((item) => this.state.inventory[item.id] > 0 && this.state.inventory[item.id] <= item.reorderPoint).length;
    this.root.querySelector<HTMLElement>('#hud-stats')!.innerHTML = `
      ${hudPill('coin', '●', this.state.coins.toLocaleString('pt-BR'), 'Moedas')}
      <div class="hud-pill level-pill"><span class="level-badge">${this.state.restaurantLevel}</span><div><small>NÍVEL</small><b>${this.state.restaurantXp} XP</b><i><em style="width:${Math.min(100, xpRatio * 100)}%"></em></i></div></div>
      ${hudPill('rep', '♥', `${Math.round(this.state.reputation)}%`, 'Reputação')}
      <button class="hud-pill stock ${missing.length || outCount ? 'critical' : lowCount ? 'warning' : ''}" data-open="stock"><span>▦</span><div><small>Estoque · ${lowCount} baixos</small><b>${outCount} em falta · ${stock}</b></div>${missing.length ? '<i class="alert-dot"></i>' : ''}</button>
      ${hudPill('dish', '◉', `${this.simulation.orders.filter((order) => !['consumed', 'cancelled'].includes(order.state)).length} pedidos · ${this.simulation.dishesAwaitingPickup()} retirada`, 'Operação')}${hudPill('zoom', '⌕', `${Math.round(this.zoom * 100)}%`, 'Zoom')}`;

    const alerts: string[] = [];
    if (missing.length) alerts.push('Sem ingredientes');
    if (this.simulation.stations.some((station) => station.state === 'blocked')) alerts.push('Estação bloqueada');
    if (this.simulation.counterSlots.every((slot) => slot.state !== 'free')) alerts.push('Balcão cheio');
    if (this.simulation.customers.some((customer) => customer.state === 'queueing') && this.simulation.seatedCustomerCount() >= this.simulation.totalCapacity()) alerts.push('Nenhuma mesa disponível');
    if (this.simulation.customers.some((customer) => customer.patience / customer.maxPatience <= .2)) alerts.push('Cliente perdendo paciência');
    if (readyDishUsed(this.state) >= readyDishCapacity(this.state)) alerts.push('Armazenamento cheio');
    this.root.querySelector<HTMLElement>('#operation-alerts')!.innerHTML = alerts.map((alert) => `<span>! ${alert}</span>`).join('');

    const profile = this.state.profile!;
    const role = ROLE_INFO[profile.helpRole];
    const profession = profile.professions[role.profession];
    this.root.querySelector<HTMLElement>('#owner-card')!.innerHTML = `
      <button class="owner-portrait" data-open="player" aria-label="Abrir perfil"><img src="${playerSpriteThumb(profile.appearance.hairStyle, profile.appearance.presentation)}" alt="" /><i>✦</i></button>
      <div class="owner-copy"><small>PROPRIETÁRIO · NÍVEL ${profile.level}</small><strong>${escapeHtml(profile.name)}</strong><span>${role.icon} ${role.name} · ${this.simulation.playerTaskLabel()}</span><em>Destino ${this.simulation.playerDestinationLabel()} · ${this.simulation.playerIdleReason()}</em>
        <div class="mini-progress"><i style="width:${professionProgress(profession.xp, profession.level)}%"></i></div>
      </div><button class="help-button" data-open="roles">Onde ajudar?</button>`;
    const count = this.simulation.activeCustomerCount();
    this.root.querySelector<HTMLElement>('#shift-customers')!.textContent = `${count} ${count === 1 ? 'cliente' : 'clientes'} no salão`;
    this.root.querySelector<HTMLElement>('#shift-occupancy')!.textContent = `OCUPAÇÃO: ${this.simulation.seatedCustomerCount()}/${this.simulation.totalCapacity()}`;
    this.root.querySelector<HTMLElement>('#mobile-zoom')!.textContent = `${Math.round(this.zoom * 100)}%`;
    this.root.querySelectorAll<HTMLButtonElement>('[data-action="set-speed"]').forEach((button) => button.classList.toggle('active', Number(button.dataset.speed) === this.simulation.timeScale()));
  }

  private renderPanel(): void {
    const host = this.root.querySelector<HTMLElement>('#panel-host')!;
    if (!this.activePanel) { host.innerHTML = ''; return; }
    const content = this.panelContent(this.activePanel);
    host.innerHTML = `<section class="side-panel"><header><div><small>GESTÃO DO BISTRÔ</small><h2>${content.title}</h2></div><button class="close-button" data-action="close-panel" aria-label="Fechar">×</button></header><div class="panel-body">${content.body}</div></section>`;
  }

  private panelContent(panel: PanelId): { title: string; body: string } {
    if (panel === 'staff') return { title: 'Equipe & contratação', body: this.staffPanel() };
    if (panel === 'stock') return { title: 'Estoque & compras', body: this.stockPanel() };
    if (panel === 'recipes') return { title: 'Caderno de receitas', body: this.recipesPanel() };
    if (panel === 'production') return { title: 'Produção programada', body: this.productionPanel() };
    if (panel === 'orders') return { title: 'Pedidos do salão', body: this.ordersPanel() };
    if (panel === 'upgrades') return { title: 'Melhorias', body: this.upgradesPanel() };
    if (panel === 'roles') return { title: 'Onde ajudar?', body: this.rolesPanel() };
    if (panel === 'professions') return { title: 'Profissões', body: this.professionsPanel() };
    if (panel === 'player') return { title: this.state.profile!.name, body: this.playerPanel() };
    if (panel === 'offline') return { title: 'Enquanto você esteve fora', body: this.offlinePanel() };
    if (panel === 'settings') return { title: 'Configurações', body: this.settingsPanel() };
    return { title: 'Fila de tarefas', body: this.tasksPanel() };
  }

  private staffPanel(): string {
    const payroll = estimatedPayrollCost(this.state);
    const tutorial = !this.state.tutorial006.completed && !this.state.tutorial006.dismissed
      ? `<div class="tutorial-card"><small>NOVIDADE 0.0.6</small><strong>Automatize sem perder o controle</strong><p>Gerencie a equipe, defina estoques mínimos e crie um plano de produção. Compras automáticas começam desligadas.</p></div>` : '';
    const hireConfirmation = this.pendingHireId ? (() => {
      const candidate = STAFF_BY_ID[this.pendingHireId!];
      const furniture = availableStaffFurniture(candidate.role, this.state.construction.placedFurniture, this.state.construction.staffStartPositions);
      const requirement = staffFurnitureRequirement(candidate.role);
      return `<div class="management-confirm"><strong>Confirmar contratação de ${candidate.name}</strong><p>${candidate.hiringCost} moedas agora · ${candidate.salary} por período. ${furniture ? `Será vinculado a ${escapeHtml(FURNITURE_BY_ID[furniture.definitionId].name)} e ficará diante desse móvel.` : `É necessário instalar um ${requirement ?? 'móvel compatível'} livre.`}</p><div><button data-action="cancel-hire">Cancelar</button><button data-action="confirm-hire" ${requirement && !furniture ? 'disabled' : ''}>Confirmar</button></div></div>`;
    })() : '';
    const trainingConfirmation = this.pendingTrainingStaffId ? (() => {
      const member = this.state.staff.instances.find((item) => item.id === this.pendingTrainingStaffId);
      return member ? `<div class="management-confirm"><strong>Treinar ${member.customName}?</strong><p>${BALANCE.staff.trainingCost} moedas · ${formatDuration(BALANCE.staff.trainingDurationSeconds)}. Durante esse tempo, a pessoa não trabalha.</p><div><button data-action="cancel-training">Cancelar</button><button data-action="confirm-training">Iniciar</button></div></div>` : '';
    })() : '';
    const dismissConfirmation = this.pendingDismissStaffId ? (() => {
      const member = this.state.staff.instances.find((item) => item.id === this.pendingDismissStaffId);
      return member ? `<div class="management-confirm danger"><strong>Demitir ${member.customName}?</strong><p>A pessoa só pode sair quando não estiver em uma tarefa crítica.</p><div><button data-action="cancel-dismiss">Cancelar</button><button data-action="confirm-dismiss">Demitir</button></div></div>` : '';
    })() : '';
    const staffCards = this.state.staff.instances.map((member) => {
      const definition = STAFF_BY_ID[member.definitionId];
      const actor = this.simulation.actors.find((item) => item.id === member.id);
      const schedule = this.state.staff.schedules.find((item) => item.id === member.scheduleId);
      const training = this.state.staff.training.find((item) => item.staffId === member.id && item.status === 'active');
      const trainingProgress = training ? Math.round(training.elapsedSeconds / training.durationSeconds * 100) : 0;
      const start = this.state.construction.staffStartPositions.find((item) => item.staffId === member.definitionId || item.staffId === member.id);
      const linked = start?.linkedFurnitureId ? this.state.construction.placedFurniture.find((item) => item.id === start.linkedFurnitureId) : undefined;
      return `<article class="staff-card ${member.enabled ? '' : 'paused'}"><img src="/assets/pixel/rendered/thumbnails/${definition.assetId}.png" alt="${definition.name}"/><div class="staff-main"><div><strong>${escapeHtml(member.customName)}</strong><span>${staffRoleLabel(member.role)} · Nível ${member.level}</span></div><small>${staffStateLabel(member.currentState)} · ${actor?.activity ?? 'Aguardando sincronização'}</small><div class="staff-meter"><i style="width:${Math.min(100, member.experience / Math.max(1, BALANCE.staff.levelThresholds[Math.min(member.level, BALANCE.staff.levelThresholds.length - 1)] ?? 1) * 100)}%"></i></div><p>${linked ? `Vinculado: ${escapeHtml(FURNITURE_BY_ID[linked.definitionId].name)}<br/>` : ''}Velocidade ${Math.round(definition.taskSpeed * 100)} · Qualidade ${Math.round(definition.quality * 100)} · Carga ${definition.carryingCapacity}<br/>${schedule?.name ?? 'Turno padrão'} ${schedule?.startTime ?? 8}h–${schedule?.endTime ?? 22}h · ${member.salary} moedas</p>${training ? `<em>Treinamento ${trainingProgress}% <button data-action="stop-training" data-id="${member.id}">Cancelar</button></em>` : ''}</div><div class="staff-actions"><button data-action="locate-staff" data-id="${member.id}" aria-label="Localizar ${member.customName}">⌖</button><button data-action="toggle-staff" data-id="${member.id}">${member.enabled ? 'Pausar' : 'Ativar'}</button><button data-action="request-training" data-id="${member.id}" ${training || member.currentState !== 'idle' ? 'disabled' : ''}>Treinar</button><button data-action="request-dismiss" data-id="${member.id}">Demitir</button></div></article>`;
    }).join('');
    const averages = this.state.staff.instances.length ? {
      speed: this.state.staff.instances.reduce((sum, item) => sum + STAFF_BY_ID[item.definitionId].taskSpeed, 0) / this.state.staff.instances.length,
      quality: this.state.staff.instances.reduce((sum, item) => sum + STAFF_BY_ID[item.definitionId].quality, 0) / this.state.staff.instances.length,
    } : { speed: 1, quality: 1 };
    const candidates = STAFF_CANDIDATES.filter((candidate) => this.state.staff.candidateDefinitionIds.includes(candidate.id)).map((candidate) => { const requirement = staffFurnitureRequirement(candidate.role); const furniture = availableStaffFurniture(candidate.role, this.state.construction.placedFurniture, this.state.construction.staffStartPositions); return `<article class="candidate-card"><img src="/assets/pixel/rendered/thumbnails/${candidate.assetId}.png" alt="${candidate.name}"/><div><strong>${candidate.name} <span>${staffRoleLabel(candidate.role)}</span></strong><small>Nível ${candidate.level} · ${candidate.traits.join(' · ')}</small><p>Velocidade ${Math.round(candidate.taskSpeed * 100)} ${candidate.taskSpeed >= averages.speed ? '↑' : '↓'} · Qualidade ${Math.round(candidate.quality * 100)} ${candidate.quality >= averages.quality ? '↑' : '↓'} · Carga ${candidate.carryingCapacity}</p><b>${candidate.hiringCost} agora · ${candidate.salary}/período · ${requirement ? furniture ? `${requirement} livre` : `requer ${requirement} livre` : ''}</b></div><button data-action="select-hire" data-id="${candidate.id}" ${this.state.coins < candidate.hiringCost || this.state.staff.instances.length >= this.state.staff.maxStaff || (requirement && !furniture) ? 'disabled' : ''}>Comparar e contratar</button></article>`; }).join('');
    return `${tutorial}${hireConfirmation}${trainingConfirmation}${dismissConfirmation}<div class="staff-summary"><span><small>Equipe</small><b>${this.state.staff.instances.length}/${this.state.staff.maxStaff}</b></span><span><small>Folha por período</small><b>${payroll} moedas</b></span><span><small>Próxima cobrança</small><b>${Math.max(0, Math.ceil((this.state.staff.nextPayrollAt - Date.now()) / 60000))} min</b></span></div>${this.state.staff.payrollWarnings.length ? `<div class="stop-reasons">${this.state.staff.payrollWarnings.slice(-2).map((warning) => `<span>• ${warning}</span>`).join('')}</div>` : ''}<h3>Funcionários contratados</h3><div class="staff-list">${staffCards}</div><h3>Candidatos disponíveis</h3><div class="candidate-list">${candidates || emptyState('✓', 'Equipe completa', 'Novos candidatos aparecerão em futuras renovações.')}</div>`;
  }

  private stockPanel(): string {
    const missing = new Map(this.simulation.missingIngredients().map((item) => [item.id, item]));
    const sorted = [...INGREDIENTS].sort((a, b) => stockUrgency(this.state.inventory[b.id], b.reorderPoint, missing.get(b.id)?.needed ?? 0) - stockUrgency(this.state.inventory[a.id], a.reorderPoint, missing.get(a.id)?.needed ?? 0));
    const confirmation = this.pendingPurchases.length ? `<div class="purchase-confirm"><strong>CONFIRMAR REPOSIÇÃO</strong><span>${this.pendingPurchases.reduce((sum, quote) => sum + quote.amount, 0)} unidades · ${this.pendingPurchases.reduce((sum, quote) => sum + quote.cost, 0)} moedas · ${this.pendingPurchases.reduce((sum, quote) => sum + quote.spaceNeeded, 0)} espaços</span>${this.pendingPurchases.map((quote) => `<small class="purchase-line"><span>${INGREDIENT_BY_ID[quote.ingredientId].name}: +${quote.amount} → ${quote.finalAmount}/${INGREDIENT_BY_ID[quote.ingredientId].maxStock}<br/>Destino: ${purchaseStorageSummary(this.state, quote)}</span><button data-action="remove-purchase-item" data-id="${quote.ingredientId}">Remover</button></small>`).join('')}<div><button data-action="cancel-purchase">Cancelar</button><button data-action="confirm-purchase">Comprar</button></div></div>` : '';
    const types = storageCapacityByType(this.state);
    const physical = `<div class="storage-grid">${(Object.entries(types) as [keyof typeof types, typeof types[keyof typeof types]][]).filter(([, value]) => value.max > 0).map(([type, value]) => `<span><small>${storageTypeLabel(type)}</small><b>${value.used}+${value.reserved}/${value.max}</b></span>`).join('')}</div>${this.state.storage.migrationPending ? '<div class="stop-reasons"><span>• Itens legados preservados. Adicione armazenamento compatível para liberar novas compras.</span></div>' : ''}`;
    const policies = this.state.procurement.policies.map((policy) => {
      const ingredient = INGREDIENT_BY_ID[policy.ingredientId];
      return `<article class="policy-row ${policy.enabled ? 'active' : ''}"><span>${ingredient.icon}</span><div><strong>${ingredient.name}</strong><small>${ingredient.storageType} · atual ${this.state.inventory[ingredient.id]}</small><div class="policy-inputs"><label>Mín.<input id="policy-min-${ingredient.id}" type="number" min="0" max="${ingredient.maxStock}" value="${policy.minimumStock}"/></label><label>Alvo<input id="policy-target-${ingredient.id}" type="number" min="0" max="${ingredient.maxStock}" value="${policy.targetStock}"/></label></div></div><button data-action="save-purchase-policy" data-id="${ingredient.id}">${policy.enabled ? 'Ativa' : 'Pausada'}</button></article>`;
    }).join('');
    const requests = this.state.procurement.requests.slice(-12).reverse().map((request) => `<article class="request-row ${request.status}"><div><strong>${request.lines.map((line) => `${INGREDIENT_BY_ID[line.ingredientId].icon} ${line.quantity}`).join(' · ')}</strong><small>${purchaseStatusLabel(request.status)} · ${request.totalCost} moedas · ${request.origin === 'automatic' ? 'automática' : 'manual'}</small>${request.blockedReason ? `<em>${request.blockedReason}</em>` : ''}</div><span>${request.responsibleStaffId ? this.state.staff.instances.find((item) => item.id === request.responsibleStaffId)?.customName ?? 'Equipe' : 'Aguardando'}</span>${request.status === 'pending' ? `<button data-action="approve-request" data-id="${request.id}">Aprovar</button>` : ''}${!['completed', 'cancelled', 'failed'].includes(request.status) ? `<button data-action="cancel-request" data-id="${request.id}">×</button>` : ''}</article>`).join('');
    const history = this.state.procurement.history.slice(-10).reverse().map((entry) => `<span><b>${new Date(entry.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</b>${entry.lines.map((line) => `${INGREDIENT_BY_ID[line.ingredientId].name} +${line.quantity}`).join(', ')} · ${entry.totalValue} moedas · ${entry.result}</span>`).join('');
    return `${confirmation}<div class="capacity-card"><span>Capacidade física total</span><strong>${storageUsed(this.state)} / ${inventoryCapacity(this.state)}</strong><div><i style="width:${Math.min(100, storageUsed(this.state) / Math.max(1, inventoryCapacity(this.state)) * 100)}%"></i></div></div>${physical}
      <div class="stock-actions"><button data-action="prepare-critical">Comprar críticos</button><button data-action="prepare-pending">Comprar para pedidos</button></div>
      <div class="item-list">${sorted.map((item) => {
        const amount = this.state.inventory[item.id]; const needed = missing.get(item.id)?.needed ?? 0; const status = stockStatus(amount, item.reorderPoint, needed, item.maxStock);
        const full = amount >= item.maxStock || inventoryUsed(this.state) >= inventoryCapacity(this.state);
        return `<article class="stock-row ${status.css}"><span class="item-icon">${item.icon}</span><div><strong>${item.name} <i>${status.icon} ${status.label}</i></strong><small>${amount} / ${item.maxStock} ${item.unit} · ${storageTypeLabel(item.storageType)} · pedidos: ${needed}</small><label class="chosen-target">Completar até <input id="chosen-stock-${item.id}" type="number" inputmode="numeric" min="${Math.min(item.maxStock, amount + 1)}" max="${item.maxStock}" value="${Math.max(amount, item.targetStock)}" aria-label="Estoque desejado de ${item.name}"/><button data-action="prepare-chosen-purchase" data-id="${item.id}" ${full ? 'disabled' : ''}>Adicionar</button></label></div><div class="quick-buttons"><button data-action="prepare-purchase" data-mode="pack" data-id="${item.id}" ${full || this.state.coins < item.purchasePrice ? 'disabled' : ''}>1 pacote<em>${item.purchasePrice} ●</em></button><button data-action="prepare-purchase" data-mode="target" data-id="${item.id}" ${full ? 'disabled' : ''}>Repor meta</button></div></article>`;
      }).join('')}</div><h3>Compra automática</h3><div class="automation-header"><div><strong>${this.state.procurement.globalSettings.enabled ? 'Automação contínua ativa' : 'Automação desligada'}</strong><small>Saldo protegido: ${this.state.procurement.globalSettings.protectedCashBalance} · limite por verificação: ${this.state.procurement.globalSettings.maximumSpendPerCycle} · novas tentativas automáticas</small></div><button data-action="toggle-auto-purchase">${this.state.procurement.globalSettings.enabled ? 'Desligar' : 'Ativar continuamente'}</button><button data-action="run-auto-purchase">Verificar agora</button></div><div class="policy-list">${policies}</div><h3>Lista de compras</h3><div class="request-list">${requests || emptyState('▦', 'Nada solicitado', 'Compras manuais e automáticas aparecerão aqui.')}</div><h3>Histórico</h3><div class="purchase-history">${history || '<span>Nenhuma compra concluída nesta versão.</span>'}</div>`;
  }

  private recipesPanel(): string {
    return `<div class="recipe-grid">${RECIPES.map((recipe) => {
      const locked = recipe.requiredLevel > this.state.restaurantLevel;
      const serving = this.state.enabledRecipeIds.includes(recipe.id);
      const requirements = recipeRequirements(this.state, recipe);
      const operational = requirements.every((item) => item.satisfied);
      return `<article class="recipe-card ${locked ? 'locked' : ''} ${serving ? 'serving' : 'manually-blocked'}"><div class="recipe-icon">${recipe.icon}</div><div><strong>${recipe.name}</strong><small>${recipe.description}</small></div><span>${recipe.salePrice} ● · ${recipe.experience} XP</span><div class="recipe-requirements"><small>PRÉ-REQUISITOS</small>${requirements.map((item) => `<i class="${item.satisfied ? 'ready' : 'missing'}">${item.satisfied ? '✓' : '✕'} ${escapeHtml(item.label)}</i>`).join('')}</div><ul>${recipe.steps.map((step) => `<li>${step.label} <em>${step.duration}s</em></li>`).join('')}</ul>${locked ? `<b class="lock-note">Nível ${recipe.requiredLevel}</b>` : `<p>${recipe.ingredients.map((part) => `${INGREDIENT_BY_ID[part.ingredientId].icon} ${part.amount}`).join('  ')}</p><button class="recipe-serving-toggle" data-action="toggle-recipe-serving" data-id="${recipe.id}" ${!operational ? 'disabled' : ''}>${!operational ? 'Instale os móveis necessários' : serving ? '✓ Servindo no restaurante' : 'Bloqueada para pedidos'}</button>`}</article>`;
    }).join('')}</div>`;
  }

  private productionPanel(): string {
    const plans = this.state.production.plans.slice().reverse();
    const tasks = this.state.production.tasks.filter((task) => !['completed', 'cancelled', 'failed'].includes(task.state));
    return `<p class="panel-intro">Crie planos de até 999 unidades. Pedidos de clientes continuam na frente da produção preventiva.</p>
      <div class="ready-strip">${RECIPES.map((recipe) => `<span data-ready-id="${recipe.id}">${recipe.icon}<b>${preparedQuantity(this.simulation.counterModules, recipe.id) + this.state.readyDishes[recipe.id]}</b></span>`).join('')}<small>${this.simulation.counterModules.reduce((sum, module) => sum + module.currentQuantity, 0)} pratos nos balcões</small></div>
      <h3>Novo plano</h3><div class="production-planner">${RECIPES.filter((recipe) => recipe.requiredLevel <= this.state.restaurantLevel).map((recipe) => `<article><header><span>${recipe.icon}</span><div><strong>${recipe.name}</strong><small>${recipe.ingredients.map((part) => `${INGREDIENT_BY_ID[part.ingredientId].icon}${part.amount}`).join(' ')} · ${recipe.steps.reduce((sum, step) => sum + step.duration, 0)}s/un.</small></div></header><div class="quantity-control"><input id="qty-${recipe.id}" type="number" inputmode="numeric" min="1" max="999" value="10" aria-label="Quantidade de ${recipe.name}"/><button data-action="adjust-production" data-id="${recipe.id}" data-amount="1">+1</button><button data-action="adjust-production" data-id="${recipe.id}" data-amount="10">+10</button><button data-action="adjust-production" data-id="${recipe.id}" data-amount="50">+50</button><button data-action="adjust-production" data-id="${recipe.id}" data-amount="999">Máx.</button></div><div class="plan-options"><label>Lote<input id="batch-${recipe.id}" type="number" inputmode="numeric" min="1" max="50" value="10"/></label><label>Modo<select id="mode-${recipe.id}"><option value="fixedQuantity">Quantidade fixa</option><option value="singleBatch">Lote único</option><option value="repeatWhileResources">Repetir com recursos</option></select></label><label>Prioridade<input id="priority-${recipe.id}" type="number" min="1" max="90" value="50"/></label></div><button class="primary-button" data-action="create-production-plan" data-id="${recipe.id}">Programar produção</button></article>`).join('')}</div>
      <h3>Estoque-alvo por receita</h3><div class="target-list">${this.state.production.stockTargets.map((target) => `<article><span>${RECIPE_BY_ID[target.recipeId].icon}</span><div><strong>${RECIPE_BY_ID[target.recipeId].name}</strong><small>Físico ${preparedQuantity(this.simulation.counterModules, target.recipeId)} · em produção ${this.state.production.tasks.filter((task) => task.recipeId === target.recipeId && !['completed', 'cancelled', 'failed'].includes(task.state)).reduce((sum, task) => sum + task.batchQuantity, 0)}</small><div><label>Mín.<input id="target-min-${target.recipeId}" type="number" min="0" max="999" value="${target.minimumPrepared}"/></label><label>Alvo<input id="target-goal-${target.recipeId}" type="number" min="0" max="999" value="${target.targetPrepared}"/></label></div></div><button data-action="save-stock-target" data-id="${target.recipeId}">${target.enabled ? 'Ativo' : 'Pausado'}</button></article>`).join('')}</div>
      <h3>Planos ativos</h3><div class="plan-list">${plans.length ? plans.map((plan) => { const planTasks = this.state.production.tasks.filter((task) => task.productionPlanId === plan.id); const complete = planTasks.filter((task) => task.state === 'completed').reduce((sum, task) => sum + task.batchQuantity, 0); return `<article><span>${RECIPE_BY_ID[plan.recipeId].icon}</span><div><strong>${RECIPE_BY_ID[plan.recipeId].name} · ${plan.mode === 'maintainTarget' ? 'estoque-alvo' : `${plan.currentProgress}/${plan.targetQuantity}`}</strong><small>Lotes de ${plan.batchSize} · prioridade ${plan.priority} · ${planTasks.length} lotes</small><i><em style="width:${plan.mode === 'maintainTarget' ? Math.min(100, preparedQuantity(this.simulation.counterModules, plan.recipeId) / Math.max(1, plan.targetQuantity) * 100) : Math.min(100, complete / Math.max(1, plan.targetQuantity) * 100)}%"></em></i></div><button data-action="toggle-production-plan" data-id="${plan.id}" data-enabled="${!plan.enabled}">${plan.enabled ? 'Pausar' : 'Retomar'}</button><button data-action="cancel-production-plan" data-id="${plan.id}">×</button></article>`; }).join('') : emptyState('☕', 'Nenhum plano', 'Defina quantidade, lote e prioridade para começar.')}</div>
      <h3>Fila dividida em lotes</h3><div class="production-task-list">${tasks.length ? tasks.slice(0, 60).map((task, index) => `<article><b>${index + 1}</b><div><strong>${RECIPE_BY_ID[task.recipeId].icon} ${task.batchQuantity} unidades</strong><small>${productionTaskStatusLabel(task.state)}${task.blockedReason ? ` · ${task.blockedReason}` : ''}</small></div><span>${task.workSlotId ?? 'Aguardando WorkSlot'}</span></article>`).join('') : emptyState('✓', 'Fila livre', 'Todos os lotes foram concluídos ou ainda não há planos.')}</div>`;
  }

  private refreshProductionPanel(): void {
    if (this.activePanel !== 'production') return;
    for (const recipe of RECIPES) {
      const cell = this.root.querySelector<HTMLElement>(`[data-ready-id="${recipe.id}"] b`);
      if (cell) cell.textContent = String(preparedQuantity(this.simulation.counterModules, recipe.id) + this.state.readyDishes[recipe.id]);
    }
    const capacity = this.root.querySelector<HTMLElement>('.ready-strip > small');
    if (capacity) capacity.textContent = `${this.simulation.counterModules.reduce((sum, module) => sum + module.currentQuantity, 0)} pratos nos balcões`;
  }

  private ordersPanel(): string {
    const active = this.simulation.orders.filter((order) => !['consumed', 'cancelled'].includes(order.state));
    return active.length ? `<div class="order-list">${active.map((order) => { const recipe = RECIPE_BY_ID[order.recipeId]; const customer = this.simulation.customers.find((item) => item.id === order.customerId); return `<article><span>${recipe.icon}</span><div><strong>${recipe.name} × ${order.quantity}</strong><small>${orderState(order.state)} · ${customer ? this.simulation.customerLabel(customer) : ''}</small></div><b>${order.stepIndex}/${recipe.steps.length}</b></article>`; }).join('')}</div>` : emptyState('✓', 'Nenhum pedido pendente', 'A equipe está em dia com o salão.') ;
  }

  private upgradesPanel(): string {
    const items: { id: keyof GameState['upgrades']; icon: string; name: string; text: string }[] = [
      { id: 'inventory', icon: '▦', name: 'Despensa ampliada', text: `+${BALANCE.upgrades.inventory.amount} espaços no estoque` },
      { id: 'dishStorage', icon: '◉', name: 'Prateleira térmica', text: `+${BALANCE.upgrades.dishStorage.amount} pratos prontos` },
      { id: 'stationSpeed', icon: '⚡', name: 'Utensílios eficientes', text: `${Math.round(BALANCE.upgrades.stationSpeed.amount * 100)}% mais rapidez nas estações` },
    ];
    const equipment = EQUIPMENT_ASSETS.map((item) => `<article class="equipment-card"><img src="/assets/pixel/rendered/thumbnails/${item.assetId}.png" alt="${item.name}"/><div><strong>${item.name}</strong><small>Nível visual 1 · ${item.footprint.width}×${item.footprint.depth}</small></div></article>`).join('');
    return `<p class="panel-intro">Melhorias permanentes para este restaurante.</p><div class="upgrade-list">${items.map((item) => { const level = this.state.upgrades[item.id]; const config = BALANCE.upgrades[item.id]; const cost = config.baseCost * (level + 1); return `<article><span>${item.icon}</span><div><strong>${item.name}</strong><small>${item.text}</small><em>Nível ${level}</em></div><button data-action="buy-upgrade" data-id="${item.id}" ${this.state.coins < cost || level >= 3 ? 'disabled' : ''}>${level >= 3 ? 'Máximo' : `${cost} ●`}</button></article>`; }).join('')}</div><h3>Equipamentos instalados</h3><p class="panel-intro">Visuais Blender ativos nesta versão. Os próximos níveis ainda não estão disponíveis.</p><div class="equipment-catalog">${equipment}</div>`;
  }

  private rolesPanel(): string {
    const current = this.state.profile!.helpRole;
    return `<p class="panel-intro">Seu personagem conclui uma tarefa por vez dentro da prioridade escolhida.</p><div class="role-list">${(Object.entries(ROLE_INFO) as [HelpRole, typeof ROLE_INFO[HelpRole]][]).map(([id, role]) => `<button data-action="choose-role" data-id="${id}" class="role-card ${current === id ? 'selected' : ''}"><span>${role.icon}</span><div><strong>${role.name}</strong><small>${role.text}</small></div>${current === id ? '<b>ATUAL</b>' : '<i>Escolher</i>'}</button>`).join('')}</div>`;
  }

  private professionsPanel(): string {
    const profile = this.state.profile!;
    return `<div class="profession-list">${(Object.entries(ROLE_INFO) as [HelpRole, typeof ROLE_INFO[HelpRole]][]).map(([, role]) => { const progress = profile.professions[role.profession]; return `<article><span>${role.icon}</span><div><strong>${role.name} · Nível ${progress.level}</strong><small>${progress.tasksCompleted} tarefas concluídas · ${progress.xp} XP</small><i><em style="width:${professionProgress(progress.xp, progress.level)}%"></em></i><p>Bônus atual: +${(progress.level - 1) * 8}% de velocidade</p></div></article>`; }).join('')}</div>`;
  }

  private playerPanel(): string {
    const profile = this.state.profile!; const role = ROLE_INFO[profile.helpRole];
    const totalTasks = Object.values(profile.taskHistory).reduce((sum, value) => sum + value, 0);
    return `<div class="profile-hero"><div class="large-portrait"><img src="${playerSpriteThumb(profile.appearance.hairStyle, profile.appearance.presentation)}" alt="Sprite de ${escapeHtml(profile.name)}" /></div><div><small>PROPRIETÁRIO DO BISTRÔ</small><h3>${escapeHtml(profile.name)}</h3><p>Nível geral ${profile.level} · ${profile.xp} XP</p></div></div>
      <div class="profile-stats"><span><small>Função atual</small><b>${role.icon} ${role.name}</b></span><span><small>Tarefa atual</small><b>${this.simulation.playerTaskLabel()}</b></span><span><small>Tarefas feitas</small><b>${totalTasks}</b></span></div>
      <div class="button-stack"><button class="primary-button" data-open="roles">Onde ajudar?</button><button class="secondary-button" data-open="professions">Ver profissões e bônus</button></div>
      <div class="future-note">Personalização adicional e cosméticos serão expandidos em versões futuras.</div>`;
  }

  private tasksPanel(): string {
    const role = this.state.profile!.helpRole;
    const tasks = this.simulation.tasks.list();
    const player = this.simulation.actors.find((actor) => actor.kind === 'player')!;
    return `<div class="current-task"><small>SUA PRIORIDADE</small><strong>${ROLE_INFO[role].icon} ${ROLE_INFO[role].name}</strong><span>${player.activity} · destino ${this.simulation.playerDestinationLabel()}</span>${player.taskId ? '<button data-action="cancel-player-task">Cancelar se ainda não iniciou</button>' : ''}</div>
      ${tasks.length ? `<div class="task-list">${tasks.map((task) => `<article class="${task.role === role ? '' : 'muted'}"><span>${taskIcon(task.kind)}</span><div><strong>${taskLabel(task.kind)}</strong><small>${ROLE_INFO[task.role].name} · ${taskStatusLabel(task.status)} · espera ${Math.floor(task.waitSeconds)}s</small></div>${task.status === 'pending' && task.role === role ? `<button data-action="prioritize-task" data-id="${task.id}">Fazer agora</button>` : `<i>${task.assignedActorId ? '✓' : '—'}</i>`}</article>`).join('')}</div>` : emptyState('✓', 'Nenhuma tarefa aguardando', 'A operação está tranquila neste momento.')}`;
  }

  private offlinePanel(): string {
    const report = this.latestOffline;
    if (!report) return `<p class="panel-intro">O progresso ausente é calculado automaticamente ao voltar ao bistrô, com limite de 8 horas.</p>${this.devTimeButtons()}`;
    const produced = Object.entries(report.produced).map(([id, amount]) => `${RECIPE_BY_ID[id as RecipeId].icon} ${amount}`).join('  ') || 'Nenhum';
    const sold = Object.entries(report.sold).map(([id, amount]) => `${RECIPE_BY_ID[id as RecipeId].icon} ${amount}`).join('  ') || 'Nenhum';
    return `<div class="offline-hero"><span>☀</span><div><small>TEMPO AUSENTE</small><strong>${formatDuration(report.absentSeconds)}</strong><p>${formatDuration(report.calculatedSeconds)} calculadas ${report.capped ? '· limite aplicado' : ''}</p></div></div>
      <div class="report-grid"><span><small>Produzidos</small><b>${produced}</b></span><span><small>Vendidos</small><b>${sold}</b></span><span><small>Receita bruta</small><b>${report.grossRevenue} ●</b></span><span><small>Compras</small><b>−${report.purchaseCosts} ●</b></span><span><small>Salários</small><b>−${report.salariesCharged} ●</b></span><span><small>Lucro líquido</small><b>${report.netProfit >= 0 ? '+' : ''}${report.netProfit} ●</b></span><span><small>Experiência</small><b>+${report.experience} XP</b></span><span><small>Bloqueios</small><b>${report.blockedTasks.length}</b></span></div>
      <article class="character-report"><span>${ROLE_INFO[report.characterRole].icon}</span><div><strong>${this.state.profile!.name} ajudou em ${ROLE_INFO[report.characterRole].name}</strong><small>${report.characterTasks} tarefas estimadas · +${report.characterGeneralXp} XP geral · +${report.characterProfessionXp} XP profissional</small><p>Bônus aplicado: ${report.bonusPercent}% · sem tarefas/bloqueado: ${formatDuration(report.idleSeconds)}</p></div></article>
      ${report.stoppedReasons.length ? `<div class="stop-reasons"><strong>Observações</strong>${report.stoppedReasons.map((reason) => `<span>• ${reason}</span>`).join('')}</div>` : ''}
      ${developmentMode() ? `<h3>Ferramentas de desenvolvimento</h3>${this.devTimeButtons()}` : ''}`;
  }

  private devTimeButtons(): string {
    if (!developmentMode()) return '';
    return `<div class="dev-times"><button data-action="simulate-offline" data-seconds="600">10 min</button><button data-action="simulate-offline" data-seconds="3600">1 h</button><button data-action="simulate-offline" data-seconds="14400">4 h</button><button data-action="simulate-offline" data-seconds="28800">8 h</button><button data-action="simulate-offline" data-seconds="36000">10 h → limite</button></div>`;
  }

  private settingsPanel(): string {
    return `<div class="settings-list"><label><span>Volume geral <b data-audio-value="master">${Math.round(this.audio.settings.master * 100)}%</b></span><input data-audio="master" type="range" min="0" max="1" step="0.05" value="${this.audio.settings.master}" /></label><label><span>Efeitos <b data-audio-value="effects">${Math.round(this.audio.settings.effects * 100)}%</b></span><input data-audio="effects" type="range" min="0" max="1" step="0.05" value="${this.audio.settings.effects}" /></label><button class="secondary-button" data-action="toggle-mute">${this.audio.settings.muted ? 'Ativar áudio' : 'Silenciar tudo'}</button>${developmentMode() ? `<button class="secondary-button" data-action="toggle-technical">${this.technicalMode ? 'Desativar' : 'Ativar'} modo técnico</button>` : ''}</div>
      <div class="settings-section"><h3>Progresso offline</h3><p>O cálculo usa no máximo 8 horas e respeita ingredientes, fila e capacidade.</p>${developmentMode() ? '<button class="secondary-button" data-open="offline">Abrir simulador</button>' : ''}</div>
      ${developmentMode() ? `<div class="settings-section"><h3>Filtros do modo técnico</h3><div class="dev-times">${[['customers','Clientes'],['kitchen','Cozinha'],['service','Serviço'],['stock','Estoque'],['production','Produção'],['pathfinding','Pathfinding'],['reservations','Reservas']].map(([id,label]) => `<button data-action="toggle-technical-filter" data-id="${id}" class="${this.technicalFilters.has(id) ? 'active' : ''}">${label}</button>`).join('')}</div><h3>Painel de desenvolvimento</h3><div class="dev-times"><button data-action="dev-add-customer">+ cliente</button><button data-action="dev-add-group">+ grupo 4</button><button data-action="dev-simulate-order">Simular pedido</button><button data-action="dev-low-patience">Paciência baixa</button><button data-action="dev-dirty-seat">Sujar lugar</button><button data-action="dev-add-stock">+ ingredientes</button><button data-action="dev-empty-stock">Esvaziar estoque</button><button data-action="dev-fill-stock">Preencher estoque</button><button data-action="dev-swap-skins">Trocar conjunto visual</button></div><p>Modo técnico: grade, rotas, reservas e troca de skins sem alterar footprints.</p></div>` : ''}
      <div class="danger-zone"><h3>Recomeçar</h3><p>Apaga o restaurante, personagem e todo o progresso deste dispositivo.</p>${this.resetArmed
        ? '<strong>Esta ação não pode ser desfeita.</strong><div class="button-stack"><button data-action="confirm-reset">Confirmar e recomeçar</button><button class="secondary-button" data-action="cancel-reset">Cancelar</button></div>'
        : '<button data-action="reset-save">Apagar save…</button>'}</div>`;
  }

  private renderSettingsValues(): void {
    const master = this.root.querySelector<HTMLElement>('[data-audio-value="master"]'); const effects = this.root.querySelector<HTMLElement>('[data-audio-value="effects"]');
    if (master) master.textContent = `${Math.round(this.audio.settings.master * 100)}%`;
    if (effects) effects.textContent = `${Math.round(this.audio.settings.effects * 100)}%`;
  }

  private toggleTechnicalFilter(id: string): void {
    if (this.technicalFilters.has(id)) this.technicalFilters.delete(id); else this.technicalFilters.add(id);
    gameEvents.emit('technical:filters', [...this.technicalFilters]); this.renderPanel();
  }

  private confirmHire(): void {
    if (!this.pendingHireId) return;
    const result = hireStaff(this.state, this.pendingHireId, undefined, Date.now());
    if (!result.ok) { this.toast(result.reason ?? 'Não foi possível contratar.', 'warning'); return; }
    this.pendingHireId = undefined; this.simulation.syncStaffRoster();
    this.toast(`${result.instance!.customName} entrou para a equipe.`, 'success'); this.renderPanel();
  }

  private toggleStaff(staffId: string): void {
    const member = this.state.staff.instances.find((item) => item.id === staffId); if (!member) return;
    const result = setStaffEnabled(this.state, staffId, !member.enabled, Date.now());
    this.toast(result.ok ? `${member.customName}: ${member.enabled ? 'ativo' : 'pausado'}.` : result.reason ?? 'Ação indisponível.', result.ok ? 'info' : 'warning'); this.renderPanel();
  }

  private confirmTraining(): void {
    if (!this.pendingTrainingStaffId) return;
    const result = startTraining(this.state, this.pendingTrainingStaffId, Date.now());
    if (result.ok) this.pendingTrainingStaffId = undefined;
    this.toast(result.ok ? 'Treinamento iniciado.' : result.reason ?? 'Treinamento indisponível.', result.ok ? 'success' : 'warning'); this.renderPanel();
  }

  private stopTraining(staffId: string): void {
    const result = cancelTraining(this.state, staffId, Date.now());
    this.toast(result.ok ? 'Treinamento cancelado.' : result.reason ?? 'Ação indisponível.', result.ok ? 'info' : 'warning'); this.renderPanel();
  }

  private confirmDismiss(): void {
    if (!this.pendingDismissStaffId) return;
    const result = dismissStaff(this.state, this.pendingDismissStaffId, Date.now());
    if (result.ok) { this.pendingDismissStaffId = undefined; this.simulation.syncStaffRoster(); }
    this.toast(result.ok ? 'Funcionário removido da equipe.' : result.reason ?? 'Demissão indisponível.', result.ok ? 'info' : 'warning'); this.renderPanel();
  }

  private preparePurchase(id: IngredientId, mode: PurchaseMode): void {
    const quote = quotePurchase(this.state, id, mode);
    if (!quote.ok) { this.toast(quote.reason ?? 'Não foi possível preparar a compra.', 'warning'); return; }
    this.pendingPurchases = [quote]; this.renderPanel();
  }

  private prepareChosenPurchase(id: IngredientId): void {
    const ingredient = INGREDIENT_BY_ID[id];
    const desired = Math.max(this.state.inventory[id] + 1, Math.min(ingredient.maxStock, Math.floor(Number(this.root.querySelector<HTMLInputElement>(`#chosen-stock-${id}`)?.value) || 0)));
    const amount = desired - this.state.inventory[id];
    const storage = planStorageAllocation(this.state, id, amount);
    const packs = Math.ceil(amount / ingredient.quickBuyPackSize);
    const cost = packs * ingredient.purchasePrice;
    if (!storage.ok || cost > this.state.coins) { this.toast(storage.reason ?? 'Moedas insuficientes.', 'warning'); return; }
    this.pendingPurchases = [{ ok: true, ingredientId: id, amount, packs, cost, finalAmount: desired, spaceNeeded: amount * ingredient.storageSize }];
    this.renderPanel();
  }

  private prepareBatchPurchase(kind: 'critical' | 'pending'): void {
    const missingIds = new Set(this.simulation.missingIngredients().map((item) => item.id));
    const ids = INGREDIENTS.filter((item) => kind === 'pending' ? missingIds.has(item.id) : missingIds.has(item.id) || this.state.inventory[item.id] <= item.reorderPoint).map((item) => item.id);
    const quotes: PurchaseQuote[] = [];
    let quotedCost = 0;
    for (const id of ids) {
      const quote = quotePurchase(this.state, id, kind === 'pending' ? 'minimum' : 'target');
      if (quote.ok && quotedCost + quote.cost <= this.state.coins) { quotes.push(quote); quotedCost += quote.cost; }
    }
    if (!quotes.length) { this.toast('Nenhuma compra necessária ou possível.', 'info'); return; }
    this.pendingPurchases = quotes; this.renderPanel();
  }

  private confirmPurchase(): void {
    if (!this.pendingPurchases.length) return;
    const result = createPurchaseRequest(this.state, this.pendingPurchases.map((quote) => ({ ingredientId: quote.ingredientId, quantity: quote.amount })), 'manual', 'Reposição manual confirmada pelo jogador.', 90, Date.now());
    if (result.ok) this.pendingPurchases = [];
    this.toast(result.ok ? 'Compra aprovada. O estoquista levará os ingredientes ao armazenamento.' : result.reason ?? 'A compra não pôde ser concluída.', result.ok ? 'success' : 'warning');
    this.renderDynamic(); this.renderPanel();
  }

  private toggleAutoPurchase(): void {
    const next = !this.state.procurement.globalSettings.enabled;
    this.state.procurement.globalSettings.enabled = next;
    if (next) {
      this.state.tutorial006.automationUnlocked = true;
      // The global switch must activate the stocker's ingredient policies too.
      for (const policy of this.state.procurement.policies) policy.enabled = true;
      evaluateAutoPurchases(this.state, true, Date.now());
      this.toast('Automação contínua ativada. O estoquista tentará novamente sempre que necessário.', 'success');
    } else this.toast('Automação de compras pausada.', 'info');
    this.renderPanel();
  }

  private toggleRecipeServing(id: RecipeId): void {
    const enabled = new Set(this.state.enabledRecipeIds);
    if (enabled.has(id)) enabled.delete(id); else enabled.add(id);
    this.state.enabledRecipeIds = RECIPES.filter((recipe) => enabled.has(recipe.id)).map((recipe) => recipe.id);
    this.toast(`${RECIPE_BY_ID[id].name}: ${enabled.has(id) ? 'liberada para novos pedidos' : 'bloqueada para novos pedidos'}.`, 'info');
    this.renderPanel();
  }

  private savePurchasePolicy(id: IngredientId): void {
    const policy = this.state.procurement.policies.find((item) => item.ingredientId === id); if (!policy) return;
    const ingredient = INGREDIENT_BY_ID[id];
    const minimum = Math.max(0, Math.min(ingredient.maxStock, Math.floor(Number(this.root.querySelector<HTMLInputElement>(`#policy-min-${id}`)?.value) || 0)));
    const target = Math.max(minimum, Math.min(ingredient.maxStock, Math.floor(Number(this.root.querySelector<HTMLInputElement>(`#policy-target-${id}`)?.value) || 0)));
    policy.minimumStock = minimum; policy.targetStock = target; policy.enabled = !policy.enabled;
    this.toast(`${ingredient.name}: política ${policy.enabled ? 'ativada' : 'pausada'} (${minimum} → ${target}).`, 'info'); this.renderPanel();
  }

  private enqueue(id: RecipeId): void {
    const input = this.root.querySelector<HTMLInputElement>(`#qty-${id}`); const quantity = Math.max(1, Math.min(20, Number(input?.value) || 1)); const recipe = RECIPE_BY_ID[id];
    if (readyDishUsed(this.state) >= readyDishCapacity(this.state)) { this.toast('O armazenamento de pratos está cheio.', 'warning'); return; }
    if (!canConsumeRecipe(this.state, recipe, quantity)) { this.toast('Não há ingredientes para toda essa produção.', 'warning'); return; }
    enqueueProduction(this.state, id, quantity); this.toast(`${quantity}× ${recipe.name} adicionado à fila.`, 'success'); this.renderPanel();
  }

  private adjustProductionQuantity(id: RecipeId, amount: number): void {
    const input = this.root.querySelector<HTMLInputElement>(`#qty-${id}`); if (!input) return;
    input.value = String(amount >= 999 ? 999 : Math.max(1, Math.min(999, Math.floor(Number(input.value) || 1) + amount)));
  }

  private createPlan(id: RecipeId): void {
    const quantity = Math.floor(Number(this.root.querySelector<HTMLInputElement>(`#qty-${id}`)?.value) || 0);
    const batchSize = Math.floor(Number(this.root.querySelector<HTMLInputElement>(`#batch-${id}`)?.value) || 0);
    const priority = Math.floor(Number(this.root.querySelector<HTMLInputElement>(`#priority-${id}`)?.value) || 50);
    const mode = this.root.querySelector<HTMLSelectElement>(`#mode-${id}`)?.value as 'singleBatch' | 'fixedQuantity' | 'repeatWhileResources';
    const result = createProductionPlan(this.state, { recipeId: id, targetQuantity: quantity, batchSize, priority, mode, repeat: mode === 'repeatWhileResources' }, Date.now());
    if (result.ok) {
      this.state.tutorial006.currentStep = Math.max(this.state.tutorial006.currentStep, 8);
      this.toast(`${quantity} unidades divididas em lotes de ${result.plan!.batchSize}.`, 'success');
    } else this.toast(result.reason ?? 'Plano inválido.', 'warning');
    this.renderPanel();
  }

  private saveStockTarget(id: RecipeId): void {
    const target = this.state.production.stockTargets.find((item) => item.recipeId === id); if (!target) return;
    const minimum = Math.max(0, Math.min(999, Math.floor(Number(this.root.querySelector<HTMLInputElement>(`#target-min-${id}`)?.value) || 0)));
    const goal = Math.max(minimum, Math.min(999, Math.floor(Number(this.root.querySelector<HTMLInputElement>(`#target-goal-${id}`)?.value) || 0)));
    target.minimumPrepared = minimum; target.targetPrepared = goal; target.maximumPrepared = Math.max(goal, target.maximumPrepared); target.enabled = !target.enabled;
    this.toast(`${RECIPE_BY_ID[id].name}: estoque-alvo ${target.enabled ? 'ativado' : 'pausado'} em ${goal}.`, 'info'); this.renderPanel();
  }

  private cancelProduction(id: string): void {
    const index = this.state.productionQueue.findIndex((item) => item.id === id && !item.ingredientsCommitted);
    if (index < 0) { this.toast('Essa unidade já está em preparo.', 'warning'); return; }
    this.state.productionQueue.splice(index, 1); this.toast('Item removido da fila.', 'info'); this.renderPanel();
  }

  private chooseRole(role: HelpRole): void { this.simulation.setPlayerRole(role); this.open('tasks'); }
  private prioritizeTask(id: string): void { this.toast(this.simulation.prioritizeForPlayer(id) ? 'Tarefa colocada como prioridade.' : 'A tarefa não está mais disponível.', 'info'); this.renderPanel(); }
  private cancelPlayerTask(): void { this.toast(this.simulation.cancelPlayerPendingTask() ? 'Tarefa devolvida à fila.' : 'A tarefa já começou e será concluída.', 'info'); this.renderPanel(); }

  private buyUpgrade(id: keyof GameState['upgrades']): void {
    const level = this.state.upgrades[id]; const config = BALANCE.upgrades[id]; const cost = config.baseCost * (level + 1);
    if (level >= 3 || this.state.coins < cost) return;
    this.state.coins -= cost; this.state.upgrades[id] += 1; this.toast('Melhoria instalada!', 'success'); this.renderDynamic(); this.renderPanel();
  }

  private simulateOffline(seconds: number): void {
    const now = Date.now(); this.state.lastActiveAt = now - seconds * 1000; this.state.offlineClaimId = '';
    this.latestOffline = calculateOfflineProgress(this.state, now); void this.repository.save(this.state); this.open('offline');
  }

  private async resetSave(): Promise<void> {
    sessionStorage.setItem(SAVE_RESET_SESSION_KEY, '1');
    await this.repository.clear();
    window.location.reload();
  }

  private toast(message: string, tone = 'info'): void {
    const stack = this.root.querySelector<HTMLElement>('#toast-stack'); if (!stack) return;
    const item = document.createElement('div'); item.className = `toast ${tone}`; item.textContent = message; stack.append(item);
    setTimeout(() => item.classList.add('leaving'), 3200); setTimeout(() => item.remove(), 3600);
  }
}

function navButton(id: PanelId, icon: string, label: string): string { return `<button data-open="${id}"><span>${icon}</span><small>${label}</small></button>`; }
function hudPill(css: string, icon: string, value: string, label: string): string { return `<div class="hud-pill ${css}"><span>${icon}</span><div><small>${label}</small><b>${value}</b></div></div>`; }
function emptyState(icon: string, title: string, text: string): string { return `<div class="empty-state"><span>${icon}</span><strong>${title}</strong><p>${text}</p></div>`; }
function escapeHtml(value: string): string { const element = document.createElement('div'); element.textContent = value; return element.innerHTML; }
function statusLabel(status: string): string { return ({ queued: 'Na fila', producing: 'Em preparo', blocked_ingredients: 'Sem ingredientes', blocked_storage: 'Armazenamento cheio' } as Record<string, string>)[status] ?? status; }
function orderState(state: string): string { return ({ requested: 'Solicitado', awaiting_ingredients: 'Sem ingredientes', awaiting_station: 'Aguardando estação', preparing: 'Em preparo', awaiting_pickup: 'No balcão', transporting: 'Em transporte', delivered: 'Entregue', consumed: 'Consumido', cancelled: 'Cancelado' } as Record<string, string>)[state] ?? state; }
function taskStatusLabel(state: string): string { return ({ pending: 'Pendente', reserved: 'Reservada', moving: 'Em deslocamento', executing: 'Em execução', blocked: 'Bloqueada', completed: 'Concluída', cancelled: 'Cancelada' } as Record<string, string>)[state] ?? state; }
function taskIcon(kind: string): string { return ({ take_order: '✎', cook_step: '🍳', deliver: '🔔', payment: '●', clean: '✨', stock_support: '▦', restock_purchase: '📦', production_batch: '▶' } as Record<string, string>)[kind] ?? '•'; }
function taskLabel(kind: string): string { return ({ take_order: 'Anotar pedido', cook_step: 'Preparar receita', deliver: 'Entregar prato', payment: 'Receber pagamento', clean: 'Limpar mesa', stock_support: 'Apoiar estoque', restock_purchase: 'Armazenar compra', production_batch: 'Produzir lote' } as Record<string, string>)[kind] ?? kind; }
function staffRoleLabel(role: string): string { return ({ cook: 'Cozinha', waiter: 'Atendimento', cleaner: 'Limpeza', stocker: 'Estoque' } as Record<string, string>)[role] ?? role; }
function staffStateLabel(state: string): string { return ({ idle: 'Disponível', movingToTask: 'Indo à tarefa', working: 'Trabalhando', carrying: 'Transportando', waitingForWorkSlot: 'Aguardando WorkSlot', waitingForResource: 'Aguardando recurso', waitingForCounterSpace: 'Aguardando balcão', resting: 'Em pausa', offShift: 'Fora do turno', blocked: 'Bloqueado', recovering: 'Recalculando rota', training: 'Em treinamento' } as Record<string, string>)[state] ?? state; }
function storageTypeLabel(type: string): string { return ({ dry: 'Seco', refrigerated: 'Refrigerado', frozen: 'Congelado', general: 'Geral' } as Record<string, string>)[type] ?? type; }
function purchaseStatusLabel(status: string): string { return ({ pending: 'Aguardando aprovação', approved: 'Aprovada', purchasing: 'Comprando', delivering: 'Em transporte', storing: 'Armazenando', completed: 'Concluída', blocked: 'Bloqueada', cancelled: 'Cancelada', failed: 'Falhou' } as Record<string, string>)[status] ?? status; }
function purchaseStorageSummary(state: GameState, quote: PurchaseQuote): string {
  const allocation = planStorageAllocation(state, quote.ingredientId, quote.amount);
  if (!allocation.allocations.length) return allocation.reason ?? 'sem destino compatível';
  return allocation.allocations.map((part) => {
    const placed = state.construction.placedFurniture.find((item) => item.id === part.placedFurnitureId);
    const furniture = placed ? FURNITURE_BY_ID[placed.definitionId] : undefined;
    return `${furniture?.code ?? part.placedFurnitureId} ×${part.quantity}`;
  }).join(' + ');
}
function productionTaskStatusLabel(status: string): string { return ({ queued: 'Na fila', waitingForIngredients: 'Sem ingredientes', waitingForStorage: 'Sem armazenamento', waitingForStaff: 'Aguardando cozinheiro', waitingForWorkstation: 'Aguardando equipamento', reserved: 'Reservas confirmadas', inPreparation: 'Em preparação', cooking: 'Cozinhando', waitingForCounterSpace: 'Aguardando balcão', delivering: 'Entregando', completed: 'Concluído', cancelled: 'Cancelado', failed: 'Falhou' } as Record<string, string>)[status] ?? status; }
function formatDuration(seconds: number): string { const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); return hours ? `${hours}h ${minutes}min` : `${minutes} min`; }
function professionProgress(xp: number, level: number): number { const start = BALANCE.professionLevels[level - 1] ?? 0; const end = BALANCE.professionLevels[level] ?? BALANCE.professionLevels.at(-1)!; return level >= 3 ? 100 : Math.max(0, Math.min(100, (xp - start) / (end - start) * 100)); }
function skinColor(id: string): string { return ({ porcelain: '#f6d4bd', honey: '#d99a68', cocoa: '#8b5a3c', ebony: '#553521' } as Record<string, string>)[id] ?? '#d99a68'; }
function hairColor(id: string): string { return ({ espresso: '#3a241d', chestnut: '#74432d', copper: '#b95f3a', midnight: '#242635' } as Record<string, string>)[id] ?? '#3a241d'; }
function outfitColor(id: string): string { return ({ teal: '#1d766d', coral: '#d96652', gold: '#d49a3a', plum: '#76536c' } as Record<string, string>)[id] ?? '#1d766d'; }
function stockUrgency(amount: number, reorderPoint: number, needed: number): number { return amount === 0 ? 5 : needed > amount ? 4 : amount <= reorderPoint ? 3 : 1; }
function stockStatus(amount: number, reorderPoint: number, needed: number, max: number): { css: string; icon: string; label: string } {
  if (amount >= max) return { css: 'full', icon: '■', label: 'cheio' };
  if (amount === 0) return { css: 'out', icon: '!', label: 'em falta' };
  if (needed > amount) return { css: 'critical', icon: '!!', label: 'crítico' };
  if (amount <= reorderPoint) return { css: 'low', icon: '↓', label: 'baixo' };
  return { css: 'normal', icon: '✓', label: 'normal' };
}
function developmentMode(): boolean { return ['localhost', '127.0.0.1'].includes(window.location.hostname); }
