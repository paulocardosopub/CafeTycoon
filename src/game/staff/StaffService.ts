import { BALANCE } from '../../config/balance';
import type {
  GameState, GridPoint, StaffDefinition, StaffInstance, StaffSchedule, StaffState, StaffSystemState, StaffTrainingSession, TaskKind,
} from '../../core/types';
import { stableRuntimeId } from '../../core/id';
import { STAFF_BY_ID, STAFF_CANDIDATES, STAFF_CATALOG } from '../data/staff';
import { availableStaffFurniture, linkedStaffStart, staffFurnitureRequirement, validateStaffStartPosition } from '../systems/construction/StaffStartSystem';

export const DEFAULT_STAFF_SCHEDULE: StaffSchedule = {
  id: 'standard-day',
  name: 'Turno padrão',
  startTime: 8,
  endTime: 22,
  workingDays: [0, 1, 2, 3, 4, 5, 6],
  breakRules: [{ afterHours: 6, durationMinutes: 20 }],
  overtimeAllowed: true,
};

export function createStaffInstance(definition: StaffDefinition, now: number, startPosition = definition.startPosition): StaffInstance {
  return {
    id: definition.actorId,
    definitionId: definition.id,
    customName: definition.name,
    role: definition.role,
    level: definition.level,
    experience: definition.experience,
    hiredAt: now,
    currentState: 'idle',
    currentPosition: { ...startPosition },
    currentFacing: definition.facing,
    startPosition: { ...startPosition },
    salary: definition.salary,
    scheduleId: definition.scheduleId,
    enabled: true,
    automationSettings: { returnWhenIdle: definition.returnWhenIdle, allowedTasks: [...definition.allowedTasks] },
    stats: { tasksCompleted: 0, distanceWalked: 0, blockedRecoveries: 0, qualityTotal: 0, salaryPaid: 0 },
    lastProgressAt: now,
    recoveryAttempts: 0,
  };
}

export function createInitialStaffState(state: Pick<GameState, 'construction' | 'restaurantLevel'>, now = Date.now()): StaffSystemState {
  const hiredDefinitions = STAFF_CATALOG.filter((definition) => definition.includedByDefault
    || state.construction.staffStartPositions.some((position) => position.staffId === definition.id || position.staffId === definition.actorId));
  const instances = hiredDefinitions.map((definition) => {
    const savedStart = state.construction.staffStartPositions.find((position) => position.staffId === definition.id || position.staffId === definition.actorId);
    return createStaffInstance(definition, now, savedStart ? { x: savedStart.gridX, y: savedStart.gridY } : definition.startPosition);
  });
  return {
    instances,
    schedules: [{ ...DEFAULT_STAFF_SCHEDULE, workingDays: [...DEFAULT_STAFF_SCHEDULE.workingDays], breakRules: [...DEFAULT_STAFF_SCHEDULE.breakRules] }],
    candidateDefinitionIds: instances.length ? STAFF_CANDIDATES.filter((candidate) => candidate.minimumLevel <= state.restaurantLevel).map((candidate) => candidate.id) : ['cook-0'],
    candidateRefreshAt: now + BALANCE.staff.candidateRefreshSeconds * 1000,
    maxStaff: BALANCE.staff.initialLimit,
    nextPayrollAt: now + BALANCE.staff.payrollIntervalSeconds * 1000,
    salaryArrears: 0,
    payrollWarnings: [],
    training: [],
    eventLog: [{ at: now, message: 'Equipe da v0.0.5 preservada na migração.' }],
  };
}

