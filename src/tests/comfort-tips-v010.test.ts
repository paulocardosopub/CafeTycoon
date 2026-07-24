import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../game/save/defaultState';
import { RestaurantSimulation, plantComfortBonus, seatComfortBase, serviceTimeBonus, tipChance, tipValue } from '../game/simulation/RestaurantSimulation';

describe('conforto e gorjetas 0.0.10', () => {
  it('aplica conforto base T1 e T2 e limita plantas por assento', () => {
    expect(seatComfortBase('dining.table.basic')).toBe(2);
    expect(seatComfortBase('dining.table.t2')).toBe(10);
    expect(plantComfortBonus(1)).toBe(1); expect(plantComfortBonus(3)).toBe(3); expect(plantComfortBonus(8)).toBe(3);
  });

  it('calcula conforto individual usando Chebyshev a partir da cadeira', () => {
    const state = createDefaultState(0);
    state.construction.placedFurniture = [
      { id: 't2', definitionId: 'dining.table.t2', gridX: 8, gridY: 8, orientation: 'sw', skinId: 'cream-green', level: 1, state: {} },
      { id: 'a', definitionId: 'dining.chair.basic', gridX: 7, gridY: 8, orientation: 'se', skinId: 'cream-green', level: 1, state: { linkedTableId: 't2' } },
      { id: 'b', definitionId: 'dining.chair.basic', gridX: 10, gridY: 8, orientation: 'nw', skinId: 'cream-green', level: 1, state: { linkedTableId: 't2' } },
      { id: 'c', definitionId: 'dining.chair.basic', gridX: 8, gridY: 7, orientation: 'sw', skinId: 'cream-green', level: 1, state: { linkedTableId: 't2' } },
      { id: 'd', definitionId: 'dining.chair.basic', gridX: 8, gridY: 9, orientation: 'sw', skinId: 'cream-green', level: 1, state: { linkedTableId: 't2' } },
      { id: 'plant:near', definitionId: 'decor.plant.basic', gridX: 5, gridY: 8, orientation: 'sw', skinId: 'cream-green', level: 1, state: {} },
      { id: 'plant:far', definitionId: 'decor.plant.basic', gridX: 13, gridY: 8, orientation: 'sw', skinId: 'cream-green', level: 1, state: {} },
    ];
    const simulation = new RestaurantSimulation(state, () => 1);
    expect(simulation.tables[0].chairs).toHaveLength(4);
    expect(simulation.tables[0].chairs.map((seat) => simulation.debugSeatComfort(seat.seatId))).toEqual([11, 10, 10, 10]);
    state.construction.placedFurniture.find((item) => item.id === 't2')!.orientation = 'ne';
    const rotated = new RestaurantSimulation(state, () => 1);
    expect(rotated.tables[0].chairs).toHaveLength(4);
    expect(rotated.tables[0].chairs.map((seat) => rotated.debugSeatComfort(seat.seatId))).toEqual([11, 10, 10, 10]);
  });

  it('respeita limites oficiais de atendimento e formula de chance', () => {
    expect(serviceTimeBonus(12)).toBe(.04); expect(serviceTimeBonus(12.0001)).toBe(.02);
    expect(serviceTimeBonus(25)).toBe(.02); expect(serviceTimeBonus(25.0001)).toBe(0);
    expect(tipChance(10, 'economic', 30)).toBeCloseTo(.054); expect(tipChance(10, 'regular', 30)).toBeCloseTo(.09);
    expect(tipChance(10, 'high_income', 30)).toBeCloseTo(.135); expect(tipChance(100, 'high_income', 0)).toBe(.25);
  });

  it('usa preco unitario, percentual do perfil e minimo de uma moeda', () => {
    expect(tipValue(9, 'economic')).toBe(1); expect(tipValue(100, 'regular')).toBe(10); expect(tipValue(100, 'high_income')).toBe(20);
  });

  it('avalia uma unica vez, credita apenas moedas e persiste a decisao', () => {
    const state = createDefaultState(0);
    state.construction.placedFurniture = [
      { id: 't', definitionId: 'dining.table.basic', gridX: 8, gridY: 8, orientation: 'sw', skinId: 'cream-green', level: 1, state: {} },
      { id: 's', definitionId: 'dining.chair.basic', gridX: 7, gridY: 8, orientation: 'se', skinId: 'cream-green', level: 1, state: { linkedTableId: 't' } },
    ];
    const sim = new RestaurantSimulation(state, () => 0); sim.debugSetAutoSpawn(false);
    const customer = sim.debugAddCustomer()!; const table = sim.tables[0]; const seat = table.chairs[0];
    Object.assign(customer, { tableId: table.id, seatId: seat.seatId, chairIds: [seat.id], economicProfile: 'high_income' }); seat.customerId = customer.id;
    const order = { id: 'order:tip', customerId: customer.id, tableId: table.id, seatId: seat.seatId, chairId: seat.id, recipeId: 'coffee', quantity: 1, state: 'delivered', createdAt: 0, serviceStartedAt: 0, deliveredAt: 12, priority: 1, stepIndex: 0, plateId: 'p', ingredientReservation: {}, ingredientsState: 'none', paymentCompleted: true } as const;
    sim.orders.push({ ...order }); const coins = state.coins; const xp = state.restaurantXp; const reputation = state.reputation;
    sim.debugEvaluateTip(order.id); sim.debugEvaluateTip(order.id);
    expect(state.stats.tipLedger).toEqual([`tip:${order.id}`]); expect(state.coins).toBe(coins + tipValue(5, 'high_income'));
    expect(state.restaurantXp).toBe(xp); expect(state.reputation).toBe(reputation); expect(sim.orders[0].tipEvaluated).toBe(true);
    sim.prepareSave(12); const restored = new RestaurantSimulation(state, () => 0); restored.debugEvaluateTip(order.id);
    expect(state.stats.tipLedger).toEqual([`tip:${order.id}`]);
  });
});
