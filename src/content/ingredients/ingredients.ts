import type { IngredientDefinition, IngredientId, StorageType } from '../../core/types';

export const INGREDIENTS: IngredientDefinition[] = [
  ingredient('bread', 'Pão artesanal', 'pantry', 16, 40, 12, 5, 10, 28, 'un.', 'PÃO'),
  ingredient('beef', 'Carne', 'fresh', 14, 36, 22, 4, 8, 24, 'porções', 'CAR'),
  ingredient('cheese', 'Queijo', 'fresh', 16, 36, 15, 5, 8, 26, 'fatias', 'QUE'),
  ingredient('egg', 'Ovos', 'fresh', 24, 48, 13, 6, 12, 36, 'un.', 'OVO'),
  ingredient('tomato', 'Tomate', 'fresh', 20, 44, 10, 6, 10, 32, 'un.', 'TOM'),
  ingredient('coffee', 'Café', 'drink', 20, 40, 14, 5, 10, 30, 'doses', 'CAF'),
  ingredient('water', 'Água', 'drink', 30, 60, 6, 8, 14, 48, 'copos', 'ÁGU'),
  ingredient('vegetables', 'Legumes', 'fresh', 20, 44, 16, 5, 10, 32, 'porções', 'LEG'),
  ingredient('seasoning', 'Temperos', 'pantry', 28, 48, 9, 6, 12, 38, 'doses', 'TEM'),
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