export function sanitizeStaffState(input: StaffSystemState | undefined, state: Pick<GameState, 'construction' | 'restaurantLevel'>, now = Date.now()): StaffSystemState {
  const fallback = createInitialStaffState(state, now);
  if (!input || !Array.isArray(input.instances)) return fallback;
  const seen = new Set<string>();
  const instances = input.instances.filter((instance) => {
    if (!instance?.id || seen.has(instance.id) || !STAFF_BY_ID[instance.definitionId]) return false;
    seen.add(instance.id); return true;
  }).map((instance) => sanitizeStaffInstance(instance, now));
  for (const preserved of fallback.instances) if (!instances.some((instance) => instance.definitionId === preserved.definitionId)) instances.push(preserved);
  const schedules = Array.isArray(input.schedules) && input.schedules.length ? input.schedules.map(sanitizeSchedule) : fallback.schedules;
  return {
    ...fallback,
    ...input,
    instances,
    schedules,
    candidateDefinitionIds: (instances.length ? STAFF_CANDIDATES.filter((candidate) => candidate.minimumLevel <= state.restaurantLevel).map((candidate) => candidate.id) : ['cook-0']).filter((id) => !instances.some((instance) => instance.definitionId === id)),
    maxStaff: Math.max(instances.length, Math.floor(Number(input.maxStaff) || fallback.maxStaff)),
    nextPayrollAt: Math.max(now, Number(input.nextPayrollAt) || fallback.nextPayrollAt),
    salaryArrears: Math.max(0, Number(input.salaryArrears) || 0),
    payrollWarnings: Array.isArray(input.payrollWarnings) ? input.payrollWarnings.slice(-10) : [],
    training: Array.isArray(input.training) ? input.training.map(sanitizeTraining).slice(-20) : [],
    eventLog: Array.isArray(input.eventLog) ? input.eventLog.slice(-100) : fallback.eventLog,
  };
}

export interface StaffActionResult { ok: boolean; reason?: string; instance?: StaffInstance }

export function hireStaff(state: GameState, definitionId: string, _startPosition?: GridPoint, now = Date.now()): StaffActionResult {
  const definition = STAFF_BY_ID[definitionId];
  if (!definition || definition.includedByDefault) return { ok: false, reason: 'Candidato indisponível.' };
  if (!state.staff.instances.length && !definition.specialties.includes('Barista')) return { ok: false, reason: 'Seu primeiro funcionário deve ser o Barista iniciante.' };
  if (state.staff.instances.some((instance) => instance.definitionId === definitionId)) return { ok: false, reason: 'Este candidato já foi contratado.' };
  if (state.staff.instances.length >= state.staff.maxStaff) return { ok: false, reason: 'Limite de funcionários atingido.' };
  if (state.coins < definition.hiringCost) return { ok: false, reason: 'Saldo insuficiente para o custo de contratação.' };
  const requiredFurniture = staffFurnitureRequirement(definition.role, definition.id);
  const furniture = availableStaffFurniture(definition.role, state.construction.placedFurniture, state.construction.staffStartPositions, definition.id);
  if (requiredFurniture && !furniture) return { ok: false, reason: `Instale um ${requiredFurniture} livre para contratar este funcionário.` };
  const start = furniture
    ? linkedStaffStart(definition.id, definition.role, furniture)
    : { staffId: definition.id, gridX: Math.floor(definition.suggestedStart.x), gridY: Math.floor(definition.suggestedStart.y), facing: definition.facing, returnWhenIdle: true };
  if (state.construction.staffStartPositions.some((position) => position.gridX === start.gridX && position.gridY === start.gridY)) return { ok: false, reason: 'Outro personagem já começa nessa posição.' };
  const validation = validateStaffStartPosition(start, state.construction.placedFurniture, state.construction.builtAreas);
  if (!validation.valid) return { ok: false, reason: validation.reason };
  state.coins -= definition.hiringCost;
  const instance = createStaffInstance(definition, now, { x: start.gridX, y: start.gridY });
  state.staff.instances.push(instance);
  state.construction.staffStartPositions.push(start);
  state.staff.candidateDefinitionIds = STAFF_CANDIDATES.filter((candidate) => candidate.minimumLevel <= state.restaurantLevel && candidate.id !== definitionId).map((candidate) => candidate.id);
  logStaff(state, now, `${definition.name} foi contratado por ${definition.hiringCost} moedas.`, instance.id);
  return { ok: true, instance };
}

