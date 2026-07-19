import { BALANCE, GAME_VERSION } from '../config/balance';
import { INGREDIENTS, INGREDIENT_BY_ID } from '../content/ingredients/ingredients';
import { RECIPES, RECIPE_BY_ID } from '../content/recipes/recipes';
import { EQUIPMENT_ASSETS } from '../content/equipment/equipment';
import { gameEvents } from '../core/events';
import type { GameState, HelpRole, IngredientId, OfflineReport, ProfessionId, RecipeId } from '../core/types';
import { enqueueProduction, readyDishCapacity, readyDishUsed } from '../game/cooking/ProductionService';
import { canConsumeRecipe, executePurchase, inventoryCapacity, inventoryUsed, quotePurchase, type PurchaseMode, type PurchaseQuote } from '../game/inventory/InventoryService';
import { calculateOfflineProgress } from '../game/offline/OfflineService';
import type { SaveRepository } from '../game/save/SaveRepository';
import type { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';
import type { AudioService } from '../game/audio/AudioService';

type PanelId = 'stock' | 'recipes' | 'production' | 'orders' | 'upgrades' | 'player' | 'roles' | 'professions' | 'offline' | 'settings' | 'tasks';

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
  private pendingPurchases: PurchaseQuote[] = [];

  constructor(
    private readonly root: HTMLElement,
    private readonly state: GameState,
    private readonly simulation: RestaurantSimulation,
    private readonly repository: SaveRepository,
    private readonly audio: AudioService,
  ) {
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
          <aside class="panel-host" id="panel-host" aria-live="polite"></aside>
        </main>
        <nav class="management-bar" aria-label="Gestão do restaurante">
          ${navButton('stock', '▦', 'Estoque')}${navButton('recipes', '▤', 'Receitas')}${navButton('production', '▶', 'Produção')}
          ${navButton('orders', '✎', 'Pedidos')}${navButton('upgrades', '↑', 'Melhorias')}${navButton('tasks', '✓', 'Tarefas')}
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
      else if (action === 'prepare-critical') this.prepareBatchPurchase('critical');
      else if (action === 'prepare-pending') this.prepareBatchPurchase('pending');
      else if (action === 'confirm-purchase') this.confirmPurchase();
      else if (action === 'cancel-purchase') { this.pendingPurchases = []; this.renderPanel(); }
      else if (action === 'enqueue') this.enqueue(target.dataset.id as RecipeId);
      else if (action === 'cancel-production') this.cancelProduction(target.dataset.id!);
      else if (action === 'choose-role') this.chooseRole(target.dataset.id as HelpRole);
      else if (action === 'prioritize-task') this.prioritizeTask(target.dataset.id!);
      else if (action === 'cancel-player-task') this.cancelPlayerTask();
      else if (action === 'buy-upgrade') this.buyUpgrade(target.dataset.id as keyof GameState['upgrades']);
      else if (action === 'simulate-offline') this.simulateOffline(Number(target.dataset.seconds));
      else if (action === 'toggle-mute') { this.audio.update({ muted: !this.audio.settings.muted }); this.open('settings'); }
      else if (action === 'toggle-technical') gameEvents.emit('technical:toggle', undefined);
      else if (action === 'set-speed') { this.simulation.setTimeScale(Number(target.dataset.speed)); this.renderDynamic(); }
      else if (action === 'dev-add-customer') this.simulation.debugAddCustomer();
      else if (action === 'dev-add-group') this.simulation.debugAddGroup(4);
      else if (action === 'dev-simulate-order') this.toast(this.simulation.debugSimulateOrder() ? 'Pedido de teste criado.' : 'Não foi possível criar o pedido.', 'info');
      else if (action === 'dev-low-patience') this.simulation.debugReducePatience();
      else if (action === 'dev-dirty-seat') this.simulation.debugDirtySeat();
      else if (action === 'dev-add-stock') { for (const item of INGREDIENTS) this.state.inventory[item.id] = Math.min(item.maxStock, this.state.inventory[item.id] + item.quickBuyPackSize); this.simulation.retryBlockedOrders(); }
      else if (action === 'dev-empty-stock') { for (const item of INGREDIENTS) this.state.inventory[item.id] = this.state.inventoryReserved[item.id]; }
      else if (action === 'dev-fill-stock') { for (const item of INGREDIENTS) this.state.inventory[item.id] = item.maxStock; }
      else if (action === 'reset-save') await this.resetSave();
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
      <button class="owner-portrait" data-open="player" aria-label="Abrir perfil"><span class="portrait-head" style="--skin:${skinColor(profile.appearance.skin)};--hair:${hairColor(profile.appearance.hairColor)}"></span><i>✦</i></button>
      <div class="owner-copy"><small>PROPRIETÁRIO · NÍVEL ${profile.level}</small><strong>${escapeHtml(profile.name)}</strong><span>${role.icon} ${role.name} · ${this.simulation.playerTaskLabel()}</span><em>Destino ${this.simulation.playerDestinationLabel()} · ${this.simulation.playerIdleReason()}</em>
        <div class="mini-progress"><i style="width:${professionProgress(profession.xp, profession.level)}%"></i></div>
      </div><button class="help-button" data-open="roles">Onde ajudar?</button>`;
    const count = this.simulation.activeCustomerCount();
    this.root.querySelector<HTMLElement>('#shift-customers')!.textContent = `${count} ${count === 1 ? 'cliente' : 'clientes'} no salão`;
    this.root.querySelector<HTMLElement>('#shift-occupancy')!.textContent = `OCUPAÇÃO: ${this.simulation.seatedCustomerCount()}/${this.simulation.totalCapacity()}`;
    this.root.querySelectorAll<HTMLButtonElement>('[data-action="set-speed"]').forEach((button) => button.classList.toggle('active', Number(button.dataset.speed) === this.simulation.timeScale()));
  }

  private renderPanel(): void {
    const host = this.root.querySelector<HTMLElement>('#panel-host')!;
    if (!this.activePanel) { host.innerHTML = ''; return; }
    const content = this.panelContent(this.activePanel);
    host.innerHTML = `<section class="side-panel"><header><div><small>GESTÃO DO BISTRÔ</small><h2>${content.title}</h2></div><button class="close-button" data-action="close-panel" aria-label="Fechar">×</button></header><div class="panel-body">${content.body}</div></section>`;
  }

  private panelContent(panel: PanelId): { title: string; body: string } {
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

  private stockPanel(): string {
    const missing = new Map(this.simulation.missingIngredients().map((item) => [item.id, item]));
    const sorted = [...INGREDIENTS].sort((a, b) => stockUrgency(this.state.inventory[b.id], b.reorderPoint, missing.get(b.id)?.needed ?? 0) - stockUrgency(this.state.inventory[a.id], a.reorderPoint, missing.get(a.id)?.needed ?? 0));
    const confirmation = this.pendingPurchases.length ? `<div class="purchase-confirm"><strong>CONFIRMAR REPOSIÇÃO</strong><span>${this.pendingPurchases.reduce((sum, quote) => sum + quote.amount, 0)} unidades · ${this.pendingPurchases.reduce((sum, quote) => sum + quote.cost, 0)} moedas · ${this.pendingPurchases.reduce((sum, quote) => sum + quote.spaceNeeded, 0)} espaços</span>${this.pendingPurchases.map((quote) => `<small>${INGREDIENT_BY_ID[quote.ingredientId].name}: +${quote.amount} → ${quote.finalAmount}/${INGREDIENT_BY_ID[quote.ingredientId].maxStock}</small>`).join('')}<div><button data-action="cancel-purchase">Cancelar</button><button data-action="confirm-purchase">Comprar</button></div></div>` : '';
    return `${confirmation}<div class="capacity-card"><span>Capacidade total</span><strong>${inventoryUsed(this.state)} / ${inventoryCapacity(this.state)}</strong><div><i style="width:${inventoryUsed(this.state) / inventoryCapacity(this.state) * 100}%"></i></div></div>
      <div class="stock-actions"><button data-action="prepare-critical">Comprar críticos</button><button data-action="prepare-pending">Comprar para pedidos</button></div>
      <div class="item-list">${sorted.map((item) => {
        const amount = this.state.inventory[item.id]; const needed = missing.get(item.id)?.needed ?? 0; const status = stockStatus(amount, item.reorderPoint, needed, item.maxStock);
        const full = amount >= item.maxStock || inventoryUsed(this.state) >= inventoryCapacity(this.state);
        return `<article class="stock-row ${status.css}"><span class="item-icon">${item.icon}</span><div><strong>${item.name} <i>${status.icon} ${status.label}</i></strong><small>${amount} / ${item.maxStock} ${item.unit} · pedidos: ${needed}</small></div><div class="quick-buttons"><button data-action="prepare-purchase" data-mode="pack" data-id="${item.id}" ${full || this.state.coins < item.purchasePrice ? 'disabled' : ''}>1 pacote<em>${item.purchasePrice} ●</em></button><button data-action="prepare-purchase" data-mode="target" data-id="${item.id}" ${full ? 'disabled' : ''}>Repor meta</button></div></article>`;
      }).join('')}</div>`;
  }

  private recipesPanel(): string {
    return `<div class="recipe-grid">${RECIPES.map((recipe) => {
      const locked = recipe.requiredLevel > this.state.restaurantLevel;
      return `<article class="recipe-card ${locked ? 'locked' : ''}"><div class="recipe-icon">${recipe.icon}</div><div><strong>${recipe.name}</strong><small>${recipe.description}</small></div><span>${recipe.salePrice} ● · ${recipe.experience} XP</span><ul>${recipe.steps.map((step) => `<li>${step.label} <em>${step.duration}s</em></li>`).join('')}</ul>${locked ? `<b class="lock-note">Nível ${recipe.requiredLevel}</b>` : `<p>${recipe.ingredients.map((part) => `${INGREDIENT_BY_ID[part.ingredientId].icon} ${part.amount}`).join('  ')}</p>`}</article>`;
    }).join('')}</div>`;
  }

  private productionPanel(): string {
    const queue = this.state.productionQueue;
    return `<p class="panel-intro">Prepare pratos antes do movimento. Clientes consomem primeiro o que já estiver pronto.</p>
      <div class="ready-strip">${RECIPES.map((recipe) => `<span data-ready-id="${recipe.id}">${recipe.icon}<b>${this.state.readyDishes[recipe.id]}</b></span>`).join('')}<small>${readyDishUsed(this.state)}/${readyDishCapacity(this.state)}</small></div>
      <h3>Adicionar à fila</h3><div class="production-recipes">${RECIPES.filter((recipe) => recipe.requiredLevel <= this.state.restaurantLevel).map((recipe) => `<article><span>${recipe.icon}</span><div><strong>${recipe.name}</strong><small>${recipe.steps.reduce((sum, step) => sum + step.duration, 0)}s por prato</small></div><input id="qty-${recipe.id}" type="number" min="1" max="20" value="1" aria-label="Quantidade de ${recipe.name}"/><button data-action="enqueue" data-id="${recipe.id}">Programar</button></article>`).join('')}</div>
      <h3>Fila atual</h3>${queue.length ? `<div class="queue-list">${queue.map((item, index) => { const recipe = RECIPE_BY_ID[item.recipeId]; const duration = recipe.steps.reduce((sum, step) => sum + step.duration, 0); const progress = Math.min(100, item.progressSeconds / duration * 100); return `<article data-queue-id="${item.id}"><span>${index + 1}</span><div><strong>${recipe.icon} ${recipe.name} · ${item.completed}/${item.quantity}</strong><small>${statusLabel(item.status)}</small><i><em style="width:${progress}%"></em></i></div><button data-action="cancel-production" data-id="${item.id}" ${item.ingredientsCommitted ? 'disabled title="Produção em andamento"' : ''}>×</button></article>`; }).join('')}</div>` : emptyState('☕', 'A fila está vazia', 'Escolha uma receita para preparar antecipadamente.')}`;
  }

  private refreshProductionPanel(): void {
    if (this.activePanel !== 'production') return;
    for (const recipe of RECIPES) {
      const cell = this.root.querySelector<HTMLElement>(`[data-ready-id="${recipe.id}"] b`);
      if (cell) cell.textContent = String(this.state.readyDishes[recipe.id]);
    }
    const capacity = this.root.querySelector<HTMLElement>('.ready-strip > small');
    if (capacity) capacity.textContent = `${readyDishUsed(this.state)}/${readyDishCapacity(this.state)}`;
    const rows = [...this.root.querySelectorAll<HTMLElement>('[data-queue-id]')];
    if (rows.length !== this.state.productionQueue.length) { this.renderPanel(); return; }
    for (const row of rows) {
      const item = this.state.productionQueue.find((candidate) => candidate.id === row.dataset.queueId);
      if (!item) { this.renderPanel(); return; }
      const recipe = RECIPE_BY_ID[item.recipeId];
      const duration = recipe.steps.reduce((sum, step) => sum + step.duration, 0);
      const title = row.querySelector('strong'); const status = row.querySelector('small'); const bar = row.querySelector<HTMLElement>('i em'); const cancel = row.querySelector<HTMLButtonElement>('button');
      if (title) title.textContent = `${recipe.icon} ${recipe.name} · ${item.completed}/${item.quantity}`;
      if (status) status.textContent = statusLabel(item.status);
      if (bar) bar.style.width = `${Math.min(100, item.progressSeconds / duration * 100)}%`;
      if (cancel) cancel.disabled = item.ingredientsCommitted;
    }
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
    return `<div class="profile-hero"><div class="large-portrait" style="--skin:${skinColor(profile.appearance.skin)};--hair:${hairColor(profile.appearance.hairColor)};--outfit:${outfitColor(profile.appearance.outfitColor)}"><span></span><i></i></div><div><small>PROPRIETÁRIO DO BISTRÔ</small><h3>${escapeHtml(profile.name)}</h3><p>Nível geral ${profile.level} · ${profile.xp} XP</p></div></div>
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
      <div class="report-grid"><span><small>Produzidos</small><b>${produced}</b></span><span><small>Vendidos</small><b>${sold}</b></span><span><small>Moedas</small><b>+${report.coins} ●</b></span><span><small>Experiência</small><b>+${report.experience} XP</b></span></div>
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
      ${developmentMode() ? `<div class="settings-section"><h3>Painel de desenvolvimento</h3><div class="dev-times"><button data-action="dev-add-customer">+ cliente</button><button data-action="dev-add-group">+ grupo 4</button><button data-action="dev-simulate-order">Simular pedido</button><button data-action="dev-low-patience">Paciência baixa</button><button data-action="dev-dirty-seat">Sujar lugar</button><button data-action="dev-add-stock">+ ingredientes</button><button data-action="dev-empty-stock">Esvaziar estoque</button><button data-action="dev-fill-stock">Preencher estoque</button></div><p>Modo técnico: grade, rotas e reservas. A aba Tarefas mostra a fila central.</p></div>` : ''}
      <div class="danger-zone"><h3>Recomeçar</h3><p>Apaga o restaurante, personagem e todo o progresso deste dispositivo.</p><button data-action="reset-save">Apagar save…</button></div>`;
  }

  private renderSettingsValues(): void {
    const master = this.root.querySelector<HTMLElement>('[data-audio-value="master"]'); const effects = this.root.querySelector<HTMLElement>('[data-audio-value="effects"]');
    if (master) master.textContent = `${Math.round(this.audio.settings.master * 100)}%`;
    if (effects) effects.textContent = `${Math.round(this.audio.settings.effects * 100)}%`;
  }

  private preparePurchase(id: IngredientId, mode: PurchaseMode): void {
    const quote = quotePurchase(this.state, id, mode);
    if (!quote.ok) { this.toast(quote.reason ?? 'Não foi possível preparar a compra.', 'warning'); return; }
    this.pendingPurchases = [quote]; this.renderPanel();
  }

  private prepareBatchPurchase(kind: 'critical' | 'pending'): void {
    const missingIds = new Set(this.simulation.missingIngredients().map((item) => item.id));
    const ids = INGREDIENTS.filter((item) => kind === 'pending' ? missingIds.has(item.id) : missingIds.has(item.id) || this.state.inventory[item.id] <= item.reorderPoint).map((item) => item.id);
    const shadow = { ...this.state, coins: this.state.coins, inventory: { ...this.state.inventory }, inventoryReserved: { ...this.state.inventoryReserved } };
    const quotes: PurchaseQuote[] = [];
    for (const id of ids) { const quote = quotePurchase(shadow, id, kind === 'pending' ? 'minimum' : 'target'); if (quote.ok && executePurchase(shadow, quote).ok) quotes.push(quote); }
    if (!quotes.length) { this.toast('Nenhuma compra necessária ou possível.', 'info'); return; }
    this.pendingPurchases = quotes; this.renderPanel();
  }

  private confirmPurchase(): void {
    if (!this.pendingPurchases.length) return;
    let bought = 0;
    for (const quote of this.pendingPurchases) if (executePurchase(this.state, quote).ok) bought += quote.amount;
    this.pendingPurchases = []; this.simulation.retryBlockedOrders(); this.toast(bought ? `${bought} ingredientes comprados.` : 'A compra não pôde ser concluída.', bought ? 'success' : 'warning');
    this.renderDynamic(); this.renderPanel();
  }

  private enqueue(id: RecipeId): void {
    const input = this.root.querySelector<HTMLInputElement>(`#qty-${id}`); const quantity = Math.max(1, Math.min(20, Number(input?.value) || 1)); const recipe = RECIPE_BY_ID[id];
    if (readyDishUsed(this.state) >= readyDishCapacity(this.state)) { this.toast('O armazenamento de pratos está cheio.', 'warning'); return; }
    if (!canConsumeRecipe(this.state, recipe, quantity)) { this.toast('Não há ingredientes para toda essa produção.', 'warning'); return; }
    enqueueProduction(this.state, id, quantity); this.toast(`${quantity}× ${recipe.name} adicionado à fila.`, 'success'); this.renderPanel();
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
    if (!window.confirm('Apagar definitivamente o Bistrô Bloom e todo o progresso salvo?')) return;
    await this.repository.clear(); window.location.reload();
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
function taskIcon(kind: string): string { return ({ take_order: '✎', cook_step: '🍳', deliver: '🔔', payment: '●', clean: '✨', stock_support: '▦' } as Record<string, string>)[kind] ?? '•'; }
function taskLabel(kind: string): string { return ({ take_order: 'Anotar pedido', cook_step: 'Preparar receita', deliver: 'Entregar prato', payment: 'Receber pagamento', clean: 'Limpar mesa', stock_support: 'Apoiar estoque' } as Record<string, string>)[kind] ?? kind; }
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
