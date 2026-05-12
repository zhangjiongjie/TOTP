import { describe, expect, it } from 'vitest';

import {
  detectVaultConflict,
  type SyncInspectionSnapshot
} from './conflict';

function createSnapshot(
  overrides: Partial<SyncInspectionSnapshot> = {}
): SyncInspectionSnapshot {
  return {
    revision: 'rev-1',
    updatedAt: '2026-05-10T00:00:00.000Z',
    fingerprint: 'fingerprint-1',
    status: 'ready',
    source: 'local',
    ...overrides
  };
}

describe('detectVaultConflict', () => {
  it('returns no-conflict when local and remote are already identical', () => {
    const local = createSnapshot({ source: 'local' });
    const remote = createSnapshot({ source: 'remote' });

    const decision = detectVaultConflict({
      baseRevision: 'rev-1',
      local,
      remote
    });

    expect(decision.kind).toBe('no-conflict');
    if (decision.kind !== 'no-conflict') {
      throw new Error(`Expected no-conflict decision, received ${decision.kind}.`);
    }
    if (decision.local === null || decision.remote === null) {
      throw new Error('Expected local and remote snapshots to be present.');
    }
    expect(decision.baseRevision).toBe('rev-1');
    expect(decision.local.revision).toBe('rev-1');
    expect(decision.remote.revision).toBe('rev-1');
  });

  it('returns no-conflict when revisions differ but local and remote content fingerprints match', () => {
    const decision = detectVaultConflict({
      baseRevision: 'rev-1',
      baseFingerprint: 'fingerprint-1',
      local: createSnapshot({
        revision: 'rev-local',
        fingerprint: 'fingerprint-shared'
      }),
      remote: createSnapshot({
        source: 'remote',
        revision: 'rev-remote',
        fingerprint: 'fingerprint-shared'
      })
    });

    expect(decision.kind).toBe('no-conflict');
  });

  it('returns apply-local when only local changed from the base revision', () => {
    const decision = detectVaultConflict({
      baseRevision: 'rev-1',
      baseFingerprint: 'fingerprint-1',
      local: createSnapshot({
        revision: 'rev-2',
        fingerprint: 'fingerprint-2',
        updatedAt: '2026-05-10T01:00:00.000Z'
      }),
      remote: createSnapshot({ source: 'remote' })
    });

    expect(decision.kind).toBe('apply-local');
    if (decision.kind !== 'apply-local') {
      throw new Error(`Expected apply-local decision, received ${decision.kind}.`);
    }
    if (decision.loser === null) {
      throw new Error('Expected losing snapshot to be present for apply-local.');
    }
    expect(decision.winner.source).toBe('local');
    expect(decision.loser.source).toBe('remote');
  });

  it('returns apply-remote when only remote changed from the base revision', () => {
    const decision = detectVaultConflict({
      baseRevision: 'rev-1',
      baseFingerprint: 'fingerprint-1',
      local: createSnapshot(),
      remote: createSnapshot({
        source: 'remote',
        revision: 'rev-2',
        fingerprint: 'fingerprint-2',
        updatedAt: '2026-05-10T02:00:00.000Z'
      })
    });

    expect(decision.kind).toBe('apply-remote');
    if (decision.kind !== 'apply-remote') {
      throw new Error(`Expected apply-remote decision, received ${decision.kind}.`);
    }
    if (decision.loser === null) {
      throw new Error('Expected losing snapshot to be present for apply-remote.');
    }
    expect(decision.winner.source).toBe('remote');
    expect(decision.loser.source).toBe('local');
  });

  it('returns conflict when both local and remote changed from the base revision', () => {
    const decision = detectVaultConflict({
      baseRevision: 'rev-1',
      baseFingerprint: 'fingerprint-1',
      local: createSnapshot({
        revision: 'rev-local',
        fingerprint: 'fingerprint-local',
        updatedAt: '2026-05-10T03:00:00.000Z'
      }),
      remote: createSnapshot({
        source: 'remote',
        revision: 'rev-remote',
        fingerprint: 'fingerprint-remote',
        updatedAt: '2026-05-10T04:00:00.000Z'
      })
    });

    expect(decision.kind).toBe('conflict');
    if (decision.kind !== 'conflict') {
      throw new Error(`Expected conflict decision, received ${decision.kind}.`);
    }
    expect(decision.choices).toEqual([
      {
        source: 'local',
        revision: 'rev-local',
        updatedAt: '2026-05-10T03:00:00.000Z'
      },
      {
        source: 'remote',
        revision: 'rev-remote',
        updatedAt: '2026-05-10T04:00:00.000Z'
      }
    ]);
  });
});
