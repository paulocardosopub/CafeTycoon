import type { ActorKind, Direction, GridPoint } from '../../core/types';

export interface StaffCatalogEntry {
  id: string;
  actorId: string;
  role: Exclude<ActorKind, 'player'>;
  name: string;
  label: string;
  assetId: string;
  includedByDefault: boolean;
  hireCost: number;
  suggestedStart: GridPoint;
  facing: Direction;
}

export const STAFF_CATALOG: readonly StaffCatalogEntry[] = [
  { id: 'cook-0', actorId: 'employee-cook-001', role: 'cook', name: 'Nina', label: 'Nina · Cozinha', assetId: 'cook-0', includedByDefault: true, hireCost: 0, suggestedStart: { x: 5, y: 4 }, facing: 'ne' },
  { id: 'waiter-0', actorId: 'employee-waiter-001', role: 'waiter', name: 'Caio', label: 'Caio · Atendimento', assetId: 'waiter-0', includedByDefault: true, hireCost: 0, suggestedStart: { x: 8, y: 8 }, facing: 'ne' },
  { id: 'cleaner-0', actorId: 'employee-cleaner-001', role: 'cleaner', name: 'Iara', label: 'Iara · Limpeza', assetId: 'cleaner-0', includedByDefault: true, hireCost: 0, suggestedStart: { x: 13, y: 11 }, facing: 'nw' },
  { id: 'stocker-0', actorId: 'employee-stocker-001', role: 'stocker', name: 'Davi', label: 'Davi · Estoque', assetId: 'stocker-0', includedByDefault: true, hireCost: 0, suggestedStart: { x: 3, y: 4 }, facing: 'ne' },
  { id: 'cook-1', actorId: 'employee-cook-002', role: 'cook', name: 'Lúcia', label: 'Lúcia · Cozinha', assetId: 'cook-1', includedByDefault: false, hireCost: 450, suggestedStart: { x: 6, y: 4 }, facing: 'ne' },
  { id: 'waiter-1', actorId: 'employee-waiter-002', role: 'waiter', name: 'Bento', label: 'Bento · Atendimento', assetId: 'waiter-1', includedByDefault: false, hireCost: 380, suggestedStart: { x: 10, y: 9 }, facing: 'ne' },
  { id: 'cleaner-1', actorId: 'employee-cleaner-002', role: 'cleaner', name: 'Rita', label: 'Rita · Limpeza', assetId: 'cleaner-0', includedByDefault: false, hireCost: 300, suggestedStart: { x: 14, y: 12 }, facing: 'nw' },
  { id: 'stocker-1', actorId: 'employee-stocker-002', role: 'stocker', name: 'Hugo', label: 'Hugo · Estoque', assetId: 'stocker-0', includedByDefault: false, hireCost: 320, suggestedStart: { x: 4, y: 5 }, facing: 'ne' },
] as const;

export const STAFF_BY_ID = Object.fromEntries(STAFF_CATALOG.map((entry) => [entry.id, entry])) as Record<string, StaffCatalogEntry>;
