import { getSessionState } from '../state/session-store';
import {
  createSyncEngine,
  type CreateSyncEngineOptions,
  type PendingSyncConflict,
  type SyncOnOpenResult,
  type SyncRunResult
} from '../core/sync/sync-engine';

export interface SyncScheduler {
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

export interface SyncService {
  syncOnOpen(): Promise<SyncOnOpenResult>;
  manualSync(): Promise<SyncRunResult>;
  resolveConflict(payload: PendingSyncConflict, choice: 'local' | 'remote'): Promise<SyncRunResult>;
  scheduleSync(intervalMs: number): SyncScheduler;
}

export function createSyncService(options: CreateSyncEngineOptions): SyncService {
  const engine = createSyncEngine(options);

  return {
    async syncOnOpen() {
      if (!getSessionState().isUnlocked) {
        const initial: SyncRunResult = {
          status: 'noop',
          source: 'none',
          localRevision: null,
          remoteRevision: null,
          localVault: null,
          pendingConflict: null
        };

        return {
          initial,
          background: Promise.resolve(initial)
        };
      }

      return engine.syncOnOpen();
    },
    async manualSync() {
      return engine.syncNow();
    },
    async resolveConflict(payload, choice) {
      return engine.resolveConflict(payload, choice);
    },
    scheduleSync(intervalMs) {
      let timerId: number | null = null;

      return {
        start() {
          if (timerId !== null) {
            return;
          }

          timerId = globalThis.setInterval(() => {
            void engine.syncNow().catch(() => undefined);
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
