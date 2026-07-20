import type { Direction, GridPoint, StationDefinition, StationId, WorldAssetId } from '../../core/types';

const station = (
  id: StationId, name: string, asset: WorldAssetId, position: GridPoint, size: GridPoint, interaction: GridPoint,
  visualHeight: number, color: number, front: Direction = 'sw', serviceInteraction?: GridPoint,
): StationDefinition => {
  const optionalWorkSlots = id === 'pickup'
    ? [{ x: interaction.x - 1, y: interaction.y }, { x: interaction.x + 1, y: interaction.y }]
    : size.x > 1 ? [{ x: interaction.x + 1, y: interaction.y }] : [];
  const interactionPoints = [interaction, ...optionalWorkSlots, ...(serviceInteraction ? [serviceInteraction] : [])];
  return {
    id, name, icon: '', position, size, interaction, color, orientation: 'sw', front,
    interactionPoints, primaryWorkSlot: interaction, optionalWorkSlots,
    ingredientSlot: interaction, outputSlot: serviceInteraction ?? interaction,
    clearanceCells: interactionPoints, serviceInteraction,
    asset, anchor: { x: .5, y: id === 'pickup' ? .65 : .85 }, visualHeight, blocksMovement: true, rotatable: false,
    visualSkinId: id === 'pickup' ? 'counter-oak' : 'equipment-steel-level-1',
    visualBounds: { widthCells: size.x, depthCells: size.y, heightBlocks: visualHeight / 48, overhangCells: .2 },
    depthOffset: 0,
  };
};

export const STATIONS: StationDefinition[] = [
  station('storage', 'Armazenamento', 'storage', { x: 1, y: 2 }, { x: 2, y: 1 }, { x: 1, y: 3 }, 82, 0x70432a),
  station('prep', 'Bancada de preparo', 'prep', { x: 3, y: 2 }, { x: 2, y: 1 }, { x: 3, y: 3 }, 54, 0x7d9b68),
  station('stove', 'Fogão', 'stove', { x: 6, y: 2 }, { x: 2, y: 1 }, { x: 6, y: 3 }, 58, 0xc65b3e),
  station('grill', 'Grelha', 'grill', { x: 9, y: 2 }, { x: 1, y: 1 }, { x: 9, y: 3 }, 58, 0x8e3f2f),
  station('cauldron', 'Caldeirão', 'cauldron', { x: 11, y: 2 }, { x: 1, y: 1 }, { x: 11, y: 3 }, 66, 0x315b6e),
  station('coffee_machine', 'Cafeteira', 'coffee_machine', { x: 13, y: 2 }, { x: 1, y: 1 }, { x: 13, y: 3 }, 67, 0x70432a),
  station('fridge', 'Geladeira', 'fridge', { x: 15, y: 2 }, { x: 2, y: 1 }, { x: 15, y: 3 }, 92, 0x899397),
  station('oven', 'Forno', 'oven', { x: 1, y: 5 }, { x: 2, y: 1 }, { x: 1, y: 6 }, 78, 0x59656a),
  station('assembly', 'Bancada de montagem', 'assembly', { x: 11, y: 5 }, { x: 2, y: 1 }, { x: 11, y: 6 }, 54, 0xd8954f),
  station('sink', 'Pia', 'sink', { x: 14, y: 5 }, { x: 2, y: 1 }, { x: 14, y: 6 }, 58, 0x4f8293),
  station('pickup', 'Balcão de serviço', 'pickup', { x: 5, y: 7 }, { x: 6, y: 1 }, { x: 7, y: 6 }, 58, 0xa86435, 'ne', { x: 7, y: 8 }),
];

export const STATION_BY_ID = Object.fromEntries(STATIONS.map((item) => [item.id, item])) as Record<StationId, StationDefinition>;
