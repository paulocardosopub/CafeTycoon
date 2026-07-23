import type { IngredientDefinition, IngredientId, StorageType } from '../../core/types';

type Category = IngredientDefinition['category'];
const rows: readonly [IngredientId,string,Category,StorageType,number][] = [
  ['bread','Pão artesanal','pantry','dry',12],['beef','Carne bovina','fresh','refrigerated',22],['cheese','Queijo','fresh','refrigerated',15],
  ['egg','Ovos','fresh','refrigerated',13],['tomato','Tomate','fresh','refrigerated',10],['coffee','Café','drink','dry',14],
  ['water','Água','drink','general',6],['vegetables','Legumes','fresh','refrigerated',16],['seasoning','Temperos','pantry','dry',9],
  ['milk','Leite','drink','refrigerated',13],['sugar','Açúcar','pantry','dry',8],['flour','Farinha','pantry','dry',9],
  ['butter','Manteiga','fresh','refrigerated',14],['onion','Cebola','fresh','dry',8],['potato','Batata','fresh','dry',10],
  ['oil','Óleo','pantry','dry',12],['rice','Arroz','pantry','dry',11],['fish','Peixe','fresh','frozen',24],
  ['fruit','Frutas','fresh','refrigerated',15],['ice','Gelo','drink','frozen',6],['noodles','Massa','pantry','dry',11],
  ['pork','Carne suína','fresh','refrigerated',19],['chicken','Frango','fresh','frozen',17],['shrimp','Camarão','fresh','frozen',28],
  ['mushroom','Cogumelos','fresh','refrigerated',18],['chocolate','Chocolate','pantry','dry',16],['herbs','Ervas frescas','fresh','refrigerated',10],
] as const;

export const INGREDIENTS: IngredientDefinition[] = rows.map(([id,name,category,storageType,purchaseCost], index) => ({
  id, name, category, startingAmount: index < 9 ? [16,14,16,24,20,20,30,20,28][index]! : 0, maxAmount: index < 9 ? [40,36,36,48,44,40,60,44,48][index]! : 240, purchaseCost, purchaseAmount: index < 9 ? [5,4,5,6,6,5,8,5,6][index]! : 20, unit: 'porções', icon: name.slice(0,3).toUpperCase(),
  reorderPoint: index < 9 ? [10,8,8,12,10,10,14,10,12][index]! : 20, targetStock: index < 9 ? [28,24,26,36,32,30,48,32,38][index]! : 80, quickBuyPackSize: index < 9 ? [5,4,5,6,6,5,8,5,6][index]! : 20, maxStock: index < 9 ? [40,36,36,48,44,40,60,44,48][index]! : 240, purchasePrice: purchaseCost,
  storageType, compatibleStorageTypes: storageType === 'frozen' ? ['frozen'] : storageType === 'refrigerated' ? ['refrigerated','frozen'] : storageType === 'dry' ? ['dry','general'] : ['general','dry'], storageSize: 1,
}));

export const INGREDIENT_BY_ID = Object.fromEntries(INGREDIENTS.map((item) => [item.id, item])) as Record<IngredientId, IngredientDefinition>;
