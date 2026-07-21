import type { IngredientDefinition, IngredientId, StorageType } from '../../core/types';

export const INGREDIENTS: IngredientDefinition[] = [
  ingredient('bread', 'Pão artesanal', 'pantry', 8, 20, 12, 5, 5, 14, 'un.', 'PÃO'),
  ingredient('beef', 'Carne', 'fresh', 7, 18, 22, 4, 4, 12, 'porções', 'CAR'),
  ingredient('cheese', 'Queijo', 'fresh', 8, 18, 15, 5, 4, 13, 'fatias', 'QUE'),
  ingredient('egg', 'Ovos', 'fresh', 12, 24, 13, 6, 6, 18, 'un.', 'OVO'),
  ingredient('tomato', 'Tomate', 'fresh', 10, 22, 10, 6, 5, 16, 'un.', 'TOM'),
  ingredient('coffee', 'Café', 'drink', 10, 20, 14, 5, 5, 15, 'doses', 'CAF'),
  ingredient('water', 'Água', 'drink', 18, 30, 6, 8, 7, 24, 'copos', 'ÁGU'),
  ingredient('vegetables', 'Legumes', 'fresh', 10, 22, 16, 5, 5, 16, 'porções', 'LEG'),
  ingredient('seasoning', 'Temperos', 'pantry', 14, 24, 9, 6, 6, 19, 'doses', 'TEM'),
];

function ingredient(
  id: IngredientId, name: string, category: IngredientDefinition['category'], startingAmount: number, maxAmount: number,
  purchaseCost: number, purchaseAmount: number, reorderPoint: number, targetStock: number, unit: string, icon: string,
): IngredientDefinition {
  const storageType: StorageType = id === 'coffee' || category === 'pantry' ? 'dry' : category === 'fresh' ? 'refrigerated' : 'general';
  const compatibleStorageTypes: StorageType[] = storageType === 'refrigerated'
    ? (id === 'beef' ? ['refrigerated', 'frozen'] : ['refrigerated'])
    : storageType === 'dry' ? ['dry', 'general'] : ['general', 'dry'];
  return {
    id, name, category, startingAmount, maxAmount, purchaseCost, purchaseAmount, unit, icon,
    reorderPoint, targetStock, quickBuyPackSize: purchaseAmount, maxStock: maxAmount, purchasePrice: purchaseCost,
    storageType, compatibleStorageTypes, storageSize: 1,
  };
}

export const INGREDIENT_BY_ID = Object.fromEntries(INGREDIENTS.map((item) => [item.id, item])) as Record<IngredientId, IngredientDefinition>;
