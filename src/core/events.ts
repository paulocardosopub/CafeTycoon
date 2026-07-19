type Listener<T = unknown> = (payload: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<Listener>>();

  on<T>(event: string, listener: Listener<T>): () => void {
    const bucket = this.listeners.get(event) ?? new Set<Listener>();
    bucket.add(listener as Listener);
    this.listeners.set(event, bucket);
    return () => bucket.delete(listener as Listener);
  }

  emit<T>(event: string, payload: T): void {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }
}

export const gameEvents = new EventBus();
