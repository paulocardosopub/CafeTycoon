import type { GridPoint, HelpRole, TaskKind } from '../../core/types';
import { stableRuntimeId } from '../../core/id';

export type TaskStatus = 'pending' | 'reserved' | 'moving' | 'executing' | 'completed' | 'cancelled' | 'blocked';

export interface TaskReservation {
  type: 'seat' | 'station' | 'counter' | 'ingredient' | 'movement' | 'workSlot' | 'equipment' | 'storage';
  id: string;
}

export interface RestaurantTask {
  id: string;
  key: string;
  kind: TaskKind;
  role: HelpRole;
  origin?: GridPoint;
  target: GridPoint;
  duration: number;
  priority: number;
  payload: Record<string, unknown>;
  status: TaskStatus;
  createdAt: number;
  waitSeconds: number;
  reservations: TaskReservation[];
  completionCondition: string;
  cancellationCondition: string;
  assignedActorId?: string;
  retryCount: number;
  blockedReason?: string;
}

type TaskInput = Omit<RestaurantTask, 'id' | 'status' | 'createdAt' | 'waitSeconds' | 'reservations' | 'completionCondition' | 'cancellationCondition' | 'retryCount'> &
  Partial<Pick<RestaurantTask, 'createdAt' | 'reservations' | 'completionCondition' | 'cancellationCondition'>>;

export class TaskManager {
  private tasks = new Map<string, RestaurantTask>();

  add(input: TaskInput, now = 0): RestaurantTask {
    const existing = [...this.tasks.values()].find((task) => task.key === input.key && !['completed', 'cancelled'].includes(task.status));
    if (existing) return existing;
    const task: RestaurantTask = {
      ...input,
      id: stableRuntimeId('task'),
      status: 'pending',
      createdAt: input.createdAt ?? now,
      waitSeconds: 0,
      reservations: input.reservations ?? [],
      completionCondition: input.completionCondition ?? 'A ação foi aplicada uma vez ao alvo válido.',
      cancellationCondition: input.cancellationCondition ?? 'O alvo deixou de existir ou a ação se tornou impossível.',
      retryCount: 0,
    };
    this.tasks.set(task.id, task);
    return task;
  }

  tick(delta: number): void {
    for (const task of this.tasks.values()) if (['pending', 'blocked', 'reserved', 'moving'].includes(task.status)) task.waitSeconds += Math.max(0, delta);
  }

  claim(actorId: string, roles: HelpRole[], preferredId?: string, predicate: (task: RestaurantTask) => boolean = () => true): RestaurantTask | undefined {
    const available = [...this.tasks.values()]
      .filter((task) => task.status === 'pending' && roles.includes(task.role) && predicate(task))
      .sort((a, b) => (a.id === preferredId ? -1 : b.id === preferredId ? 1 : (b.priority + b.waitSeconds * .02) - (a.priority + a.waitSeconds * .02)));
    const task = available[0];
    if (task) { task.status = 'reserved'; task.assignedActorId = actorId; }
    return task;
  }

  markMoving(taskId: string, actorId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.assignedActorId !== actorId || task.status !== 'reserved') return false;
    task.status = 'moving';
    return true;
  }

  activate(taskId: string, actorId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.assignedActorId !== actorId || !['reserved', 'moving'].includes(task.status)) return false;
    task.status = 'executing';
    return true;
  }

  complete(taskId: string, actorId: string): RestaurantTask | undefined {
    const task = this.tasks.get(taskId);
    if (!task || task.assignedActorId !== actorId || task.status !== 'executing') return undefined;
    task.status = 'completed';
    return task;
  }

  release(taskId: string, actorId: string, reason?: string): void {
    const task = this.tasks.get(taskId);
    if (task?.assignedActorId === actorId && !['completed', 'cancelled'].includes(task.status)) {
      task.status = reason ? 'blocked' : 'pending';
      task.blockedReason = reason;
      task.assignedActorId = undefined;
      task.retryCount += reason ? 1 : 0;
    }
  }

  retryBlocked(): void {
    for (const task of this.tasks.values()) if (task.status === 'blocked') { task.status = 'pending'; task.blockedReason = undefined; }
  }

  releaseStaleReservations(maxWaitSeconds: number): RestaurantTask[] {
    const released: RestaurantTask[] = [];
    for (const task of this.tasks.values()) {
      if (task.status !== 'blocked' || task.waitSeconds < maxWaitSeconds) continue;
      task.status = 'pending'; task.assignedActorId = undefined; task.blockedReason = 'Reserva antiga liberada para reavaliação.';
      task.retryCount += 1; task.waitSeconds = 0; released.push(task);
    }
    return released;
  }

  reprioritize(taskId: string, priority: number): boolean {
    const task = this.tasks.get(taskId);
    if (!task || ['completed', 'cancelled'].includes(task.status)) return false;
    task.priority = Math.max(0, Math.min(200, Number(priority) || 0)); return true;
  }

  cancel(taskId: string, reason = 'Cancelada com segurança.'): RestaurantTask | undefined {
    const task = this.tasks.get(taskId);
    if (!task || ['completed', 'cancelled'].includes(task.status)) return undefined;
    task.status = 'cancelled';
    task.blockedReason = reason;
    task.assignedActorId = undefined;
    return task;
  }

  cancelWhere(predicate: (task: RestaurantTask) => boolean, reason?: string): RestaurantTask[] {
    const cancelled: RestaurantTask[] = [];
    for (const task of this.tasks.values()) if (!['completed', 'cancelled'].includes(task.status) && predicate(task)) {
      const result = this.cancel(task.id, reason);
      if (result) cancelled.push(result);
    }
    return cancelled;
  }

  restore(records: Record<string, unknown>[]): void {
    this.tasks.clear();
    for (const record of records) {
      const task = record as unknown as RestaurantTask;
      if (!task.id || !task.key || !task.kind || !task.role || !task.target) continue;
      const status: TaskStatus = ['completed', 'cancelled'].includes(task.status) ? task.status : 'pending';
      this.tasks.set(task.id, {
        ...task,
        status,
        assignedActorId: undefined,
        waitSeconds: Math.max(0, Number(task.waitSeconds) || 0),
        retryCount: Math.max(0, Number(task.retryCount) || 0),
        reservations: Array.isArray(task.reservations) ? task.reservations : [],
      });
    }
  }

  serialize(): Record<string, unknown>[] {
    return JSON.parse(JSON.stringify([...this.tasks.values()])) as Record<string, unknown>[];
  }

  get(taskId: string): RestaurantTask | undefined { return this.tasks.get(taskId); }
  list(includeTerminal = false): RestaurantTask[] { return [...this.tasks.values()].filter((task) => includeTerminal || !['completed', 'cancelled'].includes(task.status)); }
  availableFor(role: HelpRole): RestaurantTask[] { return this.list().filter((task) => task.role === role && task.status === 'pending'); }
  prune(): void { for (const [id, task] of this.tasks) if (['completed', 'cancelled'].includes(task.status)) this.tasks.delete(id); }
}
