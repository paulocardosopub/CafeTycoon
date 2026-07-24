import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { createDefaultState } from '../game/save/defaultState';
import { createStaffInstance, processPayrollClock, sanitizeStaffState } from '../game/staff/StaffService';
import { STAFF_BY_ID } from '../game/data/staff';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const interval = BALANCE.staff.payrollIntervalSeconds * 1000;
function withWorker(now = 0) {
  const state = createDefaultState(now); const definition = STAFF_BY_ID['cook-0'];
  const worker = createStaffInstance(definition, now); state.staff.instances = [worker]; state.staff.nextPayrollAt = interval;
  return { state, worker };
}

describe('carencia individual de folha 0.0.10', () => {
  it('nao cobra imediatamente nem antes do ciclo completo', () => {
    const { state, worker } = withWorker(); const coins = state.coins;
    expect(worker.payrollEligibleAt).toBe(interval);
    expect(processPayrollClock(state, interval - 1).charged).toBe(0); expect(state.coins).toBe(coins);
  });
  it('cobra salario integral no limite e nao duplica o mesmo ciclo', () => {
    const { state, worker } = withWorker(); const coins = state.coins;
    expect(processPayrollClock(state, interval).charged).toBe(worker.salary);
    expect(state.coins).toBe(coins - worker.salary); expect(processPayrollClock(state, interval).charged).toBe(0);
  });
  it('mantem elegibilidades independentes e ignora carencia em ciclos anteriores', () => {
    const { state, worker } = withWorker(); const later = createStaffInstance(STAFF_BY_ID['waiter-0'], interval - 1);
    state.staff.instances.push(later); processPayrollClock(state, interval);
    expect(worker.stats.salaryPaid).toBe(worker.salary); expect(later.stats.salaryPaid).toBe(0);
    processPayrollClock(state, interval * 2); expect(later.stats.salaryPaid).toBe(later.salary);
  });
  it('normaliza save legado com prazo estavel sem cobrar na migracao', () => {
    const { state, worker } = withWorker(100); const coins = state.coins;
    const legacy = { ...worker } as Record<string, unknown>; delete legacy.payrollEligibleAt;
    const once = sanitizeStaffState({ ...state.staff, instances: [legacy as never] }, state, 200);
    const twice = sanitizeStaffState(once, state, 300);
    expect(once.instances[0].payrollEligibleAt).toBe(interval); expect(twice.instances[0].payrollEligibleAt).toBe(once.instances[0].payrollEligibleAt); expect(state.coins).toBe(coins);
  });
  it('deriva ambos os timestamps ausentes da proxima folha persistida', () => {
    const { state, worker } = withWorker(); const coins = state.coins;
    const legacy = { ...worker } as Record<string, unknown>; delete legacy.hiredAt; delete legacy.payrollEligibleAt;
    const once = sanitizeStaffState({ ...state.staff, instances: [legacy as never], nextPayrollAt: interval }, state, 99);
    const twice = sanitizeStaffState(once, state, 777);
    expect(once.instances[0].hiredAt).toBe(0); expect(once.instances[0].payrollEligibleAt).toBe(interval);
    expect(twice.instances[0].hiredAt).toBe(once.instances[0].hiredAt); expect(twice.instances[0].payrollEligibleAt).toBe(once.instances[0].payrollEligibleAt); expect(state.coins).toBe(coins);
  });
  it('liga os dois textos ao painel real da equipe', () => {
    const ui = readFileSync(resolve(import.meta.dirname, '../ui/GameUI.ts'), 'utf8');
    expect(ui).toContain('Primeiro salário em'); expect(ui).toContain('Próximo salário em'); expect(ui).toContain('member.payrollEligibleAt');
  });
});
