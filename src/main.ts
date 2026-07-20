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

async function boot(): Promise<void> {
  if (sessionStorage.getItem(SAVE_RESET_SESSION_KEY) === '1') sessionStorage.removeItem(SAVE_RESET_SESSION_KEY);
  const root = document.querySelector<HTMLElement>('#app')!;
  root.innerHTML = '<div class="boot-screen"><span>✿</span><strong>Abrindo o Bistrô Bloom…</strong></div>';
  const repository = new IndexedDbSaveRepository();
  const state = migrateAndSanitizeSave(await repository.load());

  if (!state.profile) {
    state.profile = await showCharacterCreator(root);
    state.playerId = state.profile.id;
    state.lastActiveAt = Date.now();
    await repository.save(state);
  }

  const offlineReport = calculateOfflineProgress(state, Date.now());
  await repository.save(state);
  const simulation = new RestaurantSimulation(state);
  const validation = validateRestaurantMap(simulation.grid, simulation.tables);
  if (!validation.valid) console.warn('Validação do mapa:', validation.errors);

  const audio = new AudioService();
  audio.load();
  const ui = new GameUI(root, state, simulation, repository, audio);
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
      void repository.save(state);
      if (report.absentSeconds >= 60) ui.showOffline(report);
    }
  });
  window.addEventListener('beforeunload', () => { window.clearInterval(autosave); saveActiveState(); });
}

void boot();
