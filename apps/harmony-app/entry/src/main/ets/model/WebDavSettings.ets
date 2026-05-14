export interface WebDavSettingsRecord {
  enabled: boolean;
  serverUrl: string;
  filePath: string;
  username: string;
  password: string;
  syncIntervalMinutes: number;
  updatedAt: string;
}

export const DEFAULT_WEBDAV_FILE_PATH: string = '/totp/vault.json';

export class WebDavSettings {
  enabled: boolean;
  serverUrl: string;
  filePath: string;
  username: string;
  password: string;
  syncIntervalMinutes: number;
  updatedAt: string;

  constructor(
    enabled: boolean,
    serverUrl: string,
    filePath: string,
    username: string,
    password: string,
    syncIntervalMinutes: number,
    updatedAt: string
  ) {
    this.enabled = enabled;
    this.serverUrl = serverUrl;
    this.filePath = filePath;
    this.username = username;
    this.password = password;
    this.syncIntervalMinutes = syncIntervalMinutes;
    this.updatedAt = updatedAt;
  }

  toRecord(): WebDavSettingsRecord {
    return {
      enabled: this.enabled,
      serverUrl: this.serverUrl,
      filePath: this.filePath,
      username: this.username,
      password: this.password,
      syncIntervalMinutes: this.syncIntervalMinutes,
      updatedAt: this.updatedAt
    };
  }
}

export function createDefaultWebDavSettings(): WebDavSettings {
  return new WebDavSettings(false, '', DEFAULT_WEBDAV_FILE_PATH, '', '', 15, '');
}

export function createWebDavSettingsFromJson(payload: string): WebDavSettings {
  let record: Record<string, Object> = JSON.parse(payload) as Record<string, Object>;
  return new WebDavSettings(
    readBoolean(record, 'enabled', false),
    readString(record, 'serverUrl', ''),
    readString(record, 'filePath', DEFAULT_WEBDAV_FILE_PATH),
    readString(record, 'username', ''),
    readString(record, 'password', ''),
    readPositiveNumber(record, 'syncIntervalMinutes', 15),
    readString(record, 'updatedAt', '')
  );
}

function readString(record: Record<string, Object>, key: string, fallback: string): string {
  let value: Object | undefined = record[key];
  if (typeof value === 'string') {
    return value;
  }
  return fallback;
}

function readBoolean(record: Record<string, Object>, key: string, fallback: boolean): boolean {
  let value: Object | undefined = record[key];
  if (typeof value === 'boolean') {
    return value;
  }
  return fallback;
}

function readPositiveNumber(record: Record<string, Object>, key: string, fallback: number): number {
  let value: Object | undefined = record[key];
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  return fallback;
}
