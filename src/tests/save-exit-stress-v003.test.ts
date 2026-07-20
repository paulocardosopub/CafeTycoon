import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { INGREDIENTS } from '../content/ingredients/ingredients';
import { STREET_EXIT_ZONE } from '../game/map/initialMap';
import { createDefaultState } from '../game/save/defaultState';
import { migrateAndSanitizeSave } from '../game/save/migrations';
import { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';

function fullState() {
  const state = createDefaultState(0);
  for (const item of INGREDIENTS) state.inventory[item.id] = item.maxStock;
  state.readyDishes.coffee = 10;
  state.readyDishes.omelette = 10;
  return state;
}

describe('save operacional e recuperação da saída', () => {
  it('salva e carrega durante um pedido sem duplicar pedido, prato ou pagamento', () => {
    const state = fullState(); const first = new RestaurantSimulation(state); first.debugSetAutoSpawn(false);
    first.debugAddCustomer(); first.debugRunFor(12); first.prepareSave(100);
    const savedOrders = first.orders.length; const coins = state.coins;
    const restoredState = migrateAndSanitizeSave(JSON.parse(JSON.stringify(state)), 100);
    const restored = new RestaurantSimulation(restoredState); restored.debugSetAutoSpawn(false); restored.debugRunFor(180);
    expect(savedOrders).toBe(1);
    expect(restored.orders).toHaveLength(1);
    expect(restoredState.stats.customersServed).toBe(1);
    expect(restoredState.coins).toBeGreaterThan(coins);
    expect(restored.activeCustomerCount()).toBe(0);
  });

  it('remove com segurança um cliente sem rota e libera todas as referências', () => {
    const state = fullState(); const simulation = new RestaurantSimulation(state); simulation.debugSetAutoSpawn(false);
    const customer = simulation.debugAddCustomer()!; simulation.debugRunFor(15);
    for (const point of STREET_EXIT_ZONE) simulation.grid.set(point, { walkable: false });
    simulation.debugBeginDeparture(customer);
    const servedBefore = state.stats.customersServed; const coinsBefore = state.coins;
    simulation.debugRunFor(20);
    expect(simulation.customers.some((item) => item.id === customer.id)).toBe(false);
    expect(simulation.tables.flatMap((table) => table.chairs).every((seat) => seat.customerId !== customer.id)).toBe(true);
    expect(state.stats.customersServed).toBe(servedBefore);
    expect(state.coins).toBe(coinsBefore);
  });

  it('recupera um cliente carregado no estado saindo', () => {
    const state = fullState(); const simulation = new RestaurantSimulation(state); simulation.debugSetAutoSpawn(false);
    const customer = simulation.debugAddCustomer()!; simulation.debugRunFor(15); simulation.debugBeginDeparture(customer); simulation.prepareSave(50);
    const restored = new RestaurantSimulation(migrateAndSanitizeSave(JSON.parse(JSON.stringify(state)), 50)); restored.debugSetAutoSpawn(false); restored.debugRunFor(30);
    expect(restored.customers.some((item) => item.id === customer.id)).toBe(false);
  });
});

describe('stress inicial controlado', () => {
  it('mantém vinte clientes, quatro funcionários e jogador sem duplicar tarefas ou cadeiras', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const state = fullState(); const simulation = new RestaurantSimulation(state); simulation.debugSetAutoSpawn(false);
    for (let index = 0; index < 20; index += 1) simulation.debugAddCustomer();
    simulation.debugRunFor(120);
    const keys = simulation.tasks.list().map((task) => task.key);
    const occupiedIds = simulation.tables.flatMap((table) => table.chairs).map((seat) => seat.customerId).filter(Boolean);
    expect(simulation.actors.filter((actor) => actor.kind !== 'player')).toHaveLength(4);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(occupiedIds).size).toBe(occupiedIds.length);
    expect(simulation.customers.some((customer) => customer.state === 'entering')).toBe(false);
    expect(state.stats.customersServed + state.stats.customersLost).toBeGreaterThan(0);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  }, 15_000);

  it('recupera fila duplicada e cadeiras-fantasma de um save antigo', () => {
    const state = fullState(); const source = new RestaurantSimulation(state); source.debugSetAutoSpawn(false);
    for (let index = 0; index < 20; index += 1) source.debugAddCustomer();
    source.prepareSave(90);
    const operation = state.operation!;
    for (const customer of operation.customers) {
      customer.position = { x: 3, y: 21 }; customer.visual = { x: 3, y: 21 }; customer.state = 'entering';
    }
    for (const table of operation.tables) for (const seat of (table.chairs as Record<string, unknown>[])) {
      seat.state = 'reserved'; seat.customerId = 'cliente-removido'; seat.reservationId = 'grupo-antigo';
    }
    const restored = new RestaurantSimulation(migrateAndSanitizeSave(JSON.parse(JSON.stringify(state)), 90));
    restored.debugSetAutoSpawn(false);
    expect(new Set(restored.customers.map((customer) => `${customer.position.x},${customer.position.y}`)).size).toBe(restored.customers.length);
    expect(restored.customers.filter((customer) => ['entering', 'seeking_table', 'queueing'].includes(customer.state)).length).toBeLessThanOrEqual(4);
    expect(restored.tables.flatMap((table) => table.chairs).every((seat) => seat.state === 'free')).toBe(true);
    restored.debugRunFor(120);
    expect(restored.customers.some((customer) => customer.state === 'entering')).toBe(false);
    expect(restored.state.stats.customersServed + restored.state.stats.customersLost).toBeGreaterThan(0);
  }, 15_000);

  it('limita a fila normal e admite grupos compatíveis com as mesas livres', () => {
    const state = fullState(); const simulation = new RestaurantSimulation(state);
    for (let elapsed = 0; elapsed < 240; elapsed += 2) {
      simulation.debugRunFor(2);
      const waiting = simulation.customers.filter((customer) => ['entering', 'seeking_table', 'queueing'].includes(customer.state));
      expect(waiting.length).toBeLessThanOrEqual(4);
    }
  }, 15_000);

  it('processa cinquenta entradas e saídas consecutivas sem prender o restaurante', () => {
    const state = fullState(); const simulation = new RestaurantSimulation(state); simulation.debugSetAutoSpawn(false);
    let departures = 0;
    for (let batch = 0; batch < 5; batch += 1) {
      const customers = Array.from({ length: 10 }, () => simulation.debugAddCustomer()!).filter(Boolean);
      simulation.debugRunFor(18);
      customers.forEach((customer) => { if (customer.state !== 'gone') { simulation.debugBeginDeparture(customer); departures += 1; } });
      simulation.debugRunFor(35);
    }
    expect(departures).toBe(50);
    expect(simulation.activeCustomerCount()).toBe(0);
    expect(simulation.customers.some((customer) => customer.state === 'leaving')).toBe(false);
  });
});

describe('reset completo do progresso', () => {
  it('impede o autosave de recriar o save durante o recarregamento', () => {
    const root = resolve(import.meta.dirname, '../..');
    const main = readFileSync(resolve(root, 'src/main.ts'), 'utf8');
    const ui = readFileSync(resolve(root, 'src/ui/GameUI.ts'), 'utf8');
    expect(ui).toContain("sessionStorage.setItem(SAVE_RESET_SESSION_KEY, '1')");
    expect(ui.indexOf('sessionStorage.setItem')).toBeLessThan(ui.indexOf('await this.repository.clear()'));
    expect(main).toContain("if (sessionStorage.getItem(SAVE_RESET_SESSION_KEY) === '1') return");
  });
});
