import { describe, expect, it } from 'vitest';
import { INGREDIENTS } from '../content/ingredients/ingredients';
import { createDefaultState } from '../game/save/defaultState';
import { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';
import type { Direction, PlacedFurniture } from '../core/types';

function diningItem(id: string, definitionId: string, x: number, y: number, orientation: Direction = 'sw', linkedTableId?: string): PlacedFurniture {
  return { id, definitionId, gridX: x, gridY: y, orientation, skinId: definitionId.includes('chair') ? 'chair-wood' : 'table-oak', level: 1, state: linkedTableId ? { linkedTableId } : {} };
}

function installTenSeatLayout(state: ReturnType<typeof createDefaultState>): void {
  state.construction.placedFurniture = state.construction.placedFurniture.filter((item) => !item.definitionId.startsWith('dining.'));
  const groups = [
    { id: 'table:test-a', x: 5, y: 10, chairs: [[5, 9], [5, 11], [4, 10], [6, 10]] },
    { id: 'table:test-b', x: 10, y: 10, chairs: [[10, 9], [10, 11], [9, 10], [11, 10]] },
    { id: 'table:test-c', x: 14, y: 11, chairs: [[13, 11], [15, 11]] },
  ] as const;
  for (const group of groups) {
    state.construction.placedFurniture.push(diningItem(group.id, 'dining.table.basic', group.x, group.y));
    group.chairs.forEach(([x, y], index) => state.construction.placedFurniture.push(diningItem(`${group.id}:chair:${index}`, 'dining.chair.basic', x, y, 'sw', group.id)));
  }
}

function stockedSimulation(): RestaurantSimulation {
  const state = createDefaultState(0);
  installTenSeatLayout(state);
  for (const item of INGREDIENTS) state.inventory[item.id] = item.maxStock;
  state.readyDishes.omelette = 10;
  const simulation = new RestaurantSimulation(state);
  simulation.debugSetAutoSpawn(false);
  return simulation;
}

describe('capacidade e assentos individuais', () => {
  it('calcula dez vagas pelas cadeiras acessíveis', () => {
    const simulation = stockedSimulation();
    expect(simulation.tables).toHaveLength(3);
    expect(simulation.totalCapacity()).toBe(10);
    const blocked = simulation.tables[1].chairs[0];
    blocked.state = 'blocked';
    expect(simulation.totalCapacity()).toBe(9);
  });

  it('acomoda grupo de quatro na mesma mesa sem compartilhar cadeira', () => {
    const simulation = stockedSimulation();
    const group = simulation.debugAddGroup(4);
    simulation.debugRunFor(12);
    expect(new Set(group.map((customer) => customer.tableId)).size).toBe(1);
    expect(new Set(group.map((customer) => customer.seatId)).size).toBe(4);
    const table = simulation.tables.find((item) => item.id === group[0].tableId)!;
    expect(table.chairs.filter((seat) => seat.customerId).length).toBe(4);
  });

  it('uma cadeira ocupada não bloqueia as demais e a limpeza é individual', () => {
    const simulation = stockedSimulation();
    const first = simulation.debugAddCustomer()!;
    simulation.debugRunFor(15);
    const table = simulation.tables.find((item) => item.id === first.tableId)!;
    expect(table.chairs.filter((seat) => seat.state === 'free').length).toBe(table.chairs.length - 1);
    simulation.debugBeginDeparture(first);
    const dirty = table.chairs.filter((seat) => seat.state === 'dirty');
    expect(dirty).toHaveLength(1);
    expect(table.chairs.filter((seat) => seat.state === 'free').length).toBe(table.chairs.length - 1);
    simulation.debugRunFor(20);
    expect(dirty[0].state).toBe('free');
  });
});

describe('estabilidade do ciclo', () => {
  it('não cria nem restaura grupos maiores que qualquer mesa disponível', () => {
    const state = createDefaultState(0);
    const source = new RestaurantSimulation(state);
    source.debugSetAutoSpawn(false);
    source.debugAddGroup(4);
    state.operation = source.prepareSave(10);

    const restored = new RestaurantSimulation(state);
    const sizes = [...new Set(restored.customers.map((customer) => customer.partyId))]
      .map((partyId) => restored.customers.filter((customer) => customer.partyId === partyId).length);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(restored.totalCapacity());
  });

  it('atende dez clientes consecutivos com pagamento único', () => {
    const simulation = stockedSimulation();
    for (let batch = 0; batch < 2; batch += 1) {
      for (let index = 0; index < 5; index += 1) simulation.debugAddCustomer();
      simulation.debugRunFor(220);
    }
    expect(simulation.state.stats.customersServed).toBe(10);
    expect(simulation.activeCustomerCount()).toBe(0);
    expect(simulation.tasks.list()).toHaveLength(0);
    expect(simulation.tables.flatMap((table) => table.chairs).every((seat) => seat.state === 'free')).toBe(true);
  }, 20_000);

  it('funciona em pausa, 1x, 2x e 4x sem persistir o seletor', () => {
    const state = createDefaultState(0); const simulation = new RestaurantSimulation(state); simulation.debugSetAutoSpawn(false);
    simulation.setTimeScale(0); simulation.update(10); expect(simulation.timeScale()).toBe(0);
    simulation.setTimeScale(1); simulation.update(.1); expect(simulation.timeScale()).toBe(1);
    simulation.setTimeScale(2); simulation.update(.1); expect(simulation.timeScale()).toBe(2);
    simulation.setTimeScale(4); simulation.update(.1); expect(simulation.timeScale()).toBe(4);
    simulation.prepareSave(10);
    expect(new RestaurantSimulation(state).timeScale()).toBe(1);
  });

  it('faz todos os timers seguirem a velocidade selecionada', () => {
    const one = stockedSimulation(); const four = stockedSimulation();
    one.debugAddCustomer(); four.debugAddCustomer();
    one.setTimeScale(1); four.setTimeScale(4);
    for (let tick = 0; tick < 200; tick += 1) { one.update(.05); four.update(.05); }
    expect(four.animationClockMs()).toBeGreaterThan(one.animationClockMs());
    expect(four.state.stats.customersServed).toBeGreaterThanOrEqual(one.state.stats.customersServed);
    expect(four.customers[0]?.state).not.toBe(one.customers[0]?.state);
  });
});
