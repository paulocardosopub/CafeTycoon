import { describe, expect, it } from 'vitest';
import { calculateOfflineProgress } from '../game/offline/OfflineService';
import { createDefaultState } from '../game/save/defaultState';
import { enqueueProduction } from '../game/cooking/ProductionService';

describe('progresso offline sem experiência', () => {
  it('permite produção e vendas sem alterar XP ou níveis', () => {
    const now = 1_900_000_000_000;
    const state = createDefaultState(now - 60 * 60 * 1000);
    state.profile = { id: state.playerId, name: 'Jogador', appearance: { presentation: 'masculina', skin: 'honey', hairStyle: 'short', hairColor: 'espresso', face: 'soft', outfit: 'casual', outfitColor: 'green' }, level: 1, xp: 0, helpRole: 'service', professions: { cook:{xp:0,level:1,tasksCompleted:0}, waiter:{xp:0,level:1,tasksCompleted:0}, cleaner:{xp:0,level:1,tasksCompleted:0}, stocker:{xp:0,level:1,tasksCompleted:0} }, taskHistory: { take_order:0,cook_step:0,deliver:0,payment:0,clean:0,stock_support:0,restock_purchase:0,production_batch:0 } };
    state.restaurantXp = 321;
    state.profile!.xp = 123;
    state.readyDishes.coffee = 12;
    enqueueProduction(state, 'coffee', 1);
    const before = {
      restaurantXp: state.restaurantXp,
      profileXp: state.profile!.xp,
      profileLevel: state.profile!.level,
      professions: structuredClone(state.profile!.professions),
      staff: state.staff.instances.map((member) => [member.id, member.level, member.experience]),
    };
    const report = calculateOfflineProgress(state, now);
    expect(report.produced.coffee ?? 0).toBeGreaterThan(0);
    expect(report.sold.coffee ?? 0).toBeGreaterThan(0);
    expect(state.restaurantXp).toBe(before.restaurantXp);
    expect(state.profile!.xp).toBe(before.profileXp);
    expect(state.profile!.level).toBe(before.profileLevel);
    expect(state.profile!.professions).toEqual(before.professions);
    expect(state.staff.instances.map((member) => [member.id, member.level, member.experience])).toEqual(before.staff);
    expect(report.experience).toBe(0);
    expect(report.characterGeneralXp).toBe(0);
    expect(report.characterProfessionXp).toBe(0);
  });
});
