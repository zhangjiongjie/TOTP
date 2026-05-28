import { describe, it, expect } from '@ohos/hypium';
import {
  WEBDAV_SYNC_DECISION_CONFLICT,
  WEBDAV_SYNC_DECISION_MERGE_AND_PUSH,
  WEBDAV_SYNC_DECISION_PULL_REMOTE,
  WEBDAV_SYNC_DECISION_PUSH_LOCAL,
  WebDavSyncDecision,
  WebDavSyncDecisionInput
} from '../../../main/ets/services/WebDavSyncDecision';

function createInput(
  localFingerprint: string,
  remoteFingerprint: string,
  baseFingerprint: string,
  mergedVaultAvailable: boolean
): WebDavSyncDecisionInput {
  return new WebDavSyncDecisionInput(
    false,
    false,
    localFingerprint,
    remoteFingerprint,
    baseFingerprint,
    1,
    1,
    mergedVaultAvailable
  );
}

export default function webDavSyncDecisionTest(): void {
  describe('WebDavSyncDecision', () => {
    it('pushes local changes when remote still matches baseline', 0, () => {
      let decision: WebDavSyncDecision = WebDavSyncDecision.decideExistingRemote(
        createInput('local-next', 'base', 'base', false)
      );

      expect(decision.action).assertEqual(WEBDAV_SYNC_DECISION_PUSH_LOCAL);
    });

    it('pulls remote changes when local still matches baseline', 0, () => {
      let decision: WebDavSyncDecision = WebDavSyncDecision.decideExistingRemote(
        createInput('base', 'remote-next', 'base', false)
      );

      expect(decision.action).assertEqual(WEBDAV_SYNC_DECISION_PULL_REMOTE);
    });

    it('merges instead of direct pushing local change when remote moved from baseline', 0, () => {
      let decision: WebDavSyncDecision = WebDavSyncDecision.decideExistingRemote(
        createInput('local-next', 'remote-next', 'base', true)
      );

      expect(decision.action).assertEqual(WEBDAV_SYNC_DECISION_MERGE_AND_PUSH);
    });

    it('conflicts instead of direct pushing local change when remote moved and merge fails', 0, () => {
      let decision: WebDavSyncDecision = WebDavSyncDecision.decideExistingRemote(
        createInput('local-next', 'remote-next', 'base', false)
      );

      expect(decision.action).assertEqual(WEBDAV_SYNC_DECISION_CONFLICT);
    });

    it('chooses local vault for password change when only local changed', 0, () => {
      let decision: WebDavSyncDecision = WebDavSyncDecision.decidePasswordChange(
        createInput('local-next', 'base', 'base', false)
      );

      expect(decision.action).assertEqual(WEBDAV_SYNC_DECISION_PUSH_LOCAL);
    });

    it('chooses remote vault for password change when only remote changed', 0, () => {
      let decision: WebDavSyncDecision = WebDavSyncDecision.decidePasswordChange(
        createInput('base', 'remote-next', 'base', false)
      );

      expect(decision.action).assertEqual(WEBDAV_SYNC_DECISION_PULL_REMOTE);
    });

    it('chooses merged vault for password change when both sides can merge', 0, () => {
      let decision: WebDavSyncDecision = WebDavSyncDecision.decidePasswordChange(
        createInput('local-next', 'remote-next', 'base', true)
      );

      expect(decision.action).assertEqual(WEBDAV_SYNC_DECISION_MERGE_AND_PUSH);
    });

    it('reports conflict for password change when both sides changed and merge fails', 0, () => {
      let decision: WebDavSyncDecision = WebDavSyncDecision.decidePasswordChange(
        createInput('local-next', 'remote-next', 'base', false)
      );

      expect(decision.action).assertEqual(WEBDAV_SYNC_DECISION_CONFLICT);
    });
  });
}
