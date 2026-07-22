import type { Direction, GridPoint, StaffDefinition, StaffRole, TaskKind } from '../../core/types';
import { STAFF_ROLE_CHARACTER_ASSETS } from '../../assets/pixel/characterVariantManifest';

export const STAFF_CHEF_ASSET_ID = STAFF_ROLE_CHARACTER_ASSETS.cook;

const TASKS: Record<StaffRole, TaskKind[]> = {
  cook: ['cook_step', 'production_batch'],
  waiter: ['take_order', 'deliver', 'payment'],
  cleaner: ['clean'],
  stocker: ['stock_support', 'restock_purchase'],
};

interface StaffInput {
  id: string;
  actorId: string;
  role: StaffRole;
  name: string;
  assetId: string;
  includedByDefault: boolean;
  hiringCost: number;
  salary: number;
  suggestedStart: GridPoint;
  facing: Direction;
  movementSpeed?: number;
  taskSpeed?: number;
  quality?: number;
  carryingCapacity?: number;
  traits?: string[];
}

function staff(input: StaffInput): StaffDefinition {
  return {
    ...input,
    assetId: STAFF_ROLE_CHARACTER_ASSETS[input.role],
    label: `${input.name} · ${roleLabel(input.role)}`,
    visualModelId: STAFF_ROLE_CHARACTER_ASSETS[input.role],
    level: 1,
    experience: 0,
    movementSpeed: input.movementSpeed ?? 1,
    taskSpeed: input.taskSpeed ?? 1,
    quality: input.quality ?? 1,
    carryingCapacity: input.carryingCapacity ?? (input.role === 'stocker' ? 12 : 4),
    hireCost: input.hiringCost,
    stamina: 100,
    traits: input.traits ?? [],
    allowedTasks: [...TASKS[input.role]],
    scheduleId: 'standard-day',
    startPosition: { ...input.suggestedStart },
    returnWhenIdle: true,
  };
}

export const STAFF_CATALOG: readonly StaffDefinition[] = [
  staff({ id: 'cook-0', actorId: 'employee-cook-001', role: 'cook', name: 'Nina', assetId: 'cook-0', includedByDefault: true, hiringCost: 0, salary: 24, suggestedStart: { x: 5, y: 4 }, facing: 'ne', taskSpeed: 1.05, quality: 1.08, traits: ['Mise en place'] }),
  staff({ id: 'waiter-0', actorId: 'employee-waiter-001', role: 'waiter', name: 'Caio', assetId: 'waiter-0', includedByDefault: true, hiringCost: 0, salary: 20, suggestedStart: { x: 8, y: 8 }, facing: 'ne', movementSpeed: 1.08, traits: ['Passo leve'] }),
  staff({ id: 'cleaner-0', actorId: 'employee-cleaner-001', role: 'cleaner', name: 'Iara', assetId: 'cleaner-0', includedByDefault: true, hiringCost: 0, salary: 14, suggestedStart: { x: 13, y: 11 }, facing: 'nw', taskSpeed: 1.08, traits: ['Organizada'] }),
  staff({ id: 'stocker-0', actorId: 'employee-stocker-001', role: 'stocker', name: 'Davi', assetId: 'stocker-0', includedByDefault: true, hiringCost: 0, salary: 18, suggestedStart: { x: 3, y: 4 }, facing: 'ne', carryingCapacity: 16, traits: ['Carga segura'] }),
  staff({ id: 'cook-1', actorId: 'employee-cook-002', role: 'cook', name: 'Lúcia', assetId: 'cook-1', includedByDefault: false, hiringCost: 450, salary: 27, suggestedStart: { x: 6, y: 4 }, facing: 'ne', taskSpeed: 1.12, quality: 1.14, traits: ['Forno preciso'] }),
  staff({ id: 'waiter-1', actorId: 'employee-waiter-002', role: 'waiter', name: 'Bento', assetId: 'waiter-1', includedByDefault: false, hiringCost: 380, salary: 22, suggestedStart: { x: 10, y: 9 }, facing: 'ne', movementSpeed: 1.14, carryingCapacity: 6, traits: ['Bandeja firme'] }),
  staff({ id: 'stocker-1', actorId: 'employee-stocker-002', role: 'stocker', name: 'Ravi', assetId: 'stocker-0', includedByDefault: false, hiringCost: 360, salary: 21, suggestedStart: { x: 3, y: 5 }, facing: 'ne', carryingCapacity: 20, traits: ['Reposição contínua'] }),
] as const;

export type StaffCatalogEntry = StaffDefinition;
export const STAFF_BY_ID = Object.fromEntries(STAFF_CATALOG.map((entry) => [entry.id, entry])) as Record<string, StaffDefinition>;
export const STAFF_CANDIDATES = STAFF_CATALOG.filter((entry) => !entry.includedByDefault);

function roleLabel(role: StaffRole): string {
  return { cook: 'Cozinha', waiter: 'Atendimento', cleaner: 'Limpeza', stocker: 'Estoque' }[role];
}
