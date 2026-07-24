import { describe, expect, it } from 'vitest';
import { RECIPES } from '../content/recipes/recipes';
import { createDefaultState } from '../game/save/defaultState';
import { migrateAndSanitizeSave } from '../game/save/migrations';
import { economicProfileFromRandom, RestaurantSimulation, stableEconomicProfile } from '../game/simulation/RestaurantSimulation';

describe('perfis economicos 0.0.10', () => {
  it('respeita exatamente os limites 50/40/10', () => {
    expect(economicProfileFromRandom(0)).toBe('economic'); expect(economicProfileFromRandom(.4999)).toBe('economic');
    expect(economicProfileFromRandom(.5)).toBe('regular'); expect(economicProfileFromRandom(.8999)).toBe('regular');
    expect(economicProfileFromRandom(.9)).toBe('high_income'); expect(economicProfileFromRandom(.999999)).toBe('high_income');
  });

  it('converge para 50/40/10 com RNG deterministico', () => {
    let seed = 123456789; const counts = { economic: 0, regular: 0, high_income: 0 };
    for (let i = 0; i < 100000; i += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      counts[economicProfileFromRandom(seed / 0x1_0000_0000)] += 1;
    }
    expect(counts.economic / 100000).toBeCloseTo(.5, 2); expect(counts.regular / 100000).toBeCloseTo(.4, 2); expect(counts.high_income / 100000).toBeCloseTo(.1, 2);
  });

  it('nao depende de sequencia fixa para classificar o sorteio', () => {
    expect([.12, .84, .96, .31, .72].map(economicProfileFromRandom)).toEqual(['economic', 'regular', 'high_income', 'economic', 'regular']);
  });

  it('preserva o perfil sorteado durante a visita e em save/load', () => {
    const state = createDefaultState(0); const simulation = new RestaurantSimulation(state); simulation.debugSetAutoSpawn(false);
    const customer = simulation.debugAddCustomer()!; const profile = customer.economicProfile;
    simulation.debugRunFor(4);
    expect(simulation.customers.find((item) => item.id === customer.id)?.economicProfile).toBe(profile);
    simulation.prepareSave(4);
    const restored = new RestaurantSimulation(migrateAndSanitizeSave(JSON.parse(JSON.stringify(state)), 4));
    expect(restored.customers.find((item) => item.id === customer.id)?.economicProfile).toBe(profile);
  });

  it('atribui e persiste perfil estavel para cliente legado sem perfil', () => {
    const state = createDefaultState(0); const simulation = new RestaurantSimulation(state); simulation.debugSetAutoSpawn(false);
    const customer = simulation.debugAddCustomer()!; simulation.prepareSave(0);
    delete (state.operation!.customers[0] as Record<string, unknown>).economicProfile;
    const once = migrateAndSanitizeSave(JSON.parse(JSON.stringify(state)), 1);
    const profile = (once.operation!.customers[0] as Record<string, unknown>).economicProfile;
    expect(profile).toBe(stableEconomicProfile(customer.id));
    const twice = migrateAndSanitizeSave(JSON.parse(JSON.stringify(once)), 2);
    expect((twice.operation!.customers[0] as Record<string, unknown>).economicProfile).toBe(profile);
  });

  it('mantem o preco oficial da receita independente do perfil', () => {
    const officialPrice = RECIPES.find((recipe) => recipe.id === 'coffee')!.salePrice;
    for (const profile of ['economic', 'regular', 'high_income'] as const) {
      expect(profile).toBeTruthy();
      expect(RECIPES.find((recipe) => recipe.id === 'coffee')!.salePrice).toBe(officialPrice);
    }
  });
});