export function dismissStaff(state: GameState, staffId: string, now = Date.now()): StaffActionResult {
  const instance = state.staff.instances.find((item) => item.id === staffId);
  if (!instance) return { ok: false, reason: 'Funcionário não encontrado.' };
  if (['working', 'carrying', 'movingToTask'].includes(instance.currentState)) return { ok: false, reason: 'Conclua ou libere a tarefa atual antes da demissão.' };
  state.staff.instances = state.staff.instances.filter((item) => item.id !== staffId);
  state.staff.training = state.staff.training.filter((session) => session.staffId !== staffId || session.status !== 'active');
  state.construction.staffStartPositions = state.construction.staffStartPositions.filter((position) => position.staffId !== staffId && position.staffId !== instance.definitionId);
  if (!STAFF_BY_ID[instance.definitionId]?.includedByDefault) state.staff.candidateDefinitionIds.push(instance.definitionId);
  logStaff(state, now, `${instance.customName} deixou a equipe.`, staffId);
  return { ok: true, instance };
}

export function setStaffEnabled(state: GameState, staffId: string, enabled: boolean, now = Date.now()): StaffActionResult {
  const instance = state.staff.instances.find((item) => item.id === staffId);
  if (!instance) return { ok: false, reason: 'Funcionário não encontrado.' };
  instance.enabled = enabled;
  if (!enabled && !['working', 'carrying'].includes(instance.currentState)) instance.currentState = 'offShift';
  if (enabled && instance.currentState === 'offShift') instance.currentState = 'idle';
  logStaff(state, now, `${instance.customName} foi ${enabled ? 'reativado' : 'pausado'}.`, staffId);
  return { ok: true, instance };
}

export function startTraining(state: GameState, staffId: string, now = Date.now()): StaffActionResult {
  const instance = state.staff.instances.find((item) => item.id === staffId);
  if (!instance) return { ok: false, reason: 'Funcionário não encontrado.' };
  if (instance.level >= BALANCE.staff.maxLevel) return { ok: false, reason: 'Nível máximo de treinamento atingido.' };
  if (state.staff.training.some((session) => session.staffId === staffId && session.status === 'active')) return { ok: false, reason: 'Treinamento já está em andamento.' };
  if (!['idle', 'offShift', 'resting'].includes(instance.currentState)) return { ok: false, reason: 'O funcionário precisa estar livre para treinar.' };
  if (state.coins < BALANCE.staff.trainingCost) return { ok: false, reason: 'Saldo insuficiente para o treinamento.' };
  state.coins -= BALANCE.staff.trainingCost;
  const session: StaffTrainingSession = {
    id: stableRuntimeId('training'), staffId, startedAt: now, durationSeconds: BALANCE.staff.trainingDurationSeconds,
    elapsedSeconds: 0, cost: BALANCE.staff.trainingCost, status: 'active',
  };
  state.staff.training.push(session); instance.currentState = 'training';
  logStaff(state, now, `Treinamento de ${instance.customName} iniciado.`, staffId);
  return { ok: true, instance };
}

export function cancelTraining(state: GameState, staffId: string, now = Date.now()): StaffActionResult {
  const instance = state.staff.instances.find((item) => item.id === staffId);
  const session = state.staff.training.find((item) => item.staffId === staffId && item.status === 'active');
  if (!instance || !session) return { ok: false, reason: 'Treinamento ativo não encontrado.' };
  session.status = 'cancelled'; instance.currentState = instance.enabled ? 'idle' : 'offShift';
  logStaff(state, now, `Treinamento de ${instance.customName} cancelado sem reembolso.`, staffId);
  return { ok: true, instance };
}

export function tickTraining(state: GameState, deltaSeconds: number, now = Date.now()): number {
  let completed = 0;
  for (const session of state.staff.training.filter((item) => item.status === 'active')) {
    const instance = state.staff.instances.find((item) => item.id === session.staffId);
    if (!instance) { session.status = 'cancelled'; continue; }
    session.elapsedSeconds = Math.min(session.durationSeconds, session.elapsedSeconds + Math.max(0, deltaSeconds));
    instance.currentState = 'training';
    if (session.elapsedSeconds < session.durationSeconds) continue;
    session.status = 'completed';
    instance.level = Math.min(BALANCE.staff.maxLevel, instance.level + 1);
    instance.experience = Math.max(instance.experience, levelFloor(instance.level));
    instance.currentState = instance.enabled ? 'idle' : 'offShift'; completed += 1;
    logStaff(state, now, `${instance.customName} concluiu o treinamento e chegou ao nível ${instance.level}.`, instance.id);
  }
  return completed;
}

