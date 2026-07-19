import type { IngredientDefinition, IngredientId } from '../../core/types';

export const INGREDIENTS: IngredientDefinition[] = [
  { id: 'bread', name: 'Pão artesanal', category: 'pantry', startingAmount: 8, maxAmount: 20, purchaseCost: 12, purchaseAmount: 5, unit: 'un.', icon: '🥖' },
  { id: 'beef', name: 'Carne', category: 'fresh', startingAmount: 7, maxAmount: 18, purchaseCost: 22, purchaseAmount: 4, unit: 'porções', icon: '🥩' },
  { id: 'cheese', name: 'Queijo', category: 'fresh', startingAmount: 8, maxAmount: 18, purchaseCost: 15, purchaseAmount: 5, unit: 'fatias', icon: '🧀' },
  { id: 'egg', name: 'Ovos', category: 'fresh', startingAmount: 12, maxAmount: 24, purchaseCost: 13, purchaseAmount: 6, unit: 'un.', icon: '🥚' },
  { id: 'tomato', name: 'Tomate', category: 'fresh', startingAmount: 10, maxAmount: 22, purchaseCost: 10, purchaseAmount: 6, unit: 'un.', icon: '🍅' },
  { id: 'coffee', name: 'Café', category: 'drink', startingAmount: 10, maxAmount: 20, purchaseCost: 14, purchaseAmount: 5, unit: 'doses', icon: '🫘' },
  { id: 'water', name: 'Água', category: 'drink', startingAmount: 18, maxAmount: 30, purchaseCost: 6, purchaseAmount: 8, unit: 'copos', icon: '💧' },
  { id: 'vegetables', name: 'Legumes', category: 'fresh', startingAmount: 10, maxAmount: 22, purchaseCost: 16, purchaseAmount: 5, unit: 'porções', icon: '🥕' },
  { id: 'seasoning', name: 'Temperos', category: 'pantry', startingAmount: 14, maxAmount: 24, purchaseCost: 9, purchaseAmount: 6, unit: 'doses', icon: '🌿' },
];

export const INGREDIENT_BY_ID = Object.fromEntries(INGREDIENTS.map((item) => [item.id, item])) as Record<IngredientId, IngredientDefinition>;
