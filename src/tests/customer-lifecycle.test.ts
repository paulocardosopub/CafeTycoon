import { describe, expect, it } from 'vitest';
import { BALANCE, GAME_VERSION } from '../config/balance';
import type { CustomerRuntime } from '../game/simulation/RestaurantSimulation';
import { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';
import { EXIT } from '../game/map/initialMap';
import { createDefaultState } from '../game/save/defaultState';

interface SimulationInternals {
  spawnCustomer(): void;
  onCustomerArrived(customer: CustomerRuntime): void;
}

describe('ciclo de clientes', () => {
  it('libera a saída e remove o cliente depois que ele vai embora', () => {
    const simulation = new RestaurantSimulation(createDefaultState(0));
    const internals = simulation as unknown as SimulationInternals;
    internals.spawnCustomer();
    const customer = simulation.customers[0];

    simulation.grid.vacate(customer.id);
    customer.state = 'leaving';
    customer.position = { ...EXIT };
    customer.visual = { ...EXIT };
    customer.path = [];
    simulation.grid.occupy(EXIT, customer.id);

    internals.onCustomerArrived(customer);

    expect(customer.state).toBe('gone');
    expect(simulation.grid.get(EXIT)?.occupiedBy).toBeUndefined();

    simulation.update(0.016);
    expect(simulation.customers.some((item) => item.id === customer.id)).toBe(false);
  });

  it('aumenta a paciência sem alterar a versão atual', () => {
    expect(BALANCE.customerBasePatienceSeconds).toBe(120);
    expect(GAME_VERSION).toBe('0.0.1');
  });
});
