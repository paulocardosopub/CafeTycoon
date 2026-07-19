import type { TableRuntime } from '../../core/types';
import type { RestaurantGrid } from '../grid/Grid';
import { findPath } from '../navigation/AStar';
import { ENTRANCE } from './initialMap';
import { STATIONS } from '../../content/stations/stations';

export interface MapValidation { valid: boolean; errors: string[] }

export function validateRestaurantMap(grid: RestaurantGrid, tables: TableRuntime[]): MapValidation {
  const errors: string[] = [];
  for (const station of STATIONS) {
    if (!grid.isWalkable(station.interaction) || findPath(grid, ENTRANCE, station.interaction).length === 0) {
      errors.push(`Estação inacessível: ${station.id}`);
    }
  }
  for (const table of tables) {
    const waiterReachable = grid.isWalkable(table.waiterApproach) && findPath(grid, ENTRANCE, table.waiterApproach).length > 0;
    const accessibleChairs = table.chairs.filter((chair) => grid.isWalkable(chair.approach) && findPath(grid, ENTRANCE, chair.approach).length > 0);
    table.accessible = waiterReachable && accessibleChairs.length > 0;
    if (!waiterReachable) errors.push(`Ponto do garçom inacessível: ${table.id}`);
    if (!accessibleChairs.length) errors.push(`Mesa sem cadeira acessível: ${table.id}`);
  }
  if (findPath(grid, ENTRANCE, { x: 9, y: 14 }).length === 0) errors.push('Entrada desconectada do salão');
  return { valid: errors.length === 0, errors };
}
