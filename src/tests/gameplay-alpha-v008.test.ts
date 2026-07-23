import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GAME_VERSION, SAVE_SCHEMA_VERSION, BALANCE, levelFromXp } from '../config/balance';
import { RECIPE_BY_ID, RECIPES } from '../content/recipes/recipes';
import { LEVEL_REWARDS } from '../content/progression/levels';
import { STAGE_2D_FOOD_ASSETS } from '../assets/pixel/stage2dFoodManifest';
import { createDefaultState } from '../game/save/defaultState';
import { migrateAndSanitizeSave } from '../game/save/migrations';
import { createProductionPlan } from '../game/cooking/ProductionPlanningService';
import { compatibleStationFunction } from '../game/recipes/RecipeAvailability';
import { validateFurniturePlacement } from '../game/systems/furniture/FurniturePlacement';
import { ServiceCounterStore } from '../game/systems/service-counter/ServiceCounterSystem';
import { STAFF_BY_ID } from '../game/data/staff';
import { createStaffInstance } from '../game/staff/StaffService';
import type { PlacedFurniture, ServiceCounterModule } from '../core/types';

const root = resolve(import.meta.dirname, '../..');

describe('Cafe Mania 0.0.8 · alpha de gameplay', () => {
  it('publica exatamente a versão e o schema novos', () => {
    expect(GAME_VERSION).toBe('0.0.8');
    expect(SAVE_SCHEMA_VERSION).toBe(6);
  });

  it('contém exatamente 52 receitas únicas em ordem estável', () => {
    expect(RECIPES).toHaveLength(52);
    expect(new Set(RECIPES.map((recipe) => recipe.id))).toHaveLength(52);
    expect(RECIPES.map((recipe) => recipe.menuOrder)).toEqual(Array.from({ length: 52 }, (_, index) => index + 1));
  });

  it('começa no Café preto e termina no Medalhão trufado', () => {
    expect(RECIPES[0]).toMatchObject({ id: 'coffee', name: 'Café preto', requiredLevel: 1, batchYield: 12 });
    expect(RECIPES.at(-1)).toMatchObject({ id: 'truffle-medallion-puree', requiredLevel: 100, batchYield: 18 });
  });

  it('mantém duração, rendimento e economia válidos em todas as receitas', () => {
    for (const recipe of RECIPES) {
      expect(recipe.baseDurationSeconds).toBeGreaterThan(0);
      expect(recipe.batchYield).toBeGreaterThan(0);
      expect(recipe.grossRevenue).toBe(recipe.salePrice * recipe.batchYield);
      expect(recipe.estimatedProfit).toBe(recipe.grossRevenue - recipe.batchCost);
      expect(recipe.estimatedProfit).toBeGreaterThan(0);
    }
  });

  it('preserva os quatro IDs históricos para saves antigos', () => {
    expect(RECIPE_BY_ID.coffee.aliases).toContain('Café da Casa');
    expect(RECIPE_BY_ID.omelette.aliases).toContain('Omelete Solar');
    expect(RECIPE_BY_ID.soup.aliases).toContain('Sopa do Jardim');
    expect(RECIPE_BY_ID.burger.aliases).toContain('Brasa Bloom');
  });

  it('usa lotes fixos independentemente de quantidade arbitrária da interface antiga', () => {
    const state = createDefaultState(0);
    state.staff.instances.push(createStaffInstance(STAFF_BY_ID['cook-0'], 0));
    const coinsBefore = state.coins;
    const result = createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 999, batchSize: 7 });
    expect(result.ok).toBe(true);
    expect(result.plan).toMatchObject({ targetQuantity: 12, batchSize: 12, repeat: false, mode: 'singleBatch' });
    expect(state.production.tasks).toHaveLength(1);
    expect(state.production.tasks[0]?.batchQuantity).toBe(12);
    expect(state.production.tasks[0]?.requiredIngredients).toEqual({});
    expect(state.coins).toBe(coinsBefore - RECIPE_BY_ID.coffee.batchCost);
  });

  it('bloqueia um lote sem dinheiro e não cobra duas vezes', () => {
    const state = createDefaultState(0); state.coins = RECIPE_BY_ID.coffee.batchCost - 1;
    expect(createProductionPlan(state, { recipeId: 'coffee', targetQuantity: 12 }).ok).toBe(false);
    expect(state.coins).toBe(RECIPE_BY_ID.coffee.batchCost - 1);
    expect(state.production.tasks).toHaveLength(0);
  });

  it('bloqueia receita sem profissional e informa a especialidade ausente', () => {
    const state = createDefaultState(0); state.restaurantLevel = 10; state.coins = 10_000;
    const result = createProductionPlan(state, { recipeId: 'burger', targetQuantity: 16 });
    expect(result).toMatchObject({ ok: false });
    expect(result.reason).toContain('Chapeiro');
    expect(state.production.tasks).toHaveLength(0);
  });

  it('acumula quantidades ilimitadas do mesmo prato no mesmo balcão', () => {
    const module: ServiceCounterModule = { id: 'counter:test', gridX: 1, gridY: 1, orientation: 'sw', assignedRecipeId: 'coffee', currentQuantity: 1_000_000, reservedQuantity: 0, incomingReservedQuantity: 0, maxCapacity: Number.MAX_SAFE_INTEGER, skinId: 'cream-green', level: 1, connectionVariant: 'isolated', kitchenDropSlot: { x: 1, y: 0 }, waiterPickupSlot: { x: 1, y: 2 } };
    const store = new ServiceCounterStore([module]);
    expect(store.deposit('coffee', 500_000)).toBe(500_000);
    expect(module.currentQuantity).toBe(1_500_000);
  });

  it('remove a parede lógica na emenda após expandir', () => {
    const item: PlacedFurniture = { id: 'table:seam', definitionId: 'dining.table.basic', gridX: 17, gridY: 8, orientation: 'sw', skinId: 'cream-green', level: 1, state: {} };
    const builtAreas = [{ id: 'base', x: 0, y: 0, width: 18, depth: 18, kind: 'base' as const }, { id: 'east', x: 18, y: 0, width: 18, depth: 18, kind: 'expansion' as const }];
    expect(validateFurniturePlacement(item, [], builtAreas).errors).not.toContain('O footprint invade uma parede.');
  });

  it('não desbloqueia receitas antes do nível exigido', () => {
    expect(RECIPES.filter((recipe) => recipe.requiredLevel <= 1).map((recipe) => recipe.id)).toEqual(['coffee']);
    expect(RECIPE_BY_ID['truffle-medallion-puree'].requiredLevel).toBe(100);
  });

  it('define exatamente cem recompensas sem nível vazio', () => {
    expect(LEVEL_REWARDS).toHaveLength(100);
    expect(LEVEL_REWARDS.map((reward) => reward.level)).toEqual(Array.from({ length: 100 }, (_, index) => index + 1));
    expect(LEVEL_REWARDS.every((reward) => reward.name && reward.description)).toBe(true);
  });

  it('possui curva crescente e alcança nível 100', () => {
    expect(BALANCE.restaurantLevels).toHaveLength(100);
    expect(BALANCE.restaurantLevels.every((value, index, values) => index === 0 || value > values[index - 1]!)).toBe(true);
    expect(levelFromXp(Number.MAX_SAFE_INTEGER, BALANCE.restaurantLevels)).toBe(100);
  });

  it('limita a simulação offline a oito horas', () => {
    expect(BALANCE.offline.maxSeconds).toBe(28_800);
  });

  it('mapeia novas famílias de estação para equipamento funcional', () => {
    expect(compatibleStationFunction('fryer')).toBe('grill');
    expect(compatibleStationFunction('cold_prep')).toBe('prep');
    expect(compatibleStationFunction('beverage')).toBe('coffee_machine');
    expect(compatibleStationFunction('wok')).toBe('stove');
    expect(compatibleStationFunction('smoker')).toBe('grill');
    expect(compatibleStationFunction('pastry')).toBe('prep');
  });

  it('inclui receitas realmente multiestação no endgame', () => {
    for (const id of ['gratin-onion-soup', 'sushi-combo', 'filet-mignon-madeira', 'premium-seafood-board', 'truffle-medallion-puree']) {
      expect(new Set(RECIPE_BY_ID[id].steps.map((step) => step.stationId)).size).toBeGreaterThan(1);
    }
  });

  it('exporta 52 sprites individuais transparentes sem prancha na gameplay', () => {
    const foods = STAGE_2D_FOOD_ASSETS.filter((asset) => asset.assetId.startsWith('food_v008_'));
    expect(foods).toHaveLength(52);
    for (const asset of foods) {
      const file = resolve(root, 'public', asset.spriteSheet.slice(1));
      expect(existsSync(file)).toBe(true);
      const png = readFileSync(file);
      expect(png.readUInt32BE(16)).toBe(96);
      expect(png.readUInt32BE(20)).toBe(384);
      expect(png[25]).toBe(6);
      expect(statSync(file).size).toBeGreaterThan(500);
    }
  });

  it('não usa ícone genérico ou nome renderizado como prato', () => {
    expect(RECIPES.every((recipe) => recipe.assetId.startsWith('food_v008_') && recipe.icon === '')).toBe(true);
    const scene = readFileSync(resolve(root, 'src/scenes/RestaurantScene.ts'), 'utf8');
    expect(scene).toContain('recipeFoodAssetId');
  });

  it('migra save antigo sem perder moedas, nível ou os quatro pratos existentes', () => {
    const old = createDefaultState(1) as ReturnType<typeof createDefaultState>;
    old.schemaVersion = 5; old.gameVersion = '0.0.7'; old.coins = 777; old.restaurantLevel = 3; old.readyDishes.coffee = 9;
    const migrated = migrateAndSanitizeSave(old, 2);
    expect(migrated).toMatchObject({ schemaVersion: 6, gameVersion: '0.0.8', coins: 777, restaurantLevel: 3 });
    expect(migrated.readyDishes.coffee).toBe(9);
    expect(Object.keys(migrated.readyDishes)).toHaveLength(52);
  });

  it('cria estoque preparado para todas as receitas sem duplicar comida', () => {
    const state = createDefaultState(0);
    expect(Object.keys(state.readyDishes)).toHaveLength(52);
    expect(Object.values(state.readyDishes).reduce((sum, quantity) => sum + quantity, 0)).toBe(0);
  });

  it('mantém nomes de prato fora da cena de gameplay', () => {
    const scene = readFileSync(resolve(root, 'src/scenes/RestaurantScene.ts'), 'utf8');
    for (const recipe of RECIPES) expect(scene).not.toContain(`text: '${recipe.name}'`);
  });

  it('expõe perfis de tempo express, rápido, médio, longo, madrugada, premium e lendário', () => {
    expect(new Set(RECIPES.map((recipe) => recipe.durationProfile))).toEqual(new Set(['express','quick','medium','long','overnight','premium','legendary']));
  });

  it.each([
    ['coffee',1,30,12],['chocolate-cookies',2,21600,160],['omelette',4,45,8],['burger',10,300,16],
    ['caldo-verde',18,21600,140],['croissant',22,14400,80],['feijoada',36,28800,180],['mexican-tacos',40,480,24],
    ['ramen',46,3000,36],['barbecue-ribs',48,28800,160],['gratin-onion-soup',60,3600,48],['sushi-combo',64,720,20],
    ['picanha',72,900,18],['latte-art',80,120,10],['butter-lobster',88,3600,20],['filet-mignon-madeira',91,2700,24],
    ['premium-seafood-board',98,14400,40],['truffle-medallion-puree',100,3600,18],
  ] as const)('valida checkpoint de balanceamento %s', (id, level, duration, batchYield) => {
    expect(RECIPE_BY_ID[id]).toMatchObject({ requiredLevel: level, baseDurationSeconds: duration, batchYield });
  });
});
