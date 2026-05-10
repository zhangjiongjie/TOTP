import type { EncryptedVaultBlob } from '../vault/crypto';

export interface WebDavProfile {
  id: string;
  enabled: boolean;
  baseUrl: string;
  filePath: string;
  username?: string;
  password?: string;
  syncIntervalMs?: number;
}

export interface WebDavRemoteEnvelope {
  schemaVersion: 1;
  revision: string;
  updatedAt: string;
  encryptedVault: EncryptedVaultBlob;
}

export interface WebDavRemoteSnapshot {
  revision: string;
  updatedAt: string;
  encryptedVault: EncryptedVaultBlob;
  etag: string | null;
}

export interface WebDavUploadInput {
  revision: string;
  updatedAt: string;
  encryptedVault: EncryptedVaultBlob;
  previousEtag?: string | null;
}

export interface WebDavClient {
  download(profile: WebDavProfile): Promise<WebDavRemoteSnapshot | null>;
  upload(profile: WebDavProfile, payload: WebDavUploadInput): Promise<WebDavRemoteSnapshot>;
}

export function createFetchWebDavClient(
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)
): WebDavClient {
  return {
    async download(profile) {
      const response = await fetchImpl(buildWebDavUrl(profile), {
        method: 'GET',
        headers: buildHeaders(profile)
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`WebDAV download failed with status ${response.status}`);
      }

      const body = (await response.json()) as unknown;
      const envelope = parseRemoteEnvelope(body);

      return {
        revision: envelope.revision,
        updatedAt: envelope.updatedAt,
        encryptedVault: envelope.encryptedVault,
        etag: response.headers.get('etag')
      };
    },
    async upload(profile, payload) {
      const response = await fetchImpl(buildWebDavUrl(profile), {
        method: 'PUT',
        headers: {
          ...buildHeaders(profile),
          'Content-Type': 'application/json',
          ...(payload.previousEtag ? { 'If-Match': payload.previousEtag } : {})
        },
        body: JSON.stringify({
          schemaVersion: 1,
          revision: payload.revision,
          updatedAt: payload.updatedAt,
          encryptedVault: payload.encryptedVault
        } satisfies WebDavRemoteEnvelope)
      });

      if (!response.ok) {
        throw new Error(`WebDAV upload failed with status ${response.status}`);
      }

      return {
        revision: payload.revision,
        updatedAt: payload.updatedAt,
        encryptedVault: payload.encryptedVault,
        etag: response.headers.get('etag')
      };
    }
  };
}

function buildWebDavUrl(profile: WebDavProfile): string {
  const normalizedBaseUrl = profile.baseUrl.endsWith('/')
    ? profile.baseUrl.slice(0, -1)
    : profile.baseUrl;
  const normalizedPath = profile.filePath.startsWith('/') ? profile.filePath : `/${profile.filePath}`;

  return `${normalizedBaseUrl}${normalizedPath}`;
}

function buildHeaders(profile: WebDavProfile): Record<string, string> {
  if (!profile.username || !profile.password) {
    return {};
  }

  const rawCredentials = new TextEncoder().encode(`${profile.username}:${profile.password}`);
  let binary = '';

  for (const byte of rawCredentials) {
    binary += String.fromCharCode(byte);
  }

  return {
    Authorization: `Basic ${btoa(binary)}`
  };
}

function parseRemoteEnvelope(value: unknown): WebDavRemoteEnvelope {
  if (!isRemoteEnvelope(value)) {
    throw new Error('WebDAV payload is invalid');
  }

  return value;
}

function isRemoteEnvelope(value: unknown): value is WebDavRemoteEnvelope {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    value.schemaVersion === 1 &&
    typeof value.revision === 'string' &&
    typeof value.updatedAt === 'string' &&
    typeof value.encryptedVault === 'object' &&
    value.encryptedVault !== null
  );
}
