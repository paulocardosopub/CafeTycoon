import type { Direction, GridPoint, StaffDefinition, StaffRole, TaskKind } from '../../core/types';
import { STAFF_ROLE_CHARACTER_ASSETS } from '../../assets/pixel/characterVariantManifest';

export const STAFF_CHEF_ASSET_ID = STAFF_ROLE_CHARACTER_ASSETS.cook;

const TASKS: Record<StaffRole, TaskKind[]> = {
  cook: ['cook_step', 'production_batch'],
  waiter: ['take_order', 'deliver', 'payment'],
  cleaner: ['clean'],
  stocker: [],
};
const PAYROLL_010: Record<string, readonly [number, number]> = { Nina:[800,120], Caio:[0,100], Iara:[0,80], Lúcia:[1400,170], Célia:[2200,230], Rosa:[2800,260], Bia:[3500,300], João:[4500,340], Bento:[5000,180], Akira:[12000,520], Mauro:[14000,600], Dora:[18000,700], Kenji:[24000,850] };

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
  specialties?: string[];
  primaryProfession?: string;
  minimumLevel?: number;
  compatibleStationId?: string;
}

function staff(input: StaffInput): StaffDefinition {
  const [hiringCost, salary] = PAYROLL_010[input.name] ?? [input.hiringCost, input.salary];
  return {
    ...input, hiringCost, salary,
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
    specialties: input.specialties ?? [],
    primaryProfession: input.primaryProfession ?? roleLabel(input.role),
    minimumLevel: input.minimumLevel ?? 1,
    compatibleStationId: input.compatibleStationId ?? 'prep',
    allowedTasks: [...TASKS[input.role]],
    scheduleId: 'standard-day',
    startPosition: { ...input.suggestedStart },
    returnWhenIdle: true,
  };
}

