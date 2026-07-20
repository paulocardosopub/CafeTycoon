import { describe, expect, it } from 'vitest';
import { TaskManager } from '../game/tasks/TaskManager';
import { createDefaultState } from '../game/save/defaultState';
import { migrateAndSanitizeSave } from '../game/save/migrations';

describe('reservas de tarefas', () => {
  it('impede duas pessoas de reservar a mesma tarefa', () => {
    const manager = new TaskManager();
    const task = manager.add({ key: 'table:1:clean', kind: 'clean', role: 'cleaning', target: { x: 2, y: 2 }, duration: 4, priority: 10, payload: { tableId: '1' } });
    expect(manager.claim('worker-a', ['cleaning'])?.id).toBe(task.id);
    expect(manager.claim('worker-b', ['cleaning'])).toBeUndefined();
    manager.release(task.id, 'worker-a');
    expect(manager.claim('worker-b', ['cleaning'])?.id).toBe(task.id);
  });
});

describe('serialização do save', () => {
  it('preserva os recursos e saneia valores inválidos', () => {
    const state = createDefaultState(123);
    state.coins = 999;
    state.inventory.egg = 11;
    const serialized = JSON.stringify(state);
    const restored = migrateAndSanitizeSave(JSON.parse(serialized), 456);
    expect(restored.coins).toBe(999);
    expect(restored.inventory.egg).toBe(11);
    expect(restored.schemaVersion).toBe(3);

    restored.coins = -10;
    restored.inventory.egg = Number.NaN;
    const sanitized = migrateAndSanitizeSave(restored, 789);
    expect(sanitized.coins).toBe(0);
    expect(sanitized.inventory.egg).toBe(0);
  });
});
