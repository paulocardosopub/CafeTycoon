import Phaser from 'phaser';
// Sufixo estável e próprio evita colisão de cache entre prévias locais que usam
// o mesmo caminho virtual `/src/styles.css` no navegador integrado.
import './styles.css?v=cafe-mania-008-alpha';
import { showCharacterCreator } from './ui/characterCreator';
import { GameUI } from './ui/GameUI';
import { IndexedDbSaveRepository, SAVE_RESET_SESSION_KEY } from './game/save/SaveRepository';
import { migrateAndSanitizeSave } from './game/save/migrations';
import { RestaurantSimulation } from './game/simulation/RestaurantSimulation';
import { RestaurantScene } from './scenes/RestaurantScene';
import { calculateOfflineProgress } from './game/offline/OfflineService';
import { AudioService } from './game/audio/AudioService';
import { validateRestaurantMap } from './game/map/validateMap';
import { createInitialConstructionState } from './game/map/initialConstruction';
import type { GameState, PlacedFurniture } from './core/types';
import { GAME_VERSION, SAVE_SCHEMA_VERSION } from './config/balance';
import { modulesFromFurniture } from './game/systems/service-counter/ServiceCounterSystem';
import { reconcileStorage } from './game/inventory/StorageService';
import { createPurchaseRequest } from './game/inventory/ProcurementService';
import { createProductionPlan } from './game/cooking/ProductionPlanningService';
import { createInitialStaffState } from './game/staff/StaffService';

export const CONSTRUCTION_RELOAD_SESSION_KEY = 'bistro-bloom-construction-reload';

