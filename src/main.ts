import Phaser from 'phaser';
import './styles.css';
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

export const CONSTRUCTION_RELOAD_SESSION_KEY = 'bistro-bloom-construction-reload';

async function boot(): Promise<void> {
  if (sessionStorage.getItem(SAVE_RESET_SESSION_KEY) === '1') sessionStorage.removeItem(SAVE_RESET_SESSION_KEY);
  if (sessionStorage.getItem(CONSTRUCTION_RELOAD_SESSION_KEY) === '1') sessionStorage.removeItem(CONSTRUCTION_RELOAD_SESSION_KEY);
  const root = document.querySelector<HTMLElement>('#app')!;
  root.innerHTML = '<div class="boot-screen"><span>✿</span><strong>Abrindo o Bistrô Bloom…</strong></div>';
  const repository = new IndexedDbSaveRepository();
  const state = migrateAndSanitizeSave(await repository.load());
  const query = new URLSearchParams(window.location.search);
  let localQa = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? query.get('qa') : null;
  if (localQa && !['creator', 'four-seat-v005'].includes(localQa)) {
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

  if (!state.profile) {
    state.profile = await showCharacterCreator(root);
    state.playerId = state.profile.id;
    state.lastActiveAt = Date.now();
    if (!localQa) await repository.save(state);
  }

  const offlineReport = calculateOfflineProgress(state, Date.now());
  if (!localQa) await repository.save(state);
  const simulation = new RestaurantSimulation(state);
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    (window as unknown as { __BISTRO_DEBUG__: { simulation: RestaurantSimulation; state: GameState } }).__BISTRO_DEBUG__ = { simulation, state };
  }
  if (localQa === 'four-seat-v005') simulation.debugSeatGroupAtFirstTable(4);
  const validation = validateRestaurantMap(simulation.grid, simulation.tables, simulation.stations);
  if (!validation.valid) console.warn('Validação do mapa:', validation.errors);

  const audio = new AudioService();
  audio.load();
  const ui = new GameUI(root, state, simulation, repository, audio);
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

function applyFourSeatQaState(state: GameState): void {
  const construction = createInitialConstructionState();
  construction.placedFurniture = construction.placedFurniture.filter((item) => !item.id.startsWith('table:tutorial') && !item.id.startsWith('chair:tutorial'));
  const tableId = 'table:qa-four';
  const table: PlacedFurniture = { id: tableId, definitionId: 'dining.table.basic', gridX: 8, gridY: 11, orientation: 'sw', skinId: 'table-oak', level: 1, state: {} };
  const chairs: PlacedFurniture[] = [
    { id: 'chair:qa-north', definitionId: 'dining.chair.basic', gridX: 8, gridY: 10, orientation: 'sw', skinId: 'chair-wood', level: 1, state: { linkedTableId: tableId } },
    { id: 'chair:qa-south', definitionId: 'dining.chair.basic', gridX: 8, gridY: 12, orientation: 'ne', skinId: 'chair-wood', level: 1, state: { linkedTableId: tableId } },
    { id: 'chair:qa-west', definitionId: 'dining.chair.basic', gridX: 7, gridY: 11, orientation: 'se', skinId: 'chair-wood', level: 1, state: { linkedTableId: tableId } },
    { id: 'chair:qa-east', definitionId: 'dining.chair.basic', gridX: 9, gridY: 11, orientation: 'nw', skinId: 'chair-wood', level: 1, state: { linkedTableId: tableId } },
  ];
  construction.placedFurniture.push(table, ...chairs);
  state.construction = construction;
  state.operation = undefined;
}

void boot();
