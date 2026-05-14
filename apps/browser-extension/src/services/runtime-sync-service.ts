import type { SyncRunResult } from '../core/sync/sync-engine';
import { runManualSyncFromAppState } from '../state/app-store';

export async function runRuntimeManualSync(): Promise<SyncRunResult> {
  return runManualSyncFromAppState();
}
