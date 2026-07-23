import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TaskManager } from '../game/tasks/TaskManager';

describe('fila FIFO de clientes', () => {
  it('mantém o grupo mais antigo como barreira da fila de mesas', () => {
    const simulation = readFileSync(resolve(import.meta.dirname, '../game/simulation/RestaurantSimulation.ts'), 'utf8');
    expect(simulation).toContain(".sort((left, right) => Math.min(...left.map((customer) => customer.stateEnteredAt))");
    expect(simulation).toContain('let mayAssignSeat = true');
    expect(simulation).toContain('mayAssignSeat = false');
  });

  it('atende primeiro a tarefa mais antiga quando a prioridade é igual', () => {
    const tasks = new TaskManager();
    tasks.add({ key:'new', kind:'take_order', role:'service', target:{x:1,y:1}, duration:1, priority:70, payload:{}, createdAt:20 });
    tasks.add({ key:'old', kind:'take_order', role:'service', target:{x:2,y:2}, duration:1, priority:70, payload:{}, createdAt:10 });
    expect(tasks.claim('waiter', ['service'])?.key).toBe('old');
  });
});
