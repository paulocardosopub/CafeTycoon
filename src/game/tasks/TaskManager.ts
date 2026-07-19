import type { GridPoint, HelpRole, TaskKind } from '../../core/types';
import { stableRuntimeId } from '../../core/id';

export type TaskStatus = 'available' | 'reserved' | 'active' | 'complete';
export interface RestaurantTask {
  id: string;
  key: string;
  kind: TaskKind;
  role: HelpRole;
  target: GridPoint;
  duration: number;
  priority: number;
  payload: Record<string, unknown>;
  status: TaskStatus;
  reservedBy?: string;
}

export class TaskManager {
  private tasks = new Map<string, RestaurantTask>();

  add(input: Omit<RestaurantTask, 'id' | 'status'>): RestaurantTask {
    const existing = [...this.tasks.values()].find((task) => task.key === input.key && task.status !== 'complete');
    if (existing) return existing;
    const task: RestaurantTask = { ...input, id: stableRuntimeId('task'), status: 'available' };
    this.tasks.set(task.id, task);
    return task;
  }

  claim(actorId: string, roles: HelpRole[], preferredId?: string, predicate: (task: RestaurantTask) => boolean = () => true): RestaurantTask | undefined {
    const available = [...this.tasks.values()]
      .filter((task) => task.status === 'available' && roles.includes(task.role) && predicate(task))
      .sort((a, b) => (a.id === preferredId ? -1 : b.id === preferredId ? 1 : b.priority - a.priority));
    const task = available[0];
    if (task) { task.status = 'reserved'; task.reservedBy = actorId; }
    return task;
  }

  activate(taskId: string, actorId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.reservedBy !== actorId || task.status !== 'reserved') return false;
    task.status = 'active'; return true;
  }

  complete(taskId: string, actorId: string): RestaurantTask | undefined {
    const task = this.tasks.get(taskId);
    if (!task || task.reservedBy !== actorId) return undefined;
    task.status = 'complete';
    return task;
  }

  release(taskId: string, actorId: string): void {
    const task = this.tasks.get(taskId);
    if (task?.reservedBy === actorId && task.status !== 'complete') {
      task.status = 'available'; task.reservedBy = undefined;
    }
  }

  cancelAvailable(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'available') return false;
    this.tasks.delete(taskId); return true;
  }

  cancelWhere(predicate: (task: RestaurantTask) => boolean): void {
    for (const [id, task] of this.tasks) if (task.status !== 'active' && predicate(task)) this.tasks.delete(id);
  }

  get(taskId: string): RestaurantTask | undefined { return this.tasks.get(taskId); }
  list(includeComplete = false): RestaurantTask[] { return [...this.tasks.values()].filter((task) => includeComplete || task.status !== 'complete'); }
  availableFor(role: HelpRole): RestaurantTask[] { return this.list().filter((task) => task.role === role && task.status === 'available'); }
  prune(): void { for (const [id, task] of this.tasks) if (task.status === 'complete') this.tasks.delete(id); }
}
