import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INGREDIENTS } from '../content/ingredients/ingredients';
import { RECIPE_BY_ID } from '../content/recipes/recipes';
import type { PlacedFurniture } from '../core/types';
import { createProductionPlan, preparedQuantity, prepareNextProductionTask } from '../game/cooking/ProductionPlanningService';
import { createStations } from '../game/map/initialMap';
import { recipeIsOperational, recipeRequirements } from '../game/recipes/RecipeAvailability';
import { createDefaultState } from '../game/save/defaultState';
import { RestaurantSimulation } from '../game/simulation/RestaurantSimulation';
import { gameEvents } from '../core/events';

const coffeeMachine = (): PlacedFurniture => ({
  id: 'coffee:extra', definitionId: 'cooking.a8.coffee', gridX: 14, gridY: 4,
  orientation: 'sw', skinId: 'steel-standard', level: 1, state: {},
});

describe('pré-requisitos e produção de receitas', () => {
  it('mostra máquina de café ausente e libera Café da Casa quando instalada', () => {
    const state = createDefaultState(0);
    expect(recipeIsOperational(state, RECIPE_BY_ID.coffee)).toBe(false);
    expect(recipeRequirements(state, RECIPE_BY_ID.coffee)).toContainEqual(expect.objectContaining({ id: 'station:coffee_machine', satisfied: false }));
    state.construction.placedFurniture.push(coffeeMachine());
    expect(recipeIsOperational(state, RECIPE_BY_ID.coffee)).toBe(true);
  });

  it('reaproveita balcão vazio de outra receita para produzir Café da Casa', () => {
    const state = createDefaultState(0);
    state.construction.placedFurniture.push(coffeeMachine());
    for (const ingredient of INGREDIENTS) state.inventory[ingredient.id] = ingredient.maxStock;
    const counter = state.construction.serviceCounters[0];
    expect(counter.assignedRecipeId).toBe('omelette');
    expect(createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 1, batchSize: 1 }, 1).ok).toBe(true);
    const prepared = prepareNextProductionTask(state, createStations(state.construction), state.construction.serviceCounters, 2);
    expect(prepared?.task.recipeId).toBe('coffee');
    expect(counter.assignedRecipeId).toBe('coffee');
    expect(counter.incomingReservedQuantity).toBe(1);
  });

  it('prioriza prato produzido em massa para cliente com pedido igual', () => {
    const state = createDefaultState(0);
    for (const ingredient of INGREDIENTS) state.inventory[ingredient.id] = ingredient.maxStock;
    const simulation = new RestaurantSimulation(state);
    simulation.debugSetAutoSpawn(false);
    simulation.debugSeatGroupAtFirstTable(1);
    expect(simulation.debugSimulateOrder()).toBe(true);
    const order = simulation.orders[0];
    expect(order.recipeId).toBe('omelette');
    expect(order.ingredientsState).toBe('reserved');
    const counter = simulation.counterModules.find((module) => module.assignedRecipeId === order.recipeId)!;
    counter.currentQuantity = 1;
    simulation.debugRunFor(.2, 1);
    expect(order.ingredientsState).toBe('none');
    expect(['awaiting_pickup', 'transporting', 'delivered']).toContain(order.state);
    expect(simulation.tasks.list().find((task) => task.kind === 'deliver' && task.payload.orderId === order.id)?.priority).toBe(150);
  });

  it('serve 10 omeletes produzidas ao salão cheio mesmo sem egg restante', () => {
    const state = createDefaultState(0);
    for (const ingredient of INGREDIENTS) state.inventory[ingredient.id] = ingredient.maxStock;
    expect(createProductionPlan(state, { recipeId: 'omelette', targetQuantity: 10, batchSize: 10 }, 1).ok).toBe(true);
    const simulation = new RestaurantSimulation(state);
    simulation.debugSetAutoSpawn(false);
    simulation.debugRunFor(220, 4);
    expect(preparedQuantity(simulation.counterModules, 'omelette')).toBe(10);

    state.inventory.egg = 0;
    const customers = simulation.debugSeatGroupAtFirstTable(simulation.tables[0].chairs.length);
    expect(customers).toHaveLength(simulation.tables[0].chairs.length);
    for (const customer of customers) {
      expect(simulation.debugSimulateOrder()).toBe(true);
      expect(simulation.orders.find((order) => order.customerId === customer.id)?.recipeId).toBe('omelette');
    }
    simulation.debugRunFor(35, 4);
    const customerOrders = simulation.orders.filter((order) => customers.some((customer) => customer.id === order.customerId));
    expect(customerOrders).toHaveLength(customers.length);
    expect(customerOrders.every((order) => !['awaiting_ingredients', 'awaiting_station', 'preparing'].includes(order.state))).toBe(true);
    expect(preparedQuantity(simulation.counterModules, 'omelette')).toBe(10 - customers.length);
    expect(simulation.tasks.list().some((task) => task.kind === 'cook_step' && customerOrders.some((order) => order.id === task.payload.orderId))).toBe(false);
  });

  it('não anuncia falta de ovos quando o estoque existe, mas está reservado', () => {
    const state = createDefaultState(0);
    state.inventory.egg = 2;
    const messages: { message: string; tone: string }[] = [];
    const unsubscribe = gameEvents.on<{ message: string; tone: string }>('toast', (message) => messages.push(message));
    const simulation = new RestaurantSimulation(state);
    state.inventoryReserved.egg = 2;
    simulation.debugSetAutoSpawn(false); simulation.debugSeatGroupAtFirstTable(1);
    expect(simulation.debugSimulateOrder()).toBe(true);
    unsubscribe();
    expect(messages.at(-1)?.message).toContain('Ovos em uso em outro preparo');
    expect(messages.at(-1)?.message).not.toContain('FALTA');
    expect(messages.at(-1)?.tone).toBe('info');
  });

  it('oferece somente um balcão de serviço no catálogo da loja', () => {
    const shop = readFileSync(resolve(import.meta.dirname, '../ui/ConstructionShop.ts'), 'utf8');
    expect(shop).toContain("!['service.c2.left', 'service.c3.middle', 'service.c4.right'].includes(definition.id)");
  });
});
