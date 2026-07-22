import type { GameState } from '../../core/types';

export interface SaveRepository {
  load(): Promise<GameState | null>;
  save(state: GameState): Promise<void>;
  clear(): Promise<void>;
  backupLegacy(state: GameState): Promise<void>;
}

const DB_NAME = 'bistro-bloom';
const STORE = 'saves';
const KEY = 'main';
const BACKUP_KEY = 'backup-before-spatial-schema-5';
export const SAVE_RESET_SESSION_KEY = 'bistro-bloom-reset-in-progress';

export class IndexedDbSaveRepository implements SaveRepository {
  private async database(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async load(): Promise<GameState | null> {
    try {
      const db = await this.database();
      return await new Promise((resolve, reject) => {
        const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
        request.onsuccess = () => resolve((request.result as GameState | undefined) ?? null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      const fallback = localStorage.getItem(DB_NAME);
      return fallback ? JSON.parse(fallback) as GameState : null;
    }
  }

  async save(state: GameState): Promise<void> {
    const clean = JSON.parse(JSON.stringify(state)) as GameState;
    try {
      const db = await this.database();
      await new Promise<void>((resolve, reject) => {
        const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(clean, KEY);
        request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
      });
    } catch {
      localStorage.setItem(DB_NAME, JSON.stringify(clean));
    }
  }

  async backupLegacy(state: GameState): Promise<void> {
    const clean = JSON.parse(JSON.stringify(state)) as GameState;
    try {
      const db = await this.database();
      const existing = await new Promise<GameState | undefined>((resolve, reject) => {
        const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(BACKUP_KEY);
        request.onsuccess = () => resolve(request.result as GameState | undefined); request.onerror = () => reject(request.error);
      });
      if (existing) return;
      await new Promise<void>((resolve, reject) => {
        const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(clean, BACKUP_KEY);
        request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
      });
    } catch {
      if (!localStorage.getItem(`${DB_NAME}:${BACKUP_KEY}`)) localStorage.setItem(`${DB_NAME}:${BACKUP_KEY}`, JSON.stringify(clean));
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.database();
      await new Promise<void>((resolve, reject) => {
        const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(KEY);
        request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
      });
    } finally {
      localStorage.removeItem(DB_NAME);
      localStorage.removeItem(`${DB_NAME}:${BACKUP_KEY}`);
    }
  }
}
