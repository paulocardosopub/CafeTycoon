import type { StationDefinition, StationId } from '../../core/types';

export const STATIONS: StationDefinition[] = [
  { id: 'prep', name: 'Bancada de preparo', icon: '🔪', position: { x: 3, y: 4 }, size: { x: 2, y: 1 }, interaction: { x: 3, y: 5 }, color: 0x65a98f },
  { id: 'stove', name: 'Fogão', icon: '♨', position: { x: 6, y: 3 }, size: { x: 1, y: 1 }, interaction: { x: 6, y: 4 }, color: 0xe76f51 },
  { id: 'grill', name: 'Grelha', icon: '▦', position: { x: 8, y: 3 }, size: { x: 1, y: 1 }, interaction: { x: 8, y: 4 }, color: 0xd85b38 },
  { id: 'cauldron', name: 'Caldeirão', icon: '◒', position: { x: 10, y: 3 }, size: { x: 1, y: 1 }, interaction: { x: 10, y: 4 }, color: 0x735c9f },
  { id: 'coffee_machine', name: 'Cafeteira', icon: '☕', position: { x: 12, y: 3 }, size: { x: 1, y: 1 }, interaction: { x: 12, y: 4 }, color: 0xb86f52 },
  { id: 'assembly', name: 'Bancada de montagem', icon: '✦', position: { x: 14, y: 4 }, size: { x: 1, y: 2 }, interaction: { x: 13, y: 5 }, color: 0xe6aa68 },
  { id: 'pickup', name: 'Balcão de retirada', icon: '🔔', position: { x: 5, y: 7 }, size: { x: 6, y: 1 }, interaction: { x: 8, y: 8 }, color: 0xd99b57 },
];

export const STATION_BY_ID = Object.fromEntries(STATIONS.map((station) => [station.id, station])) as Record<StationId, StationDefinition>;
