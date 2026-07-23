import type { RecipeDefinition, RecipeId, RecipeStep, StationId } from '../../core/types';

type Profile = RecipeDefinition['durationProfile'];
type RecipeRow = readonly [RecipeId, string, number, Profile, number, number, StationId, string];

// Fonte única da progressão 0.0.8. A ordem também é a associação oficial com
// as quatro pranchas de 13 pratos fornecidas para a versão.
export const RECIPE_ROWS: readonly RecipeRow[] = [
  ['coffee','Café preto',1,'express',30,12,'coffee_machine','Barista'],
  ['chocolate-cookies','Cookies de chocolate',5,'quick',300,24,'oven','Forneiro'],
  ['soup','Sopa de tomate',10,'quick',600,24,'cauldron','Chef de Sopas'],
  ['omelette','Omelete de queijo e ervas',15,'express',45,8,'stove','Cozinheiro Geral'],
  ['french-fries','Batata frita',20,'quick',240,20,'fryer','Fritureiro'],
  ['cheese-bread','Pão de queijo',7,'medium',720,36,'oven','Forneiro'],
  ['hot-dog','Cachorro-quente',25,'express',60,10,'grill','Chapeiro'],
  ['cheese-tapioca','Tapioca de queijo',26,'express',75,10,'grill','Chapeiro'],
  ['misto-quente','Misto-quente',27,'express',90,10,'grill','Chapeiro'],
  ['burger','Hambúrguer clássico',28,'quick',300,16,'grill','Chapeiro'],
  ['honey-pancakes','Panquecas com mel',29,'quick',360,18,'grill','Chapeiro'],
  ['coxinha','Coxinha',21,'medium',900,30,'fryer','Fritureiro'],
  ['caesar-salad','Salada Caesar',16,'quick',240,16,'cold_prep','Cozinheiro Geral'],
  ['tomato-spaghetti','Espaguete ao molho de tomate',17,'medium',900,30,'stove','Cozinheiro Geral'],
  ['cappuccino','Cappuccino',2,'express',45,12,'coffee_machine','Barista'],
  ['mozzarella-pizza','Pizza de muçarela',8,'medium',900,30,'oven','Forneiro'],
  ['grilled-chicken-rice','Frango grelhado com arroz',30,'medium',1200,30,'grill','Chapeiro'],
  ['caldo-verde','Caldo verde',11,'medium',1200,36,'cauldron','Chef de Sopas'],
  ['donuts','Donuts',22,'medium',1200,30,'fryer','Fritureiro'],
  ['cheeseburger','Cheeseburger',31,'quick',420,18,'grill','Chapeiro'],
  ['croissant','Croissant',9,'medium',1800,30,'oven','Forneiro'],
  ['meat-pastel','Pastel de carne',23,'quick',480,24,'fryer','Fritureiro'],
  ['bolognese-lasagna','Lasanha à bolonhesa',12,'medium',1800,24,'oven','Forneiro'],
  ['mushroom-risotto','Risoto de cogumelos',18,'medium',1200,24,'stove','Cozinheiro Geral'],
  ['fish-moqueca','Moqueca de peixe',19,'medium',1800,24,'stove','Cozinheiro Geral'],
  ['hot-chocolate','Chocolate quente',3,'express',60,12,'coffee_machine','Barista'],
  ['fish-and-chips','Fish and chips',24,'quick',600,22,'fryer','Fritureiro'],
  ['feijoada','Feijoada',36,'overnight',28800,180,'cauldron','Chef de Sopas'],
  ['roast-chicken-vegetables','Frango assado com legumes',38,'long',14400,80,'oven','Forneiro'],
  ['mexican-tacos','Tacos mexicanos',40,'quick',480,24,'grill','Chapeiro'],
  ['strawberry-milkshake','Milkshake de morango',42,'express',90,10,'beverage','Barista'],
  ['chicken-stroganoff','Strogonoff de frango',44,'medium',2400,40,'stove','Cozinheiro Geral'],
  ['ramen','Ramen',46,'medium',3000,36,'wok','Chef Oriental'],
  ['barbecue-ribs','Costela barbecue',48,'overnight',28800,160,'smoker','Assador'],
  ['bacon-cheese-quiche','Quiche de queijo e bacon',50,'long',10800,72,'oven','Forneiro'],
  ['acai-bowl','Açaí na tigela',52,'express',120,12,'beverage','Barista'],
  ['paella','Paella',54,'long',14400,72,'stove','Cozinheiro Geral'],
  ['brownie-ice-cream','Brownie com sorvete',56,'quick',720,18,'pastry','Confeiteiro'],
  ['onion-steak-fries','Bife acebolado com fritas',58,'quick',900,20,'grill','Chapeiro'],
  ['gratin-onion-soup','Sopa de cebola gratinada',60,'medium',3600,48,'cauldron','Chef de Sopas + Forneiro'],
  ['sushi-combo','Combinado de sushi',64,'quick',720,20,'cold_prep','Sushiman'],
  ['grilled-salmon-asparagus','Salmão grelhado com aspargos',68,'medium',2700,28,'grill','Chapeiro'],
  ['picanha','Picanha na chapa',72,'quick',900,18,'smoker','Assador'],
  ['petit-gateau','Petit gâteau',76,'quick',600,16,'pastry','Confeiteiro'],
  ['latte-art','Latte com arte',80,'express',120,10,'coffee_machine','Barista'],
  ['roast-lamb-potatoes','Cordeiro assado com batatas',84,'overnight',28800,120,'oven','Assador'],
  ['butter-lobster','Lagosta na manteiga',88,'premium',3600,20,'stove','Cozinheiro Geral'],
  ['filet-mignon-madeira','Filé-mignon ao molho madeira',91,'premium',2700,24,'grill','Chapeiro + Cozinheiro Geral'],
  ['shrimp-risotto','Risoto de camarão',94,'premium',3000,28,'stove','Cozinheiro Geral'],
  ['berry-cheesecake','Cheesecake de frutas vermelhas',96,'premium',28800,100,'pastry','Confeiteiro'],
  ['premium-seafood-board','Tábua premium de frutos do mar',98,'premium',14400,40,'cold_prep','Sushiman + Assador'],
  ['truffle-medallion-puree','Medalhão trufado com purê',100,'legendary',3600,18,'smoker','Assador + Cozinheiro Geral'],
] as const;

