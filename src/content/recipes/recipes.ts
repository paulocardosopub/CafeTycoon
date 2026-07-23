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

export const RECIPES: RecipeDefinition[] = RECIPE_ROWS.map(([id,name,requiredLevel,durationProfile,baseDurationSeconds,batchYield,stationId,specialist,salePrice,batchCost,experience], index) => {
  const grossRevenue = salePrice * batchYield;
  return { id, name, aliases: aliases[id] ?? [], description: `${name}, preparado em lote no padrão Bistrô Bloom.`, icon: '', category: categoryFor(name, durationProfile), ingredients: [], steps: stepsFor(id, stationId, baseDurationSeconds, batchYield), yield: 1, batchYield, salePrice, experience, requiredLevel, storageSpace: 1, assetId: `food_v008_${String(index + 1).padStart(2,'0')}`, menuOrder: index + 1, durationProfile, baseDurationSeconds, batchCost, grossRevenue, estimatedProfit: grossRevenue - batchCost, reputationReward: durationProfile === 'legendary' ? 8 : durationProfile === 'premium' ? 4 : 1, requiredSpecialties: specialist.split(' + '), available: true };
});

export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((recipe) => [recipe.id, recipe])) as Record<RecipeId, RecipeDefinition>;
export const RECIPE_ID_ALIASES: Record<string, RecipeId> = Object.fromEntries(RECIPES.flatMap((recipe) => [recipe.name, ...recipe.aliases].map((name) => [name, recipe.id])));