export const STAFF_CATALOG: readonly StaffDefinition[] = [
  staff({ id: 'cook-0', actorId: 'employee-cook-001', role: 'cook', name: 'Nina', assetId: 'cook-0', includedByDefault: false, hiringCost: 100, salary: 24, suggestedStart: { x: 5, y: 4 }, facing: 'ne', taskSpeed: 1.05, quality: 1.08, traits: ['Mise en place'], specialties: ['Barista'], primaryProfession: 'Barista', minimumLevel: 1, compatibleStationId: 'coffee_machine' }),
  staff({ id: 'waiter-0', actorId: 'employee-waiter-001', role: 'waiter', name: 'Caio', assetId: 'waiter-0', includedByDefault: false, hiringCost: 0, salary: 20, suggestedStart: { x: 8, y: 8 }, facing: 'ne', movementSpeed: 1.08, traits: ['Passo leve'] }),
  staff({ id: 'cleaner-0', actorId: 'employee-cleaner-001', role: 'cleaner', name: 'Iara', assetId: 'cleaner-0', includedByDefault: false, hiringCost: 0, salary: 14, suggestedStart: { x: 13, y: 11 }, facing: 'nw', taskSpeed: 1.08, traits: ['Organizada'] }),
  staff({ id: 'cook-1', actorId: 'employee-cook-002', role: 'cook', name: 'Lúcia', assetId: 'cook-1', includedByDefault: false, hiringCost: 120, salary: 27, suggestedStart: { x: 6, y: 4 }, facing: 'ne', taskSpeed: 1.12, quality: 1.14, traits: ['Forno preciso'], specialties: ['Forneiro'], primaryProfession: 'Forneiro', minimumLevel: 5, compatibleStationId: 'oven' }),
  staff({ id: 'cook-2', actorId: 'employee-cook-003', role: 'cook', name: 'João', assetId: 'cook-2', includedByDefault: false, hiringCost: 160, salary: 29, suggestedStart: { x: 6, y: 5 }, facing: 'ne', traits: ['Chapa rápida'], specialties: ['Chapeiro'], primaryProfession: 'Chapeiro', minimumLevel: 25, compatibleStationId: 'grill' }),
  staff({ id: 'cook-3', actorId: 'employee-cook-004', role: 'cook', name: 'Célia', assetId: 'cook-3', includedByDefault: false, hiringCost: 130, salary: 31, suggestedStart: { x: 5, y: 5 }, facing: 'ne', traits: ['Caldos precisos'], specialties: ['Chef de Sopas'], primaryProfession: 'Chef de Sopas', minimumLevel: 10, compatibleStationId: 'cauldron' }),
  staff({ id: 'cook-4', actorId: 'employee-cook-005', role: 'cook', name: 'Akira', assetId: 'cook-4', includedByDefault: false, hiringCost: 220, salary: 36, suggestedStart: { x: 6, y: 6 }, facing: 'ne', traits: ['Cortes finos'], specialties: ['Chef Oriental'], primaryProfession: 'Chef Oriental', minimumLevel: 45, compatibleStationId: 'stove' }),
  staff({ id: 'cook-5', actorId: 'employee-cook-006', role: 'cook', name: 'Mauro', assetId: 'cook-5', includedByDefault: false, hiringCost: 230, salary: 34, suggestedStart: { x: 5, y: 6 }, facing: 'ne', traits: ['Brasa controlada'], specialties: ['Assador'], primaryProfession: 'Assador', minimumLevel: 47, compatibleStationId: 'grill' }),
  staff({ id: 'cook-6', actorId: 'employee-cook-007', role: 'cook', name: 'Rosa', assetId: 'cook-6', includedByDefault: false, hiringCost: 140, salary: 25, suggestedStart: { x: 4, y: 5 }, facing: 'ne', traits: ['Versátil'], specialties: ['Cozinheiro Geral'], primaryProfession: 'Cozinheiro Geral', minimumLevel: 15, compatibleStationId: 'stove' }),
  staff({ id: 'cook-7', actorId: 'employee-cook-008', role: 'cook', name: 'Bia', assetId: 'cook-7', includedByDefault: false, hiringCost: 150, salary: 26, suggestedStart: { x: 4, y: 6 }, facing: 'ne', traits: ['Fritura crocante'], specialties: ['Fritureiro'], primaryProfession: 'Fritureiro', minimumLevel: 20, compatibleStationId: 'grill' }),
  staff({ id: 'cook-8', actorId: 'employee-cook-009', role: 'cook', name: 'Dora', assetId: 'cook-8', includedByDefault: false, hiringCost: 200, salary: 32, suggestedStart: { x: 7, y: 5 }, facing: 'ne', traits: ['Precisão doce'], specialties: ['Confeiteiro'], primaryProfession: 'Confeiteiro', minimumLevel: 55, compatibleStationId: 'prep' }),
  staff({ id: 'cook-9', actorId: 'employee-cook-010', role: 'cook', name: 'Kenji', assetId: 'cook-9', includedByDefault: false, hiringCost: 240, salary: 37, suggestedStart: { x: 7, y: 6 }, facing: 'ne', traits: ['Lâmina precisa'], specialties: ['Sushiman'], primaryProfession: 'Sushiman', minimumLevel: 63, compatibleStationId: 'prep' }),
  staff({ id: 'waiter-1', actorId: 'employee-waiter-002', role: 'waiter', name: 'Bento', assetId: 'waiter-1', includedByDefault: false, hiringCost: 380, salary: 22, suggestedStart: { x: 10, y: 9 }, facing: 'ne', movementSpeed: 1.14, carryingCapacity: 6, traits: ['Bandeja firme'] }),
] as const;

export type StaffCatalogEntry = StaffDefinition;
export const STAFF_BY_ID = Object.fromEntries(STAFF_CATALOG.map((entry) => [entry.id, entry])) as Record<string, StaffDefinition>;
export const STAFF_CANDIDATES = STAFF_CATALOG.filter((entry) => !entry.includedByDefault);

function roleLabel(role: StaffRole): string {
  return { cook: 'Cozinha', waiter: 'Atendimento', cleaner: 'Limpeza', stocker: 'Estoque' }[role];
}
