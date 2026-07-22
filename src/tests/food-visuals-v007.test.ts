import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RECIPES } from '../content/recipes/recipes';
import type { ServiceCounterModule } from '../core/types';
import {
  FOOD_ASSET_BY_RECIPE,
  FOOD_CLEAN_ASSET_ID,
  FOOD_DIRTY_ASSET_ID,
  FOOD_DISPLAY_SCALE,
  STAGE_2D_FOOD_ASSETS,
  recipeFoodAssetId,
} from '../assets/pixel/stage2dFoodManifest';
import { ServiceCounterStore } from '../game/systems/service-counter/ServiceCounterSystem';
import { gridToWorld, getFootprintFloorAnchorWorld } from '../game/grid/SpatialLayoutService';

const projectRoot = resolve(import.meta.dirname, '../..');

function counter(recipeId: 'coffee' | 'omelette' | 'burger' | 'soup', quantity: number): ServiceCounterModule {
  return {
    id: `counter-${recipeId}`, gridX: 0, gridY: 0, orientation: 'se', assignedRecipeId: recipeId,
    currentQuantity: quantity, reservedQuantity: 0, incomingReservedQuantity: 0, maxCapacity: 24,
    skinId: 'default', level: 1, connectionVariant: 'isolated', kitchenDropSlot: { x: 0, y: 0 }, waiterPickupSlot: { x: 0, y: 1 },
  };
}

describe('pratos definitivos low-poly 0.0.7', () => {
  it('mapeia cada receita ativa para um visual 3D exclusivo', () => {
    expect(Object.keys(FOOD_ASSET_BY_RECIPE).sort()).toEqual(RECIPES.map((recipe) => recipe.id).sort());
    expect(new Set(Object.values(FOOD_ASSET_BY_RECIPE)).size).toBe(RECIPES.length);
    expect(STAGE_2D_FOOD_ASSETS.map((asset) => asset.assetId)).toEqual(expect.arrayContaining([
      ...Object.values(FOOD_ASSET_BY_RECIPE), FOOD_CLEAN_ASSET_ID, FOOD_DIRTY_ASSET_ID,
    ]));
  });

  it('exporta folhas transparentes em quatro direções e escala única', () => {
    expect(FOOD_DISPLAY_SCALE).toBe(.5);
    for (const asset of STAGE_2D_FOOD_ASSETS) {
      expect(asset.frameSize).toEqual([96, 96]);
      expect(asset.frameCount).toBe(1);
      expect(asset.orientations).toEqual(['ne', 'nw', 'se', 'sw']);
      expect(asset.nativeScale).toBe(FOOD_DISPLAY_SCALE);
      const file = resolve(projectRoot, 'public', asset.spriteSheet.slice(1));
      const png = readFileSync(file);
      expect(png.readUInt32BE(16)).toBe(96);
      expect(png.readUInt32BE(20)).toBe(384);
      expect(png[25]).toBe(6);
      expect(statSync(file).size).toBeGreaterThan(1_000);
    }
  });

  it('mantém a receita correta em balcões vazios, unitários e agrupados', () => {
    const modules = RECIPES.map((recipe, index) => counter(recipe.id, index));
    const store = new ServiceCounterStore(modules);
    expect(store.total('coffee')).toBe(0);
    expect(store.total('omelette')).toBe(1);
    expect(store.total('burger')).toBe(2);
    expect(store.total('soup')).toBe(3);
    expect(store.reserve('burger', 2)).toEqual([{ moduleId: 'counter-burger', quantity: 2 }]);
    expect(store.consume([{ moduleId: 'counter-burger', quantity: 2 }])).toBe(true);
    expect(store.total('burger')).toBe(0);
  });

  it('usa a mesma identidade no balcão, transporte, mesa e louça suja', () => {
    const scene = readFileSync(resolve(projectRoot, 'src/scenes/RestaurantScene.ts'), 'utf8');
    expect(scene).not.toContain('WORLD_ASSETS.dish');
    expect(scene).toContain('recipeFoodAssetId(counter?.assignedRecipeId)');
    expect(scene).toContain('recipeFoodAssetId(carriedOrder?.recipeId)');
    expect(scene).toContain('recipeFoodAssetId(order?.recipeId)');
    expect(scene).toContain('readyCount >= 2');
    expect(scene).toContain('FOOD_DIRTY_ASSET_ID');
    expect(recipeFoodAssetId(undefined)).toBe(FOOD_CLEAN_ASSET_ID);
  });

  it('apoia os pés no vértice inferior, põe pratos no tampo e limpa os ícones de estado', () => {
    const center = gridToWorld({ x: 7, y: 9 });
    const floor = getFootprintFloorAnchorWorld({ x: 7, y: 9 }, { width: 1, depth: 1 });
    expect(floor.y - center.y).toBe(16);
    const scene = readFileSync(resolve(projectRoot, 'src/scenes/RestaurantScene.ts'), 'utf8');
    expect(scene).toContain('characterFloorPoint(actor.visual)');
    expect(scene).toContain('characterFloorPoint(customer.position)');
    expect(scene).toContain('const dishPoint = tableDishPoint(table.position, seat.position)');
    expect(scene).toContain('const tabletopCenter = { x: tableBase.x, y: tableBase.y - 50 }');
    expect(scene).toContain('Math.sign(chairBase.x - tableBase.x) * 14');
    expect(scene).toContain('Math.sign(chairBase.y - tableBase.y) * 7');
    expect(scene).toContain('carriedDishPoint(point, actor.direction)');
    expect(scene).toContain("actor.direction === 'nw' || actor.direction === 'ne'");
    expect(scene).toContain('standingCharacter - 2');
    expect(scene).toContain('standingCharacter + 8');
    expect(scene).toContain('Math.round(point.y - 56)');
    expect(scene).toContain('visual.effect.setVisible(false)');
    expect(scene).not.toContain('customerStatusIcon');
    expect(scene).not.toContain("active ? '●'");
  });
});
