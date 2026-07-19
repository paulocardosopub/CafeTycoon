import type { TableRuntime } from '../../core/types';
import type { RestaurantGrid } from '../grid/Grid';
import { findPath } from '../navigation/AStar';
import { ENTRANCE } from './initialMap';
import { STATIONS } from '../../content/stations/stations';

export interface MapValidation { valid: boolean; errors: string[] }

export function validateRestaurantMap(grid: RestaurantGrid, tables: TableRuntime[]): MapValidation {
  const errors: string[] = [];
  const staticGrid = grid.clone();
  for (const row of staticGrid.cells) for (const cell of row) { cell.occupiedBy = undefined; cell.reservedBy = undefined; }
  for (const station of STATIONS) {
    if (station.interactionPoints.some((point) => !staticGrid.isWalkable(point) || findPath(staticGrid, ENTRANCE, point).length === 0)) {
      errors.push(`Estação inacessível: ${station.id}`);
    }
  }
  for (const table of tables) {
    const waiterReachable = staticGrid.isWalkable(table.waiterApproach) && findPath(staticGrid, ENTRANCE, table.waiterApproach).length > 0;
    const accessibleChairs = table.chairs.filter((chair) => {
      chair.accessible = chair.enabled && staticGrid.isWalkable(chair.approach) && findPath(staticGrid, ENTRANCE, chair.approach).length > 0;
      if (!chair.accessible && chair.state !== 'blocked') chair.state = 'inaccessible';
      return chair.accessible;
    });
    table.accessible = waiterReachable && accessibleChairs.length > 0;
    if (!waiterReachable) errors.push(`Ponto do garçom inacessível: ${table.id}`);
    if (!accessibleChairs.length) errors.push(`Mesa sem cadeira acessível: ${table.id}`);
  }
  if (findPath(staticGrid, ENTRANCE, { x: 9, y: 14 }).length === 0) errors.push('Entrada desconectada do salão');
  return { valid: errors.length === 0, errors };
}
