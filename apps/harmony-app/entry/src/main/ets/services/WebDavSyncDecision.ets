export const WEBDAV_SYNC_DECISION_IDLE_EMPTY: string = 'idleEmpty';
export const WEBDAV_SYNC_DECISION_PUSH_LOCAL: string = 'pushLocal';
export const WEBDAV_SYNC_DECISION_PULL_REMOTE: string = 'pullRemote';
export const WEBDAV_SYNC_DECISION_SYNCED_EMPTY: string = 'syncedEmpty';
export const WEBDAV_SYNC_DECISION_SYNCED: string = 'synced';
export const WEBDAV_SYNC_DECISION_REFRESH_BASELINE: string = 'refreshBaseline';
export const WEBDAV_SYNC_DECISION_FIRST_BIND_CONFLICT: string = 'firstBindConflict';
export const WEBDAV_SYNC_DECISION_MERGE_AND_PUSH: string = 'mergeAndPush';
export const WEBDAV_SYNC_DECISION_CONFLICT: string = 'conflict';

export class WebDavSyncDecision {
  action: string;

  constructor(action: string) {
    this.action = action;
  }

  static decideMissingRemote(localAccountCount: number): WebDavSyncDecision {
    if (localAccountCount === 0) {
      return new WebDavSyncDecision(WEBDAV_SYNC_DECISION_IDLE_EMPTY);
    }
    return new WebDavSyncDecision(WEBDAV_SYNC_DECISION_PUSH_LOCAL);
  }

  static decideExistingRemote(input: WebDavSyncDecisionInput): WebDavSyncDecision {
    if (input.localUninitialized && input.remoteAccountCount > 0) {
      return new WebDavSyncDecision(WEBDAV_SYNC_DECISION_PULL_REMOTE);
    }
    if (input.localUninitialized && input.remoteAccountCount === 0) {
      return new WebDavSyncDecision(WEBDAV_SYNC_DECISION_SYNCED_EMPTY);
    }
    if (input.localFingerprint === input.remoteFingerprint) {
      return new WebDavSyncDecision(WEBDAV_SYNC_DECISION_SYNCED);
    }
    if (input.baseFingerprint.length === 0) {
      if (input.localAccountCount === 0 && input.remoteAccountCount > 0) {
        return new WebDavSyncDecision(WEBDAV_SYNC_DECISION_PULL_REMOTE);
      }
      if (input.localAccountCount > 0 && input.remoteAccountCount === 0) {
        return new WebDavSyncDecision(WEBDAV_SYNC_DECISION_PUSH_LOCAL);
      }
      return new WebDavSyncDecision(WEBDAV_SYNC_DECISION_FIRST_BIND_CONFLICT);
    }

    let localChanged: boolean = input.localFingerprint !== input.baseFingerprint;
    let remoteChanged: boolean = input.remoteFingerprint !== input.baseFingerprint;
    if (localChanged && !remoteChanged) {
      return new WebDavSyncDecision(WEBDAV_SYNC_DECISION_PUSH_LOCAL);
    }
    if (!localChanged && remoteChanged) {
      return new WebDavSyncDecision(WEBDAV_SYNC_DECISION_PULL_REMOTE);
    }
    if (!localChanged && !remoteChanged) {
      return new WebDavSyncDecision(WEBDAV_SYNC_DECISION_REFRESH_BASELINE);
    }
    if (input.mergedVaultAvailable) {
      return new WebDavSyncDecision(WEBDAV_SYNC_DECISION_MERGE_AND_PUSH);
    }
    return new WebDavSyncDecision(WEBDAV_SYNC_DECISION_CONFLICT);
  }

  static decidePasswordChange(input: WebDavSyncDecisionInput): WebDavSyncDecision {
    if (input.localFingerprint === input.remoteFingerprint) {
      return new WebDavSyncDecision(WEBDAV_SYNC_DECISION_SYNCED);
    }
    if (input.baseFingerprint.length === 0) {
      return new WebDavSyncDecision(WEBDAV_SYNC_DECISION_FIRST_BIND_CONFLICT);
    }

    let localChanged: boolean = input.localFingerprint !== input.baseFingerprint;
    let remoteChanged: boolean = input.remoteFingerprint !== input.baseFingerprint;
    if (localChanged && !remoteChanged) {
      return new WebDavSyncDecision(WEBDAV_SYNC_DECISION_PUSH_LOCAL);
    }
    if (!localChanged && remoteChanged) {
      return new WebDavSyncDecision(WEBDAV_SYNC_DECISION_PULL_REMOTE);
    }
    if (input.mergedVaultAvailable) {
      return new WebDavSyncDecision(WEBDAV_SYNC_DECISION_MERGE_AND_PUSH);
    }
    return new WebDavSyncDecision(WEBDAV_SYNC_DECISION_CONFLICT);
  }
}

export class WebDavSyncDecisionInput {
  localUninitialized: boolean;
  mergedVaultAvailable: boolean;
  localFingerprint: string;
  remoteFingerprint: string;
  baseFingerprint: string;
  localAccountCount: number;
  remoteAccountCount: number;

  constructor(
    localUninitialized: boolean,
    _remoteExists: boolean,
    localFingerprint: string,
    remoteFingerprint: string,
    baseFingerprint: string,
    localAccountCount: number,
    remoteAccountCount: number,
    mergedVaultAvailable: boolean
  ) {
    this.localUninitialized = localUninitialized;
    this.mergedVaultAvailable = mergedVaultAvailable;
    this.localFingerprint = localFingerprint;
    this.remoteFingerprint = remoteFingerprint;
    this.baseFingerprint = baseFingerprint;
    this.localAccountCount = localAccountCount;
    this.remoteAccountCount = remoteAccountCount;
  }
}
