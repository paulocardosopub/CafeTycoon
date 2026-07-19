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
});
