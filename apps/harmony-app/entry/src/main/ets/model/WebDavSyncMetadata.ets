export interface WebDavSyncMetadataRecord {
  syncProfileKey: string;
  baseFingerprint: string;
  baseVaultJson: string;
  remoteRevision: string;
  remoteEtag: string;
  lastSyncedAt: string;
  lastStatus: string;
  lastError: string;
}

export class WebDavSyncMetadata {
  syncProfileKey: string;
  baseFingerprint: string;
  baseVaultJson: string;
  remoteRevision: string;
  remoteEtag: string;
  lastSyncedAt: string;
  lastStatus: string;
  lastError: string;

  constructor(
    syncProfileKey: string,
    baseFingerprint: string,
    baseVaultJson: string,
    remoteRevision: string,
    remoteEtag: string,
    lastSyncedAt: string,
    lastStatus: string,
    lastError: string
  ) {
    this.syncProfileKey = syncProfileKey;
    this.baseFingerprint = baseFingerprint;
    this.baseVaultJson = baseVaultJson;
    this.remoteRevision = remoteRevision;
    this.remoteEtag = remoteEtag;
    this.lastSyncedAt = lastSyncedAt;
    this.lastStatus = lastStatus;
    this.lastError = lastError;
  }

  toRecord(): WebDavSyncMetadataRecord {
    return {
      syncProfileKey: this.syncProfileKey,
      baseFingerprint: this.baseFingerprint,
      baseVaultJson: this.baseVaultJson,
      remoteRevision: this.remoteRevision,
      remoteEtag: this.remoteEtag,
      lastSyncedAt: this.lastSyncedAt,
      lastStatus: this.lastStatus,
      lastError: this.lastError
    };
  }
}

export function createDefaultWebDavSyncMetadata(): WebDavSyncMetadata {
  return new WebDavSyncMetadata('', '', '', '', '', '', 'idle', '');
}

export function createWebDavSyncMetadataFromJson(payload: string): WebDavSyncMetadata {
  if (payload.length === 0) {
    return createDefaultWebDavSyncMetadata();
  }

  let record: Record<string, Object> = JSON.parse(payload) as Record<string, Object>;
  return new WebDavSyncMetadata(
    readString(record, 'syncProfileKey', ''),
    readString(record, 'baseFingerprint', ''),
    readString(record, 'baseVaultJson', ''),
    readString(record, 'remoteRevision', ''),
    readString(record, 'remoteEtag', ''),
    readString(record, 'lastSyncedAt', ''),
    readString(record, 'lastStatus', 'idle'),
    readString(record, 'lastError', '')
  );
}

function readString(record: Record<string, Object>, key: string, fallback: string): string {
  let value: Object | undefined = record[key];
  return typeof value === 'string' ? value : fallback;
}
