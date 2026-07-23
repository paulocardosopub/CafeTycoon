import { describe, expect, it } from 'vitest';
import { RECIPE_BY_ID } from '../content/recipes/recipes';
import { REQUIRED_PROFESSIONS } from '../content/progression/levels';
import { FURNITURE_BY_ID } from '../game/data/furniture/catalog';
import { STAFF_BY_ID } from '../game/data/staff';
import { applyProgressionThroughLevel } from '../game/progression/RewardService';
import { createDefaultState } from '../game/save/defaultState';

describe('ritmo dos primeiros níveis', () => {
  it('espaça as seis primeiras profissões nos níveis 1, 5, 10, 15, 20 e 25', () => {
    expect(Object.keys(REQUIRED_PROFESSIONS).map(Number).slice(0, 6)).toEqual([1, 5, 10, 15, 20, 25]);
    expect(STAFF_BY_ID['cook-1'].minimumLevel).toBe(5);
    expect(STAFF_BY_ID['cook-3'].minimumLevel).toBe(10);
    expect(STAFF_BY_ID['cook-6'].minimumLevel).toBe(15);
    expect(STAFF_BY_ID['cook-7'].minimumLevel).toBe(20);
    expect(STAFF_BY_ID['cook-2'].minimumLevel).toBe(25);
  });

  it('alinha as estações com o nível do profissional correspondente', () => {
    expect(FURNITURE_BY_ID['cooking.a2.convection'].level).toBe(5);
    expect(FURNITURE_BY_ID['cooking.a5.kettle'].level).toBe(10);
    expect(FURNITURE_BY_ID['cooking.a1.stove'].level).toBe(15);
    expect(FURNITURE_BY_ID['cooking.a4.fryer'].level).toBe(20);
    expect(FURNITURE_BY_ID['cooking.a3.griddle'].level).toBe(25);
  });

  it('reduz o primeiro lote de fornearia e posterga a sopa', () => {
    expect(RECIPE_BY_ID['chocolate-cookies']).toMatchObject({ requiredLevel: 5, baseDurationSeconds: 300 });
    expect(RECIPE_BY_ID.soup).toMatchObject({ requiredLevel: 10, baseDurationSeconds: 600 });
    expect(RECIPE_BY_ID['cheese-bread'].baseDurationSeconds).toBeLessThanOrEqual(720);
  });

  it('concede dinheiro nos níveis de intervalo antes da fornearia', () => {
    const state = createDefaultState(0);
    const before = state.coins;
    applyProgressionThroughLevel(state, 4, { notify: false });
    expect(state.coins - before).toBe(600);
  });
});