export function awardStaffTaskExperience(state: GameState, staffId: string, taskKind: TaskKind, now = Date.now()): void {
  const instance = state.staff.instances.find((item) => item.id === staffId);
  if (!instance || !instance.automationSettings.allowedTasks.includes(taskKind)) return;
  instance.experience += BALANCE.staff.experiencePerTask;
  instance.stats.tasksCompleted += 1;
  instance.stats.qualityTotal += effectiveStaffQuality(instance);
  instance.level = levelForExperience(instance.experience);
  instance.lastProgressAt = now;
}

export interface PayrollResult { charged: number; arrearsAdded: number; periods: number; warnings: string[] }

export function chargePayroll(state: GameState, periods = 1, now = Date.now()): PayrollResult {
  const count = Math.max(0, Math.floor(periods));
  const duePerPeriod = state.staff.instances.filter((instance) => instance.enabled).reduce((sum, instance) => sum + instance.salary, 0);
  const due = duePerPeriod * count;
  const warnings: string[] = [];
  let charged = 0;
  if (due > 0 && state.coins >= due) {
    state.coins -= due; charged = due;
    for (const instance of state.staff.instances.filter((item) => item.enabled)) instance.stats.salaryPaid += instance.salary * count;
  } else if (due > 0) {
    state.staff.salaryArrears += due;
    warnings.push(`Salários em atraso: ${due} moedas. Nenhum saldo negativo foi criado.`);
  }
  state.staff.nextPayrollAt = Math.max(state.staff.nextPayrollAt, now) + count * BALANCE.staff.payrollIntervalSeconds * 1000;
  state.staff.payrollWarnings = [...state.staff.payrollWarnings, ...warnings].slice(-10);
  if (charged) logStaff(state, now, `Folha paga: ${charged} moedas.`);
  if (warnings.length) logStaff(state, now, warnings[0]);
  return { charged, arrearsAdded: due - charged, periods: count, warnings };
}

export function processPayrollClock(state: GameState, now = Date.now()): PayrollResult {
  if (now < state.staff.nextPayrollAt) {
    const remaining = (state.staff.nextPayrollAt - now) / 1000;
    if (remaining <= BALANCE.staff.payrollWarningSeconds) {
      const due = estimatedPayrollCost(state);
      const message = state.coins < due ? `Caixa insuficiente para a próxima folha (${due}).` : `Próxima folha em ${Math.ceil(remaining / 60)} min.`;
      state.staff.payrollWarnings = [...new Set([...state.staff.payrollWarnings, message])].slice(-10);
    }
    return { charged: 0, arrearsAdded: 0, periods: 0, warnings: [] };
  }
  const periods = 1 + Math.floor((now - state.staff.nextPayrollAt) / (BALANCE.staff.payrollIntervalSeconds * 1000));
  return chargePayroll(state, periods, now);
}

export function estimatedPayrollCost(state: Pick<GameState, 'staff'>): number {
  return state.staff.instances.filter((instance) => instance.enabled).reduce((sum, instance) => sum + instance.salary, 0);
}

export function isStaffOnShift(instance: StaffInstance, staff: StaffSystemState, date = new Date()): boolean {
  if (!instance.enabled || staff.training.some((session) => session.staffId === instance.id && session.status === 'active')) return false;
  const schedule = staff.schedules.find((item) => item.id === instance.scheduleId) ?? DEFAULT_STAFF_SCHEDULE;
  if (!schedule.workingDays.includes(date.getDay())) return false;
  const hour = date.getHours() + date.getMinutes() / 60;
  return schedule.startTime <= schedule.endTime ? hour >= schedule.startTime && hour < schedule.endTime : hour >= schedule.startTime || hour < schedule.endTime;
}

