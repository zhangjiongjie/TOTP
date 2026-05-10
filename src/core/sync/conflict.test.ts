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
    expect(decision.baseRevision).toBe('rev-1');
    expect(decision.local.revision).toBe('rev-1');
    expect(decision.remote.revision).toBe('rev-1');
  });

  it('returns apply-local when only local changed from the base revision', () => {
    const decision = detectVaultConflict({
      baseRevision: 'rev-1',
      local: createSnapshot({
        revision: 'rev-2',
        fingerprint: 'fingerprint-2',
        updatedAt: '2026-05-10T01:00:00.000Z'
      }),
      remote: createSnapshot({ source: 'remote' })
    });

    expect(decision.kind).toBe('apply-local');
    expect(decision.winner.source).toBe('local');
    expect(decision.loser.source).toBe('remote');
  });

  it('returns apply-remote when only remote changed from the base revision', () => {
    const decision = detectVaultConflict({
      baseRevision: 'rev-1',
      local: createSnapshot(),
      remote: createSnapshot({
        source: 'remote',
        revision: 'rev-2',
        fingerprint: 'fingerprint-2',
        updatedAt: '2026-05-10T02:00:00.000Z'
      })
    });

    expect(decision.kind).toBe('apply-remote');
    expect(decision.winner.source).toBe('remote');
    expect(decision.loser.source).toBe('local');
  });

  it('returns conflict when both local and remote changed from the base revision', () => {
    const decision = detectVaultConflict({
      baseRevision: 'rev-1',
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
