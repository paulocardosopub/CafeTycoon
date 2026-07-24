import type { RecipeDefinition, RecipeId, RecipeStep, StationId } from '../../core/types';

type Profile = RecipeDefinition['durationProfile'];
// Canonical 0.0.9 catalogue: each row owns its production and economy values.
type RecipeRow = readonly [RecipeId, string, number, Profile, number, number, StationId, string, number, number, number];

export const RECIPE_ROWS: readonly RecipeRow[] = [
  ['coffee','Café preto',1,'express',30,12,'coffee_machine','Barista',3,20,1], ['chocolate-cookies','Cookies de chocolate',5,'quick',300,120,'oven','Forneiro',3,205,1], ['soup','Sopa de tomate',10,'quick',600,140,'cauldron','Chef de Sopas',5,390,1], ['omelette','Omelete de queijo e ervas',15,'express',45,18,'stove','Cozinheiro Geral',8,82,2],
  ['french-fries','Batata frita',20,'quick',240,100,'fryer','Fritureiro',7,385,1], ['cheese-bread','Pão de queijo',7,'medium',720,200,'oven','Forneiro',4,440,1], ['hot-dog','Cachorro-quente',25,'express',60,24,'grill','Chapeiro',12,174,2], ['cheese-tapioca','Tapioca de queijo',26,'express',75,30,'grill','Chapeiro',11,181,2],
  ['misto-quente','Misto-quente',27,'express',90,36,'grill','Chapeiro',10,198,2], ['burger','Hambúrguer clássico',28,'quick',300,120,'grill','Chapeiro',13,530,2], ['honey-pancakes','Panquecas com mel',29,'quick',360,140,'grill','Chapeiro',11,535,2], ['coxinha','Coxinha',21,'medium',900,180,'fryer','Fritureiro',8,670,1],
  ['caesar-salad','Salada Caesar',16,'quick',240,110,'cold_prep','Cozinheiro Geral',10,525,2], ['tomato-spaghetti','Espaguete ao molho de tomate',17,'medium',900,160,'stove','Cozinheiro Geral',12,835,2], ['cappuccino','Cappuccino',2,'express',45,18,'coffee_machine','Barista',4,42,1], ['mozzarella-pizza','Pizza de muçarela',8,'medium',900,300,'oven','Forneiro',9,1530,1],
  ['grilled-chicken-rice','Frango grelhado com arroz',30,'medium',1200,220,'grill','Chapeiro',16,1935,2], ['caldo-verde','Caldo verde',11,'medium',1200,180,'cauldron','Chef de Sopas',7,700,1], ['donuts','Donuts',22,'medium',1200,200,'fryer','Fritureiro',9,950,1], ['cheeseburger','Cheeseburger',31,'quick',420,130,'grill','Chapeiro',15,975,2],
  ['croissant','Croissant',9,'medium',1800,500,'oven','Forneiro',6,1650,1], ['meat-pastel','Pastel de carne',23,'quick',480,120,'fryer','Fritureiro',10,630,1], ['bolognese-lasagna','Lasanha à bolonhesa',12,'medium',1800,220,'oven','Forneiro',11,1330,1], ['mushroom-risotto','Risoto de cogumelos',18,'medium',1200,180,'stove','Cozinheiro Geral',14,1510,2],
  ['fish-moqueca','Moqueca de peixe',19,'medium',1800,200,'stove','Cozinheiro Geral',15,1780,2], ['hot-chocolate','Chocolate quente',3,'express',60,16,'coffee_machine','Barista',6,53,1], ['fish-and-chips','Fish and chips',24,'quick',600,140,'fryer','Fritureiro',12,850,2], ['feijoada','Feijoada',36,'overnight',28800,1200,'cauldron','Chef de Sopas',18,12960,2],
  ['roast-chicken-vegetables','Frango assado com legumes',38,'long',14400,700,'oven','Forneiro',22,10010,2], ['mexican-tacos','Tacos mexicanos',40,'quick',480,150,'grill','Chapeiro',18,1755,2], ['strawberry-milkshake','Milkshake de morango',42,'express',90,40,'beverage','Barista',20,560,3], ['chicken-stroganoff','Strogonoff de frango',44,'medium',2400,350,'stove','Cozinheiro Geral',24,5460,2],
  ['ramen','Ramen',46,'medium',3000,400,'wok','Chef Oriental',25,6500,2], ['barbecue-ribs','Costela barbecue',48,'overnight',28800,1500,'smoker','Assador',24,21600,2], ['bacon-cheese-quiche','Quiche de queijo e bacon',50,'long',10800,600,'oven','Forneiro',26,10920,2], ['acai-bowl','Açaí na tigela',52,'express',120,60,'beverage','Barista',24,936,3],
  ['paella','Paella',54,'long',14400,650,'stove','Cozinheiro Geral',30,12675,2], ['brownie-ice-cream','Brownie com sorvete',56,'quick',720,100,'pastry','Confeiteiro',34,2210,3], ['onion-steak-fries','Bife acebolado com fritas',58,'quick',900,120,'grill','Chapeiro',35,2730,3], ['gratin-onion-soup','Sopa de cebola gratinada',60,'medium',3600,450,'cauldron','Chef de Sopas + Forneiro',22,7920,2],
  ['sushi-combo','Combinado de sushi',64,'quick',720,110,'cold_prep','Sushiman',45,3218,4], ['grilled-salmon-asparagus','Salmão grelhado com aspargos',68,'medium',2700,300,'grill','Chapeiro',42,8694,3], ['picanha','Picanha na chapa',72,'quick',900,100,'smoker','Assador',55,3850,4], ['petit-gateau','Petit gâteau',76,'quick',600,90,'pastry','Confeiteiro',60,3510,4],
  ['latte-art','Latte com arte',80,'express',120,60,'coffee_machine','Barista',40,1440,4], ['roast-lamb-potatoes','Cordeiro assado com batatas',84,'overnight',28800,1100,'oven','Assador',48,31680,3], ['butter-lobster','Lagosta na manteiga',88,'premium',3600,80,'stove','Cozinheiro Geral',180,9216,8], ['filet-mignon-madeira','Filé-mignon ao molho madeira',91,'premium',2700,100,'grill','Chapeiro + Cozinheiro Geral',170,10200,8],
  ['shrimp-risotto','Risoto de camarão',94,'premium',3000,120,'stove','Cozinheiro Geral',160,10560,7], ['berry-cheesecake','Cheesecake de frutas vermelhas',96,'premium',28800,100,'pastry','Confeiteiro',220,12980,8], ['premium-seafood-board','Tábua premium de frutos do mar',98,'premium',14400,120,'cold_prep','Sushiman + Assador',260,18720,10], ['truffle-medallion-puree','Medalhão trufado com purê',100,'legendary',3600,100,'smoker','Assador + Cozinheiro Geral',300,20400,12],
] as const;

