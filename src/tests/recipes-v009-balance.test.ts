import { describe, expect, it } from 'vitest';
import { RECIPE_ID_ALIASES, RECIPES } from '../content/recipes/recipes';

describe('0.0.9 canonical recipe balance', () => {
  it('has exactly 52 unique canonical IDs, including the three tutorial drinks', () => {
    expect(RECIPES).toHaveLength(52); expect(new Set(RECIPES.map((recipe) => recipe.id)).size).toBe(52);
    expect(RECIPES.map((recipe) => recipe.id)).toEqual(expect.arrayContaining(['coffee', 'cappuccino', 'hot-chocolate']));
    expect(RECIPE_ID_ALIASES['Café da Casa']).toBe('coffee'); expect(Object.values(RECIPE_ID_ALIASES).filter((id) => id === 'coffee')).toHaveLength(2);
  });
  it('keeps the approved authored economy without legacy volume requirements', () => {
    expect(RECIPES.every((recipe) => recipe.batchCost > 0 && recipe.estimatedProfit > 0 && recipe.grossRevenue === recipe.salePrice * recipe.batchYield)).toBe(true);
    expect(RECIPES.find((recipe) => recipe.id === 'coffee')).toMatchObject({ batchYield: 12, batchCost: 20, salePrice: 3, baseDurationSeconds: 15 });
    expect(RECIPES.find((recipe) => recipe.id === 'mozzarella-pizza')).toMatchObject({ batchYield: 60, batchCost: 340, salePrice: 9, baseDurationSeconds: 240 });
  });
});
