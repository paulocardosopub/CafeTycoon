import { describe, expect, it } from 'vitest';
import { BALANCE, GAME_VERSION } from '../config/balance';
import { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';
import { STREET_ENTRY_POINTS, STREET_EXIT_ZONE } from '../game/map/initialMap';
import { createDefaultState } from '../game/save/defaultState';

describe('ciclo de clientes 0.0.4', () => {
  it('faz o cliente entrar, usar um assento e sair sem permanecer travado', () => {
    const state = createDefaultState(0);
    state.readyDishes.coffee = 10;
    state.readyDishes.omelette = 10;
    const simulation = new RestaurantSimulation(state);
    simulation.debugSetAutoSpawn(false);
    const customer = simulation.debugAddCustomer()!;
    expect(STREET_ENTRY_POINTS.some((point) => point.y === customer.position.y)).toBe(true);
    simulation.debugRunFor(180);
    expect(simulation.customers.some((item) => item.id === customer.id)).toBe(false);
    expect(state.stats.customersServed).toBe(1);
    expect(simulation.tables.flatMap((table) => table.chairs).every((seat) => seat.customerId !== customer.id)).toBe(true);
  });

  it('usa uma zona de saída com múltiplas células e mantém a versão 0.0.4', () => {
    expect(STREET_EXIT_ZONE.length).toBeGreaterThan(1);
    expect(BALANCE.customerBasePatienceSeconds).toBe(120);
    expect(GAME_VERSION).toBe('0.0.4');
  });
});
