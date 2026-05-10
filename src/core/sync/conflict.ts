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

interface SyncDecisionBase {
  baseRevision: string | null;
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
  local: SyncInspectionSnapshot | null;
  remote: SyncInspectionSnapshot | null;
}

export function detectVaultConflict({
  baseRevision,
  local,
  remote
}: DetectVaultConflictInput): SyncDecision {
  if (!local && !remote) {
    return {
      kind: 'no-conflict',
      baseRevision,
      local,
      remote
    };
  }

  if (!remote && local) {
    return {
      kind: 'apply-local',
      baseRevision,
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
      local,
      remote
    };
  }

  if (local.fingerprint === remote.fingerprint) {
    return {
      kind: 'no-conflict',
      baseRevision,
      local,
      remote
    };
  }

  if (!baseRevision) {
    return createConflictDecision(baseRevision, local, remote);
  }

  const localChanged = local.revision !== baseRevision;
  const remoteChanged = remote.revision !== baseRevision;

  if (localChanged && !remoteChanged) {
    return {
      kind: 'apply-local',
      baseRevision,
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
      local,
      remote
    };
  }

  return createConflictDecision(baseRevision, local, remote);
}

function createConflictDecision(
  baseRevision: string | null,
  local: SyncInspectionSnapshot,
  remote: SyncInspectionSnapshot
): ConflictDecision {
  return {
    kind: 'conflict',
    baseRevision,
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
