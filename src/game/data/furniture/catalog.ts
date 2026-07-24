import type {
  Direction, FurnitureCategory, FurnitureCode, FurnitureDefinition, FurnitureHeightCategory, FurnitureWorkSlot, GridPoint,
} from '../../../core/types';
import { FURNITURE_VISUAL_METRICS } from '../../grid/SpatialLayoutService';

const ALL_ORIENTATIONS: Direction[] = ['sw', 'se', 'ne', 'nw'];
const SOURCE = 'assets/blender/equipment/kitchen_equipment.blend';
const FURNITURE_SOURCE = 'assets/blender/furniture/furniture.blend';
const ROBUST_DINING_SOURCE = 'art_source/blender/furniture/c3_br_modular_furniture_v007_2c_robust_dining.blend';

const sprites = (assetId: string): Record<Direction, string> => ({ ne: assetId, nw: assetId, se: assetId, sw: assetId });
const rectCells = (width: number, depth: number): GridPoint[] => {
  const cells: GridPoint[] = [];
  for (let y = 0; y < depth; y += 1) for (let x = 0; x < width; x += 1) cells.push({ x, y });
  return cells;
};
const work = (id: string, offset: GridPoint, role: FurnitureWorkSlot['role'], purpose: FurnitureWorkSlot['purpose'], facing: Direction = 'ne'): FurnitureWorkSlot => ({
  id, offset, role, purpose, facing, required: true,
});

interface DefinitionInput {
  id: string; code: FurnitureCode; category: FurnitureCategory; name: string; width?: number; depth?: number;
  assetId: string; price: number; functionId?: FurnitureDefinition['functionId']; workSlots?: FurnitureWorkSlot[];
  skinIds?: string[]; source?: string; essential?: boolean; heightCategory?: FurnitureHeightCategory; visualScale?: number;
  unlockLevel?: number;
}

function definition(input: DefinitionInput): FurnitureDefinition {
  const width = input.width ?? 1;
  const depth = input.depth ?? 1;
  const heightCategory: FurnitureHeightCategory = input.heightCategory
    ?? (input.category === 'tables' || input.category === 'chairs' || input.category === 'decoration' ? 'LOW'
      : input.category === 'refrigeration' || input.category === 'storage' ? 'TALL' : 'STANDARD_COUNTER');
  const heightBlocks = heightCategory === 'TALL' ? FURNITURE_VISUAL_METRICS.tallFurnitureHeight
    : heightCategory === 'LOW' ? FURNITURE_VISUAL_METRICS.lowFurnitureHeight
      : FURNITURE_VISUAL_METRICS.standardCounterHeight;
  return {
    id: input.id,
    code: input.code,
    category: input.category,
    name: input.name,
    footprintWidth: width,
    footprintDepth: depth,
    allowedOrientations: [...ALL_ORIENTATIONS],
    spriteSet: sprites(input.assetId),
    blenderSource: input.source ?? SOURCE,
    baseAnchor: { x: .5, y: 174 / 192 },
    visualScale: input.visualScale ?? FURNITURE_VISUAL_METRICS.categoryScale[heightCategory],
    heightCategory,
    visualBounds: { widthCells: width, depthCells: depth, heightBlocks, overhangCells: .12 },
    collisionCells: rectCells(width, depth),
    workSlots: input.workSlots ?? [work('work', { x: Math.floor((width - 1) / 2), y: depth }, 'any', 'work')],
    frontDirection: 'sw',
    skinIds: input.skinIds ?? ['steel-standard'],
    level: input.unlockLevel ?? 1,
    price: input.price,
    resaleValue: Math.floor(input.price * .55),
    functionId: input.functionId,
    rotatable: true,
    essential: input.essential,
  };
}

const doubleWork = (purpose: FurnitureWorkSlot['purpose'] = 'work'): FurnitureWorkSlot[] => [
  work('work-left', { x: 0, y: 1 }, 'any', purpose),
  work('work-right', { x: 1, y: 1 }, 'any', purpose),
];
const serviceSlots = (): FurnitureWorkSlot[] => [
  // Both flows share the accessible restaurant side, so the counter can sit
  // flush against a wall like every other modular counter.
  work('kitchen-drop', { x: 0, y: 1 }, 'cook', 'kitchen-drop', 'ne'),
  work('waiter-pickup', { x: 0, y: 1 }, 'waiter', 'waiter-pickup', 'ne'),
];