async function boot(): Promise<void> {
  if (sessionStorage.getItem(SAVE_RESET_SESSION_KEY) === '1') sessionStorage.removeItem(SAVE_RESET_SESSION_KEY);
  if (sessionStorage.getItem(CONSTRUCTION_RELOAD_SESSION_KEY) === '1') sessionStorage.removeItem(CONSTRUCTION_RELOAD_SESSION_KEY);
  const root = document.querySelector<HTMLElement>('#app')!;
  root.innerHTML = '<div class="boot-screen"><span>✿</span><strong>Abrindo o Bistrô Bloom…</strong></div>';
  const repository = new IndexedDbSaveRepository();
  const rawState = await repository.load();
  if (rawState && (rawState.gameVersion !== GAME_VERSION || rawState.schemaVersion < SAVE_SCHEMA_VERSION)) await repository.backupLegacy(rawState);
  const state = migrateAndSanitizeSave(rawState);
  const query = new URLSearchParams(window.location.search);
  let localQa = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? query.get('qa') : null;
  if (localQa && !['creator', 'four-seat-v005', 'v006', 'spatial-fix', 'tutorial', 'shop'].includes(localQa)) {
    query.delete('qa');
    query.delete('assets');
    const suffix = query.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${suffix ? `?${suffix}` : ''}`);
    localQa = null;
  }
  const localCreatorPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    && localQa === 'creator';
  if (localCreatorPreview) state.profile = undefined;
  if (localQa === 'four-seat-v005') applyFourSeatQaState(state);
  if (localQa === 'v006') applyV006QaState(state);
  if (localQa === 'spatial-fix') applySpatialFixQaState(state);
  if (localQa === 'tutorial' || localQa === 'shop') applyTutorialQaState(state);

  if (!state.profile) {
    state.profile = await showCharacterCreator(root);
    state.playerId = state.profile.id;
    state.lastActiveAt = Date.now();
    if (!localQa) await repository.save(state);
  }

  const offlineReport = calculateOfflineProgress(state, Date.now());
  // A tela principal não precisa aguardar uma segunda gravação do mesmo save.
  // Persistimos em paralelo para remover a pausa longa do primeiro acesso.
  if (!localQa) void repository.save(state);
  const simulation = new RestaurantSimulation(state);
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    (window as unknown as { __BISTRO_DEBUG__: { simulation: RestaurantSimulation; state: GameState } }).__BISTRO_DEBUG__ = { simulation, state };
  }
  if (localQa === 'four-seat-v005' || localQa === 'spatial-fix') simulation.debugSeatGroupAtFirstTable(2);
  if (localQa === 'spatial-fix') arrangeDirectionalQaActors(simulation);
  const validation = validateRestaurantMap(simulation.grid, simulation.tables, simulation.stations);
  if (!validation.valid) console.warn('Validação do mapa:', validation.errors);

  const audio = new AudioService();
  audio.load();
  const ui = new GameUI(root, state, simulation, repository, audio);
  if (localQa === 'tutorial' && query.get('show') === '1') window.setTimeout(() => root.querySelector<HTMLElement>('[data-action="tutorial-show"]')?.click(), 80);
  if (localQa === 'shop') window.setTimeout(() => {
    root.querySelector<HTMLElement>('[data-action="open-construction"][data-mode="shop"]')?.click();
    if (query.get('confirm') === '1' || query.get('complete') === '1') window.setTimeout(() => {
      root.querySelector<HTMLElement>('[data-editor-action="purchase"]:not([disabled])')?.click();
      if (query.get('complete') === '1') window.setTimeout(() => root.querySelector<HTMLElement>('[data-editor-action="confirm-purchase"]')?.click(), 80);
    }, 80);
  }, 50);
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    const probe = document.createElement('output');
    probe.id = 'simulation-debug-probe';
    probe.hidden = true;
    root.append(probe);
    window.setInterval(() => {
      probe.textContent = JSON.stringify({
        capacity: simulation.totalCapacity(), seated: simulation.seatedCustomerCount(),
        stats: state.stats,
        orders: simulation.orders.map((order) => ({ id: order.id, recipeId: order.recipeId, state: order.state })),
        tasks: simulation.tasks.list().map((task) => ({ id: task.id, kind: task.kind, status: task.status, target: task.target, actorId: task.assignedActorId, waitSeconds: task.waitSeconds, customerId: task.payload.customerId })),
        actors: simulation.actors.map((actor) => ({ id: actor.id, kind: actor.kind, position: actor.position, taskId: actor.taskId, activity: actor.activity, pathLength: actor.path.length, pathStatus: actor.pathStatus })),
        customers: simulation.customers.map((customer) => ({ id: customer.id, partyId: customer.partyId, state: customer.state, position: customer.position, pathLength: customer.path.length, pathStatus: customer.pathStatus, seatId: customer.seatId, retryCount: customer.retryCount })),
        tables: simulation.tables.map((table) => ({ id: table.id, state: table.state, accessible: table.accessible, chairs: table.chairs.map((chair) => ({ id: chair.id, state: chair.state, approach: chair.approach, accessible: chair.accessible, enabled: chair.enabled, customerId: chair.customerId })) })),
      });
    }, 250);
  }
  const scene = new RestaurantScene(simulation);
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: ui.canvasParentId,
    backgroundColor: '#173a36',
    render: { antialias: false, pixelArt: true, roundPixels: true },
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, width: '100%', height: '100%' },
    scene: [scene],
    banner: false,
  });

  if (offlineReport.absentSeconds >= 60) setTimeout(() => ui.showOffline(offlineReport), 350);

  const saveActiveState = () => {
    if (localQa) return;
    if (sessionStorage.getItem(CONSTRUCTION_RELOAD_SESSION_KEY) === '1') return;
    if (sessionStorage.getItem(SAVE_RESET_SESSION_KEY) === '1') return;
    state.lastActiveAt = Date.now();
    simulation.prepareSave(state.lastActiveAt);
    void repository.save(state);
  };
  const autosave = window.setInterval(saveActiveState, 8_000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveActiveState();
    else {
      const report = calculateOfflineProgress(state, Date.now());
      if (!localQa) void repository.save(state);
      if (report.absentSeconds >= 60) ui.showOffline(report);
    }
  });
  window.addEventListener('beforeunload', () => { window.clearInterval(autosave); saveActiveState(); });
}

function applyTutorialQaState(state: GameState): void {
  state.construction = createInitialConstructionState();
  state.operation = undefined;
  state.coins = 1200;
  state.restaurantLevel = 1;
  state.restaurantXp = 0;
  state.restaurantOpen = false;
  for (const id of Object.keys(state.readyDishes) as (keyof typeof state.readyDishes)[]) state.readyDishes[id] = 0;
  state.staff = createInitialStaffState(state, Date.now());
  state.tutorial008 = { started:true, mandatory:true, minimized:false, currentStep:0, completedSteps:[], availableChapters:['level-1-first-service'], deferredChapters:[], completedChapters:[], rewardsReceived:[], highlightsShown:[] };
  const qaQuery = new URLSearchParams(window.location.search);
  if (qaQuery.get('step') === '2') { state.tutorial008.completedSteps = ['welcome']; state.tutorial008.currentStep = 1; }
  if (qaQuery.get('qa') === 'shop' || qaQuery.get('nomodal') === '1') { state.progression.pendingLevels = []; state.progression.retroactiveSummaryPending = false; }
  state.profile = {
    id:state.playerId,name:'Jogador',appearance:{presentation:'masculina',skin:'honey',hairStyle:'short',hairColor:'espresso',face:'soft',outfit:'casual',outfitColor:'green'},level:1,xp:0,helpRole:'kitchen',
    professions:{cook:{xp:0,level:1,tasksCompleted:0},waiter:{xp:0,level:1,tasksCompleted:0},cleaner:{xp:0,level:1,tasksCompleted:0},stocker:{xp:0,level:1,tasksCompleted:0}},
    taskHistory:{take_order:0,cook_step:0,deliver:0,payment:0,clean:0,stock_support:0,restock_purchase:0,production_batch:0},
  };
}

function applyFourSeatQaState(state: GameState): void {
  const construction = createInitialConstructionState();
  construction.placedFurniture = construction.placedFurniture.filter((item) => !item.id.startsWith('table:tutorial') && !item.id.startsWith('chair:tutorial'));
  const tableId = 'table:qa-four';
  const table: PlacedFurniture = { id: tableId, definitionId: 'dining.table.basic', gridX: 8, gridY: 11, orientation: 'sw', skinId: 'table-oak', level: 1, state: {} };
  const chairs: PlacedFurniture[] = [
    { id: 'chair:qa-west', definitionId: 'dining.chair.basic', gridX: 7, gridY: 11, orientation: 'se', skinId: 'chair-wood', level: 1, state: { linkedTableId: tableId } },
    { id: 'chair:qa-east', definitionId: 'dining.chair.basic', gridX: 9, gridY: 11, orientation: 'nw', skinId: 'chair-wood', level: 1, state: { linkedTableId: tableId } },
  ];
  construction.placedFurniture.push(table, ...chairs);
  state.construction = construction;
  state.operation = undefined;
}

function applySpatialFixQaState(state: GameState): void {
  state.construction = createInitialConstructionState();
  state.operation = undefined;
  state.lastActiveAt = Date.now();
  state.profile = {
    id: state.playerId, name: 'Jô',
    appearance: { presentation: 'feminina', skin: 'honey', hairStyle: 'bun', hairColor: 'espresso', face: 'soft', outfit: 'apron', outfitColor: 'teal' },
    level: 2, xp: 180, helpRole: 'kitchen',
    professions: { cook: { xp: 90, level: 2, tasksCompleted: 12 }, waiter: { xp: 55, level: 1, tasksCompleted: 9 }, cleaner: { xp: 30, level: 1, tasksCompleted: 5 }, stocker: { xp: 45, level: 1, tasksCompleted: 7 } },
    taskHistory: { take_order: 9, cook_step: 12, deliver: 8, payment: 7, clean: 5, stock_support: 7, restock_purchase: 3, production_batch: 4 },
  };
}

function arrangeDirectionalQaActors(simulation: RestaurantSimulation): void {
  const routes = [
    [{ x: 4, y: 9 }, { x: 5, y: 9 }, { x: 6, y: 9 }],
    [{ x: 12, y: 14 }, { x: 11, y: 14 }, { x: 10, y: 14 }],
    [{ x: 13, y: 10 }, { x: 13, y: 11 }, { x: 13, y: 12 }],
    [{ x: 15, y: 13 }, { x: 15, y: 12 }, { x: 15, y: 11 }],
  ];
  simulation.debugSetAutoSpawn(false);
  simulation.actors.slice(0, 4).forEach((actor, index) => {
    const route = routes[index]; actor.position = { ...route[0] }; actor.visual = { ...route[0] }; actor.path = route.slice(1); actor.pathStatus = 'moving'; actor.motionState = 'walk'; actor.moveProgress = 0;
  });
}

function applyV006QaState(state: GameState): void {
  const construction = createInitialConstructionState();
  construction.placedFurniture.push(
    { id: 'counter:qa-left', definitionId: 'service.c2.left', gridX: 7, gridY: 6, orientation: 'sw', skinId: 'counter-forest', level: 1, state: {} },
    { id: 'counter:qa-right', definitionId: 'service.c4.right', gridX: 9, gridY: 6, orientation: 'sw', skinId: 'counter-forest', level: 1, state: {} },
  );
  construction.serviceCounters = modulesFromFurniture(construction.placedFurniture).map((counter, index) => ({
    ...counter,
    assignedRecipeId: 'omelette',
    currentQuantity: [4, 7, 10][index] ?? 0,
  }));
  const stockerStart = construction.staffStartPositions.find((position) => position.staffId === 'stocker-0');
  if (stockerStart) Object.assign(stockerStart, { gridX: 14, gridY: 14, facing: 'nw' });
  state.construction = construction;
  state.operation = undefined;
  state.profile = {
    id: state.playerId,
    name: 'Jô',
    appearance: { presentation: 'feminina', skin: 'honey', hairStyle: 'bun', hairColor: 'espresso', face: 'soft', outfit: 'apron', outfitColor: 'teal' },
    level: 2,
    xp: 180,
    helpRole: 'kitchen',
    professions: {
      cook: { xp: 90, level: 2, tasksCompleted: 12 }, waiter: { xp: 55, level: 1, tasksCompleted: 9 },
      cleaner: { xp: 30, level: 1, tasksCompleted: 5 }, stocker: { xp: 45, level: 1, tasksCompleted: 7 },
    },
    taskHistory: { take_order: 9, cook_step: 12, deliver: 8, payment: 7, clean: 5, stock_support: 7, restock_purchase: 3, production_batch: 4 },
  };
  state.coins = 2_000;
  const stocker = state.staff.instances.find((member) => member.definitionId === 'stocker-0');
  if (stocker) {
    stocker.startPosition = { x: 14, y: 14 };
    stocker.currentPosition = { x: 14, y: 14 };
    stocker.currentFacing = 'nw';
  }
  state.inventory.beef = 0;
  state.inventory.tomato = 0;
  reconcileStorage(state);
  state.tutorial006 = { currentStep: 5, completed: true, automationUnlocked: true, dismissed: false };
  state.procurement.globalSettings.enabled = true;
  const tomatoPolicy = state.procurement.policies.find((policy) => policy.ingredientId === 'tomato');
  if (tomatoPolicy) Object.assign(tomatoPolicy, { enabled: true, minimumStock: 5, targetStock: 10, pauseWhenRestaurantClosed: false });
  createPurchaseRequest(state, [{ ingredientId: 'beef', quantity: 4 }], 'manual', 'Lista de compras para validação visual.', 82);
  createProductionPlan(state, { recipeId: 'omelette', targetQuantity: 500, batchSize: 20, priority: 75 });
  state.lastActiveAt = Date.now() - 9 * 60 * 60 * 1_000;
}

void boot();