const aliases: Partial<Record<RecipeId, string[]>> = { coffee: ['Café da Casa'], omelette: ['Omelete Solar'], soup: ['Sopa do Jardim'], burger: ['Brasa Bloom'] };

// The 0.0.10 economic matrix is intentionally data-only. Values are batch
// values and XP is the total batch XP (never multiplied by portions).
const ECONOMY_010: Record<RecipeId, readonly [Profile, number, number, number, number, number]> = {
  coffee:['express',15,12,20,3,1], cappuccino:['express',45,24,54,4,2], 'hot-chocolate':['express',90,18,78,7,3], 'chocolate-cookies':['quick',300,120,240,3,8], 'cheese-bread':['stock',1080,240,420,3,18], 'mozzarella-pizza':['express',240,60,340,9,7], croissant:['stock',3600,500,1200,4,35], soup:['quick',720,160,480,5,12], 'caldo-verde':['stock',2700,360,1260,6,30], 'bolognese-lasagna':['medium',2700,200,1500,12,32],
  omelette:['express',120,30,130,8,4], 'caesar-salad':['quick',900,180,1000,9,14], 'tomato-spaghetti':['medium',2100,260,1600,10,26], 'mushroom-risotto':['quick',720,90,780,14,14], 'fish-moqueca':['stock',5400,400,3900,15,45], 'french-fries':['express',360,150,650,7,8], coxinha:['stock',2700,500,2600,8,32], donuts:['medium',1800,300,1650,9,25], 'meat-pastel':['express',300,90,560,10,8], 'fish-and-chips':['quick',900,180,1500,13,18],
  'hot-dog':['express',120,40,280,12,5], 'cheese-tapioca':['quick',720,160,1100,11,14], 'misto-quente':['medium',1800,300,1900,10,25], burger:['quick',480,100,850,14,12], 'honey-pancakes':['stock',5400,600,3900,10,40], 'grilled-chicken-rice':['medium',1800,240,2400,16,30], cheeseburger:['express',240,60,650,18,8], feijoada:['overnight',28800,1500,18000,18,140], 'roast-chicken-vegetables':['long',14400,800,11200,22,100], 'mexican-tacos':['quick',720,180,2000,18,18],
  'strawberry-milkshake':['express',180,40,600,22,6], 'chicken-stroganoff':['stock',5400,500,7800,24,55], ramen:['long',7200,700,11500,25,70], 'barbecue-ribs':['overnight',28800,2000,33000,24,170], 'bacon-cheese-quiche':['long',7200,400,6500,26,85], 'acai-bowl':['quick',360,60,930,24,10], paella:['long',14400,900,18000,30,120], 'brownie-ice-cream':['quick',480,80,1700,34,18], 'onion-steak-fries':['quick',900,120,2600,35,28], 'gratin-onion-soup':['long',7200,600,8400,22,75],
  'sushi-combo':['quick',720,120,3500,45,24], 'grilled-salmon-asparagus':['medium',2700,300,8100,42,55], picanha:['express',600,80,2800,55,20], 'petit-gateau':['express',480,70,2700,60,20], 'latte-art':['express',180,40,1050,40,8], 'roast-lamb-potatoes':['overnight',28800,1200,39000,48,200], 'butter-lobster':['premium',3600,50,6200,180,75], 'filet-mignon-madeira':['premium',2700,70,7800,170,80], 'shrimp-risotto':['premium',3600,100,10500,160,90], 'berry-cheesecake':['overnight',21600,200,30000,220,180],
  'premium-seafood-board':['long',14400,60,9000,260,160], 'truffle-medallion-puree':['premium',3600,80,15600,300,120],
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

export const RECIPES: RecipeDefinition[] = RECIPE_ROWS.map(([id,name,requiredLevel,_durationProfile,_baseDurationSeconds,_batchYield,stationId,specialist], index) => {
  const [durationProfile, baseDurationSeconds, batchYield, batchCost, salePrice, experience] = ECONOMY_010[id];
  const grossRevenue = salePrice * batchYield;
  return { id, name, aliases: aliases[id] ?? [], description: `${name}, preparado em lote no padrão Bistrô Bloom.`, icon: '', category: categoryFor(name, durationProfile), ingredients: [], steps: stepsFor(id, stationId, baseDurationSeconds, batchYield), yield: 1, batchYield, salePrice, experience, requiredLevel, storageSpace: 1, assetId: `food_v008_${String(index + 1).padStart(2,'0')}`, menuOrder: index + 1, durationProfile, baseDurationSeconds, batchCost, grossRevenue, estimatedProfit: grossRevenue - batchCost, reputationReward: durationProfile === 'legendary' ? 8 : durationProfile === 'premium' ? 4 : 1, requiredSpecialties: specialist.split(' + '), available: true };
});

export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((recipe) => [recipe.id, recipe])) as Record<RecipeId, RecipeDefinition>;
export const RECIPE_ID_ALIASES: Record<string, RecipeId> = Object.fromEntries(RECIPES.flatMap((recipe) => [recipe.name, ...recipe.aliases].map((name) => [name, recipe.id])));
