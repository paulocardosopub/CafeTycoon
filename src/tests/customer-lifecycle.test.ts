import { describe, expect, it } from 'vitest';
import { BALANCE, GAME_VERSION } from '../config/balance';
import type { CustomerRuntime } from '../game/simulation/RestaurantSimulation';
import { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';
import { ENTRANCE, EXIT, STREET_ENTRY_POINTS, STREET_EXIT } from '../game/map/initialMap';
import { createDefaultState } from '../game/save/defaultState';

interface SimulationInternals {
  spawnCustomer(): void;
  onCustomerArrived(customer: CustomerRuntime): void;
  routeCustomerToExit(customer: CustomerRuntime): void;
}

describe('ciclo de clientes', () => {
  it('faz o cliente entrar e sair caminhando pela rua', () => {
    const simulation = new RestaurantSimulation(createDefaultState(0));
    const internals = simulation as unknown as SimulationInternals;
    internals.spawnCustomer();
    const customer = simulation.customers[0];

    expect(customer.state).toBe('entering');
    expect(STREET_ENTRY_POINTS).toContainEqual(customer.position);
    expect(customer.path.at(-1)).toEqual(ENTRANCE);

    simulation.grid.vacate(customer.id);
    customer.state = 'leaving';
    customer.position = { ...EXIT };
    customer.visual = { ...EXIT };
    customer.path = [];
    simulation.grid.occupy(EXIT, customer.id);
    internals.routeCustomerToExit(customer);

    expect(customer.state).toBe('leaving');
    expect(customer.path.at(-1)).toEqual(STREET_EXIT);

    simulation.grid.vacate(customer.id);
    customer.position = { ...STREET_EXIT };
    customer.visual = { ...STREET_EXIT };
    customer.path = [];
    simulation.grid.occupy(STREET_EXIT, customer.id);
    internals.onCustomerArrived(customer);

    expect(customer.state).toBe('gone');
    expect(simulation.grid.get(STREET_EXIT)?.occupiedBy).toBeUndefined();

    simulation.update(0.016);
    expect(simulation.customers.some((item) => item.id === customer.id)).toBe(false);
  });

  it('aumenta a paciência sem alterar a versão atual', () => {
    expect(BALANCE.customerBasePatienceSeconds).toBe(120);
    expect(GAME_VERSION).toBe('0.0.2');
  });
});
