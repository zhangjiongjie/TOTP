import { getSessionState } from '../state/session-store';
import { createSyncEngine, type CreateSyncEngineOptions, type SyncRunResult } from '../core/sync/sync-engine';

export interface SyncScheduler {
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

export interface SyncService {
  syncOnOpen(): Promise<SyncRunResult>;
  manualSync(): Promise<SyncRunResult>;
  scheduleSync(intervalMs: number): SyncScheduler;
}

export function createSyncService(options: CreateSyncEngineOptions): SyncService {
  const engine = createSyncEngine(options);

  return {
    async syncOnOpen() {
      if (!getSessionState().isUnlocked) {
        return {
          status: 'noop',
          source: 'none',
          localRevision: null,
          remoteRevision: null,
          localVault: null
        };
      }

      return engine.syncOnOpen();
    },
    async manualSync() {
      return engine.syncNow();
    },
    scheduleSync(intervalMs) {
      let timerId: number | null = null;

      return {
        start() {
          if (timerId !== null) {
            return;
          }

          timerId = globalThis.setInterval(() => {
            void engine.syncNow();
          }, intervalMs);
        },
        stop() {
          if (timerId === null) {
            return;
          }

          globalThis.clearInterval(timerId);
          timerId = null;
        },
        isRunning() {
          return timerId !== null;
        }
      };
    }
  };
}
