import type { ConstructionSaveState, Direction, PlacedFurniture, ServiceCounterModule } from '../../core/types';
import { modulesFromFurniture } from '../systems/service-counter/ServiceCounterSystem';

const placed = (id: string, definitionId: string, gridX: number, gridY: number, orientation: Direction = 'sw', skinId = 'steel-standard', state: Record<string, unknown> = {}): PlacedFurniture => ({
  id, definitionId, gridX, gridY, orientation, skinId, level: 1, state,
});

export function createInitialConstructionState(): ConstructionSaveState {
  const placedFurniture: PlacedFurniture[] = [
    placed('furniture:a1', 'cooking.a1.stove', 4, 2),
    placed('furniture:b1', 'refrigeration.b1.fridge', 7, 2),
    placed('furniture:b3', 'preparation.b3.counter', 9, 2),
    placed('furniture:b5', 'washing.b5.sink', 11, 2),
    placed('furniture:c5', 'storage.c5.pantry', 2, 2, 'sw', 'counter-forest'),
    placed('counter:tutorial', 'service.c1.isolated', 8, 6, 'sw', 'counter-forest'),
    placed('table:tutorial', 'dining.table.basic', 8, 11, 'sw', 'table-oak'),
    placed('chair:tutorial-west', 'dining.chair.basic', 7, 11, 'se', 'chair-wood', { linkedTableId: 'table:tutorial', seatFacing: 'se' }),
    placed('chair:tutorial-east', 'dining.chair.basic', 9, 11, 'nw', 'chair-wood', { linkedTableId: 'table:tutorial', seatFacing: 'nw' }),
  ];
  const serviceCounters: ServiceCounterModule[] = modulesFromFurniture(placedFurniture).map((module) => module.id === 'counter:tutorial' ? { ...module, assignedRecipeId: 'omelette' } : module);
  return {
    dataVersion: 1,
    placedFurniture,
    storedFurniture: [],
    serviceCounters,
    builtAreas: [{ id: 'area:base', x: 0, y: 0, width: 18, depth: 18, kind: 'base' }],
    floorSkinId: 'floor-terracotta',
    wallSkinId: 'wall-cream-green',
    doorSkinId: 'door-green',
    windowSkinId: 'window-green',
    staffStartPositions: [
      { staffId: 'cook-0', gridX: 5, gridY: 4, facing: 'ne', returnWhenIdle: true },
      { staffId: 'waiter-0', gridX: 8, gridY: 8, facing: 'ne', returnWhenIdle: true },
      { staffId: 'cleaner-0', gridX: 13, gridY: 11, facing: 'nw', returnWhenIdle: true },
      { staffId: 'stocker-0', gridX: 3, gridY: 4, facing: 'ne', returnWhenIdle: true },
      { staffId: 'player', gridX: 9, gridY: 14, facing: 'ne', returnWhenIdle: true },
    ],
    migrationLog: [],
  };
}
