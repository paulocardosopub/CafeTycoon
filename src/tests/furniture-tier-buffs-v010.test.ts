import { describe, expect, it } from 'vitest';
import { FURNITURE_BY_ID } from '../game/data/furniture/catalog';
import { furnitureTaskDurationMultiplier } from '../game/simulation/RestaurantSimulation';

const furniture = [
  { id: 'counter:t1', definitionId: 'service.c1.isolated' },
  { id: 'counter:t2a', definitionId: 'service.counter.t2' },
  { id: 'counter:t2b', definitionId: 'service.counter.t2' },
  { id: 'sink:t1', definitionId: 'washing.b5.sink' },
  { id: 'sink:t2a', definitionId: 'washing.sink.t2' },
  { id: 'sink:t2b', definitionId: 'washing.sink.t2' },
] as const;

describe('buffs locais de mobiliario 0.0.10', () => {
  it('aplica 0,88 somente ao balcao T2 realmente usado', () => {
    expect(furnitureTaskDurationMultiplier('counter:t1', 'cook_step', furniture)).toBe(1);
    expect(furnitureTaskDurationMultiplier('counter:t2a', 'cook_step', furniture)).toBe(.88);
    expect(furnitureTaskDurationMultiplier('counter:t1', 'cook_step', furniture)).toBe(1);
    expect(furnitureTaskDurationMultiplier('counter:t2a', 'clean', furniture)).toBe(1);
    expect(furnitureTaskDurationMultiplier('counter:t2a', 'production_batch', furniture)).toBe(1);
  });

  it('nao acumula dois balcoes T2 e preserva outros tipos de tarefa', () => {
    expect(furnitureTaskDurationMultiplier('counter:t2b', 'cook_step', furniture)).toBe(.88);
    expect(furnitureTaskDurationMultiplier('sink:t2a', 'cook_step', furniture)).toBe(1);
    expect(furnitureTaskDurationMultiplier('', 'cook_step', furniture)).toBe(1);
  });

  it('aplica 0,85 somente a lavagem na pia T2 usada', () => {
    expect(furnitureTaskDurationMultiplier('sink:t1', 'clean', furniture)).toBe(1);
    expect(furnitureTaskDurationMultiplier('sink:t2a', 'clean', furniture)).toBe(.85);
    expect(furnitureTaskDurationMultiplier('sink:t2b', 'clean', furniture)).toBe(.85);
    expect(furnitureTaskDurationMultiplier('counter:t2a', 'clean', furniture)).toBe(1);
  });

  it('descreve os bonus como locais no catalogo', () => {
    expect(FURNITURE_BY_ID['service.counter.t2'].name).toContain('deste balcao');
    expect(FURNITURE_BY_ID['washing.sink.t2'].name).toContain('desta pia');
  });
});
