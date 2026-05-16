import type { SyncRunResult } from '@totp/sync';
import { runManualSyncFromAppState } from '../state/app-store';

export async function runRuntimeManualSync(): Promise<SyncRunResult> {
  return runManualSyncFromAppState();
}
