import { refreshAutomaticSync } from '../state/app-store';
import { type WebDavProfile } from '@totp/sync';
import { type SyncMetadataSnapshot } from '@totp/sync';
import { syncStore } from './settings-storage';
import type { SettingsSnapshot } from './settings-types';

export const webDavSettingsOps = {
  async getSnapshot(): Promise<SettingsSnapshot> {
    const metadata = await syncStore.load();

    return {
      webDavProfile: metadata.profile ? { ...metadata.profile } : null,
      syncMetadata: {
        lastStatus: metadata.lastStatus,
        lastSyncedAt: metadata.lastSyncedAt,
        lastError: metadata.lastError,
        pendingConflict: metadata.pendingConflict
      }
    };
  },

  async saveWebDavProfile(profile: WebDavProfile): Promise<WebDavProfile> {
    const normalizedProfile = normalizeWebDavProfile(profile);
    const previous = await syncStore.load();
    const profileChanged = previous.profile
      ? createProfileKey(previous.profile) !== createProfileKey(normalizedProfile)
      : false;

    if (profileChanged) {
      await syncStore.save({
        profile: normalizedProfile,
        baseRevision: null,
        baseFingerprint: null,
        baseVault: null,
        localRevision: null,
        localFingerprint: null,
        localUpdatedAt: null,
        remoteRevision: null,
        remoteUpdatedAt: null,
        remoteEtag: null,
        lastSyncedAt: null,
        lastPulledAt: null,
        lastPushedAt: null,
        lastStatus: null,
        lastError: null,
        pendingConflict: null
      });
    } else {
      await syncStore.save({ profile: normalizedProfile });
    }
    await refreshAutomaticSync();
    return normalizedProfile;
  }
};

function normalizeWebDavProfile(profile: WebDavProfile): WebDavProfile {
  return {
    id: profile.id.trim() || 'webdav-primary',
    enabled: profile.enabled,
    baseUrl: profile.baseUrl.trim(),
    filePath: profile.filePath.trim(),
    username: profile.username?.trim() || undefined,
    password: profile.password?.trim() || undefined,
    syncIntervalMs: profile.syncIntervalMs
  };
}

function createProfileKey(profile: WebDavProfile): string {
  return JSON.stringify({
    baseUrl: profile.baseUrl,
    filePath: profile.filePath,
    username: profile.username ?? '',
    password: profile.password ?? ''
  });
}
