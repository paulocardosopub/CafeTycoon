import type { RecipeDefinition, RecipeId } from '../../core/types';

export const RECIPES: RecipeDefinition[] = [
  {
    id: 'coffee', name: 'Café da Casa', description: 'Café aromático passado na hora.', icon: '☕', category: 'drink',
    ingredients: [{ ingredientId: 'coffee', amount: 1 }, { ingredientId: 'water', amount: 1 }],
    steps: [{ stationId: 'coffee_machine', duration: 6, label: 'Passar o café' }, { stationId: 'pickup', duration: 2, label: 'Finalizar a xícara' }],
    yield: 1, salePrice: 22, experience: 5, requiredLevel: 1, storageSpace: 1,
  },
  {
    id: 'omelette', name: 'Omelete Solar', description: 'Ovos macios, tomate e ervas frescas.', icon: '🍳', category: 'breakfast',
    ingredients: [{ ingredientId: 'egg', amount: 2 }, { ingredientId: 'tomato', amount: 1 }, { ingredientId: 'seasoning', amount: 1 }],
    steps: [{ stationId: 'prep', duration: 4, label: 'Preparar ingredientes' }, { stationId: 'stove', duration: 8, label: 'Cozinhar omelete' }, { stationId: 'pickup', duration: 2, label: 'Empratar' }],
    yield: 1, salePrice: 38, experience: 9, requiredLevel: 1, storageSpace: 1,
  },
  {
    id: 'burger', name: 'Brasa Bloom', description: 'Hambúrguer da casa com queijo e tomate.', icon: '🍔', category: 'main',
    ingredients: [{ ingredientId: 'bread', amount: 1 }, { ingredientId: 'beef', amount: 1 }, { ingredientId: 'cheese', amount: 1 }, { ingredientId: 'tomato', amount: 1 }],
    steps: [{ stationId: 'prep', duration: 4, label: 'Separar ingredientes' }, { stationId: 'grill', duration: 10, label: 'Grelhar carne' }, { stationId: 'assembly', duration: 5, label: 'Montar hambúrguer' }, { stationId: 'pickup', duration: 2, label: 'Levar à retirada' }],
    yield: 1, salePrice: 55, experience: 13, requiredLevel: 2, storageSpace: 1,
  },
  {
    id: 'soup', name: 'Sopa do Jardim', description: 'Legumes cozidos lentamente com temperos.', icon: '🥣', category: 'soup',
    ingredients: [{ ingredientId: 'vegetables', amount: 2 }, { ingredientId: 'water', amount: 1 }, { ingredientId: 'seasoning', amount: 1 }],
    steps: [{ stationId: 'prep', duration: 5, label: 'Cortar legumes' }, { stationId: 'cauldron', duration: 12, label: 'Cozinhar sopa' }, { stationId: 'pickup', duration: 2, label: 'Servir a tigela' }],
    yield: 1, salePrice: 44, experience: 11, requiredLevel: 2, storageSpace: 1,
  },
];

export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((recipe) => [recipe.id, recipe])) as Record<RecipeId, RecipeDefinition>;