export const FURNITURE_DEFINITIONS: readonly FurnitureDefinition[] = [
  definition({ id: 'cooking.a1.stove', code: 'A1', category: 'cooking', name: 'Fogão industrial com fornos', assetId: 'a1_stove_industrial', price: 3800, functionId: 'stove', workSlots: [work('work', { x: 0, y: 1 }, 'any', 'work')], unlockLevel: 15 }),
  definition({ id: 'cooking.a2.convection', code: 'A2', category: 'cooking', name: 'Forno de convecção', assetId: 'a2_convection_oven', price: 1800, functionId: 'oven', unlockLevel: 5 }),
  definition({ id: 'cooking.a3.griddle', code: 'A3', category: 'cooking', name: 'Chapa industrial', assetId: 'a3_griddle', price: 160, functionId: 'grill', unlockLevel: 25 }),
  definition({ id: 'cooking.a4.fryer', code: 'A4', category: 'cooking', name: 'Fritadeira industrial', assetId: 'a4_fryer', price: 140, functionId: 'grill', unlockLevel: 20 }),
  definition({ id: 'cooking.a5.kettle', code: 'A5', category: 'cooking', name: 'Caldeira industrial', assetId: 'a5_kettle', price: 130, functionId: 'cauldron', unlockLevel: 10 }),
  definition({ id: 'cooking.a6.grill', code: 'A6', category: 'cooking', name: 'Parrilla e defumador', assetId: 'a6_grill', price: 195, functionId: 'grill', unlockLevel: 47 }),
  definition({ id: 'cooking.a7.bakery', code: 'A7', category: 'cooking', name: 'Forno de padaria', assetId: 'a7_bakery_oven', price: 240, functionId: 'oven', unlockLevel: 55 }),
  definition({ id: 'cooking.a8.coffee', code: 'A8', category: 'cooking', name: 'Máquina de café', assetId: 'a8_coffee_machine', price: 600, functionId: 'coffee_machine', essential: true }),

  definition({ id: 'refrigeration.b1.fridge', code: 'B1', category: 'refrigeration', name: 'Geladeira industrial', assetId: 'b1_industrial_fridge', price: 210, functionId: 'fridge' }),
  definition({ id: 'refrigeration.b2.freezer', code: 'B2', category: 'refrigeration', name: 'Freezer industrial', assetId: 'b2_industrial_freezer', price: 230, functionId: 'fridge' }),
  definition({ id: 'preparation.b3.counter', code: 'B3', category: 'preparation', name: 'Bancada de preparação', assetId: 'b3_preparation_counter', price: 120, functionId: 'prep' }),
  definition({ id: 'preparation.b4.ingredients', code: 'B4', category: 'preparation', name: 'Estação de ingredientes e corte', assetId: 'b4_ingredient_station', price: 170, functionId: 'assembly' }),
  definition({ id: 'washing.b5.sink', code: 'B5', category: 'washing', name: 'Pia industrial', assetId: 'b5_industrial_sink', price: 650, functionId: 'sink', workSlots: [work('work', { x: 0, y: 1 }, 'any', 'work')], essential: true }),
  definition({ id: 'washing.b6.dishwasher', code: 'B6', category: 'washing', name: 'Lava-louças industrial', assetId: 'b6_dishwasher', price: 185, functionId: 'sink' }),
  definition({ id: 'washing.b7.double-sink', code: 'B7', category: 'washing', name: 'Estação de lavagem com duas cubas', width: 2, assetId: 'b7_double_sink', price: 250, functionId: 'sink', workSlots: doubleWork(), visualScale: .66 }),
  definition({ id: 'preparation.b8.pastry', code: 'B8', category: 'preparation', name: 'Mesa de massas e confeitaria', width: 2, assetId: 'b8_pastry_table', price: 245, functionId: 'prep', workSlots: doubleWork(), unlockLevel: 55 }),
  definition({ id: 'washing.sink.t2', code: 'B9', category: 'washing', name: 'Pia T2 - 15% mais rapida nas lavagens desta pia', assetId: 'b5_industrial_sink', price: 650, functionId: 'sink', workSlots: [work('work', { x: 0, y: 1 }, 'any', 'work')], unlockLevel: 8 }),

  definition({ id: 'service.c1.isolated', code: 'C1', category: 'service', name: 'Balcão de serviço', assetId: 'c1_service_isolated', price: 700, functionId: 'pickup', workSlots: serviceSlots(), skinIds: ['counter-forest', 'counter-oak'], essential: true, source: FURNITURE_SOURCE }),
  definition({ id: 'service.c2.left', code: 'C2', category: 'service', name: 'Balcão de serviço', assetId: 'c2_service_left', price: 95, functionId: 'pickup', workSlots: serviceSlots(), skinIds: ['counter-forest', 'counter-oak'], source: FURNITURE_SOURCE }),
  definition({ id: 'service.c3.middle', code: 'C3', category: 'service', name: 'Balcão de serviço', assetId: 'c3_service_middle', price: 95, functionId: 'pickup', workSlots: serviceSlots(), skinIds: ['counter-forest', 'counter-oak'], source: FURNITURE_SOURCE }),
  definition({ id: 'service.c4.right', code: 'C4', category: 'service', name: 'Balcão de serviço', assetId: 'c4_service_right', price: 95, functionId: 'pickup', workSlots: serviceSlots(), skinIds: ['counter-forest', 'counter-oak'], source: FURNITURE_SOURCE }),
  definition({ id: 'service.counter.t2', code: 'C11', category: 'service', name: 'Balcao T2 - 12% mais rapido nas tarefas deste balcao', assetId: 'c1_service_isolated', price: 700, functionId: 'pickup', workSlots: serviceSlots(), skinIds: ['counter-forest', 'counter-oak'], source: FURNITURE_SOURCE, unlockLevel: 8 }),
  definition({ id: 'storage.c5.pantry', code: 'C5', category: 'storage', name: 'Despensa seca', assetId: 'c5_dry_pantry', price: 145, functionId: 'storage', source: FURNITURE_SOURCE }),
  definition({ id: 'storage.c6.ingredients', code: 'C6', category: 'storage', name: 'Estante de ingredientes', assetId: 'c6_ingredient_shelf', price: 125, functionId: 'storage', source: FURNITURE_SOURCE }),
  definition({ id: 'service.c7.plates', code: 'C7', category: 'service', name: 'Estação de pratos e talheres', assetId: 'c7_plate_station', price: 110, functionId: 'storage', source: FURNITURE_SOURCE }),
  definition({ id: 'service.c8.waste', code: 'C8', category: 'service', name: 'Lixeira e reciclagem', assetId: 'c8_waste_recycling', price: 80, functionId: 'decoration', source: FURNITURE_SOURCE }),
  definition({ id: 'service.c9.drinks', code: 'C9', category: 'service', name: 'Dispensador de bebidas frias', assetId: 'c9_cold_drinks', price: 150, functionId: 'coffee_machine', source: FURNITURE_SOURCE, unlockLevel: 41 }),
  definition({ id: 'preparation.c10.block', code: 'C10', category: 'preparation', name: 'Bancada pequena de corte', assetId: 'c10_cutting_block', price: 115, functionId: 'prep', source: FURNITURE_SOURCE }),

  definition({ id: 'dining.table.basic', code: 'T1', category: 'tables', name: 'Mesa robusta', assetId: 'table_two', price: 600, functionId: 'table', skinIds: ['cream-green', 'cream-wood'], source: ROBUST_DINING_SOURCE, workSlots: [] }),
  definition({ id: 'dining.table.t2', code: 'T2', category: 'tables', name: 'Mesa robusta T2', width: 2, assetId: 'table_two', price: 3500, functionId: 'table', skinIds: ['cream-green', 'cream-wood'], source: ROBUST_DINING_SOURCE, workSlots: [], unlockLevel: 8 }),
  definition({ id: 'dining.chair.basic', code: 'CH1', category: 'chairs', name: 'Banco robusto', assetId: 'chair_wood', price: 250, functionId: 'chair', skinIds: ['cream-green', 'cream-wood'], source: ROBUST_DINING_SOURCE, workSlots: [], visualScale: .93 }),
  definition({ id: 'decor.plant.basic', code: 'D1', category: 'decoration', name: 'Planta em vaso', assetId: 'plant', price: 28, functionId: 'decoration', source: FURNITURE_SOURCE, workSlots: [] }),
] as const;

export const FURNITURE_BY_ID = Object.fromEntries(FURNITURE_DEFINITIONS.map((item) => [item.id, item])) as Record<string, FurnitureDefinition>;
export const FURNITURE_BY_CODE = Object.fromEntries(FURNITURE_DEFINITIONS.map((item) => [item.code, item])) as Record<FurnitureCode, FurnitureDefinition>;
export const KITCHEN_CATALOG = FURNITURE_DEFINITIONS.filter((item) => /^[ABC]/.test(item.code));