export function effectiveStaffSpeed(instance: StaffInstance): number {
  const definition = STAFF_BY_ID[instance.definitionId];
  return (definition?.taskSpeed ?? 1) * (1 + Math.max(0, instance.level - 1) * BALANCE.staff.taskSpeedPerLevel);
}

export function effectiveMovementSpeed(instance: StaffInstance): number {
  const definition = STAFF_BY_ID[instance.definitionId];
  return (definition?.movementSpeed ?? 1) * (1 + Math.max(0, instance.level - 1) * BALANCE.staff.movementSpeedPerLevel);
}

export function effectiveStaffQuality(instance: StaffInstance): number {
  const definition = STAFF_BY_ID[instance.definitionId];
  return (definition?.quality ?? 1) * (1 + Math.max(0, instance.level - 1) * BALANCE.staff.qualityPerLevel);
}

export function staffStateFromTask(status: string | undefined, carrying: boolean, blockedSeconds: number): StaffState {
  if (blockedSeconds > 0) return 'blocked';
  if (carrying) return 'carrying';
  if (status === 'moving' || status === 'reserved') return 'movingToTask';
  if (status === 'executing') return 'working';
  return 'idle';
}

function sanitizeStaffInstance(instance: StaffInstance, now: number): StaffInstance {
  const definition = STAFF_BY_ID[instance.definitionId];
  const validState: StaffState = ['idle', 'movingToTask', 'working', 'carrying', 'waitingForWorkSlot', 'waitingForResource', 'waitingForCounterSpace', 'resting', 'offShift', 'blocked', 'recovering', 'training'].includes(instance.currentState) ? instance.currentState : 'idle';
  return {
    ...createStaffInstance(definition, now, instance.startPosition ?? definition.startPosition),
    ...instance,
    level: Math.max(1, Math.min(BALANCE.staff.maxLevel, Math.floor(Number(instance.level) || 1))),
    experience: Math.max(0, Math.floor(Number(instance.experience) || 0)),
    salary: Math.max(0, Math.floor(Number(instance.salary) || definition.salary)),
    currentState: validState,
    automationSettings: { returnWhenIdle: instance.automationSettings?.returnWhenIdle ?? true, allowedTasks: validTasks(instance.automationSettings?.allowedTasks, definition.allowedTasks) },
    stats: { ...instance.stats },
  };
}

function sanitizeSchedule(schedule: StaffSchedule): StaffSchedule {
  return {
    ...DEFAULT_STAFF_SCHEDULE, ...schedule,
    startTime: Math.max(0, Math.min(24, Number(schedule.startTime) || 0)),
    endTime: Math.max(0, Math.min(24, Number(schedule.endTime) || 0)),
    workingDays: Array.isArray(schedule.workingDays) ? [...new Set(schedule.workingDays.map((day) => Math.max(0, Math.min(6, Math.floor(day)))))] : [...DEFAULT_STAFF_SCHEDULE.workingDays],
    breakRules: Array.isArray(schedule.breakRules) ? schedule.breakRules : [],
  };
}

function sanitizeTraining(session: StaffTrainingSession): StaffTrainingSession {
  return { ...session, elapsedSeconds: Math.max(0, Math.min(Number(session.durationSeconds) || 0, Number(session.elapsedSeconds) || 0)) };
}

function validTasks(input: TaskKind[] | undefined, fallback: TaskKind[]): TaskKind[] {
  return Array.isArray(input) ? input.filter((task): task is TaskKind => ['take_order', 'cook_step', 'deliver', 'payment', 'clean', 'stock_support', 'restock_purchase', 'production_batch'].includes(task)) : [...fallback];
}

function levelForExperience(experience: number): number {
  return Math.min(BALANCE.staff.maxLevel, 1 + BALANCE.staff.levelThresholds.slice(1).filter((threshold) => experience >= threshold).length);
}

function levelFloor(level: number): number { return BALANCE.staff.levelThresholds[Math.max(0, level - 1)] ?? 0; }
function logStaff(state: GameState, at: number, message: string, staffId?: string): void { state.staff.eventLog = [...state.staff.eventLog, { at, staffId, message }].slice(-100); }
