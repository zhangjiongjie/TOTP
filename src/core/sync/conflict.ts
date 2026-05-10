import type { EncryptedVaultBlob } from '../vault/crypto';

export type SyncEntitySource = 'local' | 'remote' | 'local-cache';
export type SyncEntityStatus = 'ready' | 'missing';

export interface SyncInspectionSnapshot {
  revision: string;
  updatedAt: string;
  fingerprint: string;
  source: Exclude<SyncEntitySource, 'local-cache'>;
  status: SyncEntityStatus;
}

export interface SyncChoice {
  source: 'local' | 'remote';
  revision: string;
  updatedAt: string;
}

export interface PendingConflictSnapshot extends SyncInspectionSnapshot {
  encryptedVault: EncryptedVaultBlob;
  etag: string | null;
}

export interface PendingSyncConflict {
  kind: 'vault-conflict';
  detectedAt: string;
  baseRevision: string | null;
  baseFingerprint: string | null;
  local: PendingConflictSnapshot;
  remote: PendingConflictSnapshot;
}

interface SyncDecisionBase {
  baseRevision: string | null;
  baseFingerprint: string | null;
  local: SyncInspectionSnapshot | null;
  remote: SyncInspectionSnapshot | null;
}

export interface NoConflictDecision extends SyncDecisionBase {
  kind: 'no-conflict';
}

export interface ApplyRevisionDecision extends SyncDecisionBase {
  kind: 'apply-local' | 'apply-remote';
  winner: SyncInspectionSnapshot;
  loser: SyncInspectionSnapshot | null;
}

export interface ConflictDecision extends SyncDecisionBase {
  kind: 'conflict';
  choices: [SyncChoice, SyncChoice];
}

export type SyncDecision = NoConflictDecision | ApplyRevisionDecision | ConflictDecision;

export interface DetectVaultConflictInput {
  baseRevision: string | null;
  baseFingerprint?: string | null;
  local: SyncInspectionSnapshot | null;
  remote: SyncInspectionSnapshot | null;
}

export function detectVaultConflict({
  baseRevision,
  baseFingerprint = null,
  local,
  remote
}: DetectVaultConflictInput): SyncDecision {
  if (!local && !remote) {
    return {
      kind: 'no-conflict',
      baseRevision,
      baseFingerprint,
      local,
      remote
    };
  }

  if (!remote && local) {
    return {
      kind: 'apply-local',
      baseRevision,
      baseFingerprint,
      local,
      remote,
      winner: local,
      loser: null
    };
  }

  if (!local && remote) {
    return {
      kind: 'apply-remote',
      baseRevision,
      baseFingerprint,
      local,
      remote,
      winner: remote,
      loser: null
    };
  }

  if (!local || !remote) {
    return {
      kind: 'no-conflict',
      baseRevision,
      baseFingerprint,
      local,
      remote
    };
  }

  if (local.fingerprint === remote.fingerprint) {
    return {
      kind: 'no-conflict',
      baseRevision,
      baseFingerprint,
      local,
      remote
    };
  }

  if (!baseFingerprint) {
    return createConflictDecision(baseRevision, baseFingerprint, local, remote);
  }

  const localChanged = local.fingerprint !== baseFingerprint;
  const remoteChanged = remote.fingerprint !== baseFingerprint;

  if (localChanged && !remoteChanged) {
    return {
      kind: 'apply-local',
      baseRevision,
      baseFingerprint,
      local,
      remote,
      winner: local,
      loser: remote
    };
  }

  if (!localChanged && remoteChanged) {
    return {
      kind: 'apply-remote',
      baseRevision,
      baseFingerprint,
      local,
      remote,
      winner: remote,
      loser: local
    };
  }

  if (!localChanged && !remoteChanged) {
    return {
      kind: 'no-conflict',
      baseRevision,
      baseFingerprint,
      local,
      remote
    };
  }

  return createConflictDecision(baseRevision, baseFingerprint, local, remote);
}

function createConflictDecision(
  baseRevision: string | null,
  baseFingerprint: string | null,
  local: SyncInspectionSnapshot,
  remote: SyncInspectionSnapshot
): ConflictDecision {
  return {
    kind: 'conflict',
    baseRevision,
    baseFingerprint,
    local,
    remote,
    choices: [
      {
        source: 'local',
        revision: local.revision,
        updatedAt: local.updatedAt
      },
      {
        source: 'remote',
        revision: remote.revision,
        updatedAt: remote.updatedAt
      }
    ]
  };
}
