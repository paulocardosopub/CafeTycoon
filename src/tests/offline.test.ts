import { describe, expect, it } from 'vitest';
import { BALANCE } from '../config/balance';
import { calculateOfflineProgress } from '../game/offline/OfflineService';
import { createDefaultState } from '../game/save/defaultState';
import { enqueueProduction } from '../game/cooking/ProductionService';

describe('progresso offline', () => {
  it('limita o cálculo a oito horas', () => {
    const now = 1_800_000_000_000;
    const state = createDefaultState(now - 10 * 60 * 60 * 1000);
    const report = calculateOfflineProgress(state, now);
    expect(report.absentSeconds).toBe(10 * 60 * 60);
    expect(report.calculatedSeconds).toBe(BALANCE.offline.maxSeconds);
    expect(report.capped).toBe(true);
  });

  it.each([600, 3600, 14_400, 28_800, 43_200])('calcula %s segundos sem exceder oito horas', (absent) => {
    const now = 1_800_000_000_000;
    const state = createDefaultState(now - absent * 1000);
    const report = calculateOfflineProgress(state, now);
    expect(report.calculatedSeconds).toBe(Math.min(absent, BALANCE.offline.maxSeconds));
    expect(Object.values(state.inventory).every((amount) => amount >= 0)).toBe(true);
  });

  it('produz, vende e não vende pratos inexistentes', () => {
    const now = 1_800_000_000_000;
    const state = createDefaultState(now - 60 * 60 * 1000);
    state.readyDishes.coffee = 0;
    enqueueProduction(state, 'coffee', 2);
    const report = calculateOfflineProgress(state, now);
    expect(report.produced.coffee).toBe(2);
    expect(report.sold.coffee).toBe(2);
    expect(report.coins).toBe(2 * 22);
    expect(state.readyDishes.coffee).toBe(0);
  });

  it('não duplica a recompensa na mesma retomada', () => {
    const now = 1_800_000_000_000;
    const state = createDefaultState(now - 60 * 60 * 1000);
    const first = calculateOfflineProgress(state, now);
    const coinsAfterFirst = state.coins;
    const second = calculateOfflineProgress(state, now);
    expect(first.coins).toBeGreaterThan(0);
    expect(second.calculatedSeconds).toBe(0);
    expect(second.coins).toBe(0);
    expect(state.coins).toBe(coinsAfterFirst);
  });

  it('para com ingredientes vazios sem gerar estoque negativo', () => {
    const now = 1_800_000_000_000;
    const state = createDefaultState(now - 3600 * 1000);
    for (const id of Object.keys(state.inventory) as (keyof typeof state.inventory)[]) state.inventory[id] = 0;
    enqueueProduction(state, 'omelette', 3);
    const report = calculateOfflineProgress(state, now);
    expect(report.produced.omelette ?? 0).toBe(0);
    expect(report.stoppedReasons.some((reason) => reason.includes('ingredientes'))).toBe(true);
    expect(Object.values(state.inventory).every((amount) => amount >= 0)).toBe(true);
  });

  it('respeita armazenamento cheio durante a produção offline', () => {
    const now = 1_800_000_000_000;
    const state = createDefaultState(now - 10 * 1000);
    state.readyDishes.coffee = BALANCE.readyDishCapacity;
    enqueueProduction(state, 'omelette', 1);
    const report = calculateOfflineProgress(state, now);
    expect(report.produced.omelette ?? 0).toBe(0);
    expect(report.stoppedReasons.some((reason) => reason.includes('armazenamento'))).toBe(true);
  });
});