const aliases: Partial<Record<RecipeId, string[]>> = {
  coffee: ['Café da Casa'], omelette: ['Omelete Solar'], soup: ['Sopa do Jardim'], burger: ['Brasa Bloom'],
};

function stepsFor(id: RecipeId, stationId: StationId, duration: number, batchYield: number): RecipeStep[] {
  const perPortion = duration / batchYield;
  if (id === 'gratin-onion-soup') return [{ stationId: 'cauldron', duration: perPortion * .7, label: 'Cozinhar sopa' }, { stationId: 'oven', duration: perPortion * .3, label: 'Gratinar' }];
  if (id === 'sushi-combo') return [{ stationId: 'stove', duration: perPortion * .35, label: 'Preparar arroz' }, { stationId: 'cold_prep', duration: perPortion * .65, label: 'Montar combinado' }];
  if (id === 'filet-mignon-madeira') return [{ stationId: 'grill', duration: perPortion * .55, label: 'Grelhar filé' }, { stationId: 'stove', duration: perPortion * .45, label: 'Preparar molho' }];
  if (id === 'premium-seafood-board') return [{ stationId: 'cold_prep', duration: perPortion * .35, label: 'Preparar itens frios' }, { stationId: 'smoker', duration: perPortion * .4, label: 'Preparar itens quentes' }, { stationId: 'assembly', duration: perPortion * .25, label: 'Montar tábua' }];
  if (id === 'truffle-medallion-puree') return [{ stationId: 'smoker', duration: perPortion * .45, label: 'Grelhar medalhão' }, { stationId: 'stove', duration: perPortion * .35, label: 'Preparar purê e molho' }, { stationId: 'assembly', duration: perPortion * .2, label: 'Finalizar prato' }];
  return [{ stationId, duration: perPortion, label: 'Preparar lote' }];
}

function categoryFor(name: string, profile: Profile): RecipeDefinition['category'] {
  if (/café|cappuccino|chocolate|latte|milkshake/i.test(name)) return 'drink';
  if (/sopa|caldo|feijoada|ramen|moqueca/i.test(name)) return 'soup';
  if (/cookie|donut|brownie|gâteau|cheesecake|croissant/i.test(name)) return 'dessert';
  if (profile === 'premium' || profile === 'legendary') return 'premium';
  return 'main';
}

const COST_RATIO: Record<Profile, number> = { express:.64, quick:.56, medium:.5, long:.45, overnight:.42, premium:.59, legendary:.62 };
const EARLY_DRINK_ECONOMY: Partial<Record<RecipeId, { salePrice: number; batchYield: number }>> = {
  cappuccino: { salePrice: 4, batchYield: 10 },
  'hot-chocolate': { salePrice: 6, batchYield: 8 },
};

export const RECIPES: RecipeDefinition[] = RECIPE_ROWS.map(([id,name,requiredLevel,durationProfile,baseDurationSeconds,batchYield,stationId,specialist], index) => {
  const premiumMultiplier = durationProfile === 'premium' ? 1.28 : durationProfile === 'legendary' ? 1.5 : 1;
  const economyOverride = EARLY_DRINK_ECONOMY[id];
  batchYield = economyOverride?.batchYield ?? batchYield;
  const salePrice = economyOverride?.salePrice ?? Math.max(3, Math.round(3 * Math.pow(1.055, requiredLevel - 1) * premiumMultiplier));
  const grossRevenue = salePrice * batchYield;
  const batchCost = Math.round(grossRevenue * COST_RATIO[durationProfile]);
  return {
    id, name, aliases: aliases[id] ?? [], description: `${name}, preparado em lote no padrão Cafe Mania.`, icon: '', category: categoryFor(name, durationProfile),
    ingredients: [], steps: stepsFor(id, stationId, baseDurationSeconds, batchYield), yield: 1, batchYield, salePrice,
    experience: Math.max(1, Math.round((requiredLevel + 6) / batchYield)), requiredLevel, storageSpace: 1,
    assetId: `food_v008_${String(index + 1).padStart(2,'0')}`, menuOrder: index + 1, durationProfile, baseDurationSeconds,
    batchCost, grossRevenue, estimatedProfit: grossRevenue - batchCost, reputationReward: durationProfile === 'legendary' ? 8 : durationProfile === 'premium' ? 4 : 1,
    requiredSpecialties: specialist.split(' + '), available: true,
  };
});

export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((recipe) => [recipe.id, recipe])) as Record<RecipeId, RecipeDefinition>;
export const RECIPE_ID_ALIASES: Record<string, RecipeId> = Object.fromEntries(RECIPES.flatMap((recipe) => [recipe.name, ...recipe.aliases].map((name) => [name, recipe.id])));
