import { describe, expect, it } from 'vitest';
import { RECIPE_ID_ALIASES, RECIPES } from '../content/recipes/recipes';

describe('0.0.9 canonical recipe balance', () => {
  it('has exactly 52 unique canonical IDs, including the three tutorial drinks', () => {
    expect(RECIPES).toHaveLength(52); expect(new Set(RECIPES.map((recipe) => recipe.id)).size).toBe(52);
    expect(RECIPES.map((recipe) => recipe.id)).toEqual(expect.arrayContaining(['coffee', 'cappuccino', 'hot-chocolate']));
    expect(RECIPE_ID_ALIASES['Café da Casa']).toBe('coffee'); expect(Object.values(RECIPE_ID_ALIASES).filter((id) => id === 'coffee')).toHaveLength(2);
  });
  it('keeps authored economy positive and the required early high-volume choices', () => {
    expect(RECIPES.every((recipe) => recipe.batchCost > 0 && recipe.estimatedProfit > 0 && recipe.grossRevenue === recipe.salePrice * recipe.batchYield)).toBe(true);
    expect(RECIPES.filter((recipe) => recipe.requiredLevel <= 10 && recipe.batchYield > 100).length).toBeGreaterThanOrEqual(3);
    expect(RECIPES.find((recipe) => recipe.id === 'chocolate-cookies')?.batchYield).toBeGreaterThanOrEqual(120);
    expect(RECIPES.find((recipe) => recipe.id === 'cheese-bread')?.batchYield).toBeGreaterThanOrEqual(200);
    expect(RECIPES.find((recipe) => recipe.id === 'mozzarella-pizza')?.batchYield).toBeGreaterThanOrEqual(300);
    expect(RECIPES.find((recipe) => recipe.id === 'croissant')?.batchYield).toBeGreaterThanOrEqual(500);
  });
});
