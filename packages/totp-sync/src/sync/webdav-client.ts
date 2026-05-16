import {
  isEncryptedVaultBlob,
  type EncryptedVaultBlob
} from '@totp/core';

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

export type WebDavOperationKind = 'download' | 'upload' | 'validation';

export class WebDavClientError extends Error {
  readonly kind: WebDavOperationKind;
  readonly statusCode: number | null;
  readonly retryable: boolean;

  constructor(
    kind: WebDavOperationKind,
    message: string,
    options: { cause?: unknown; statusCode?: number | null; retryable?: boolean } = {}
  ) {
    super(message);
    this.name = 'WebDavClientError';
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
    this.kind = kind;
    this.statusCode = options.statusCode ?? null;
    this.retryable =
      options.retryable ??
      (kind === 'validation'
        ? false
        : this.statusCode == null || this.statusCode === 412 || this.statusCode >= 500);
  }
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
      let response: Response;

      try {
        response = await fetchImpl(buildWebDavUrl(profile), {
          method: 'GET',
          cache: 'no-store',
          headers: buildHeaders(profile, {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache'
          })
        });
      } catch (error) {
        throw new WebDavClientError('download', 'WebDAV download failed', { cause: error });
      }

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new WebDavClientError('download', `WebDAV download failed with status ${response.status}`, {
          statusCode: response.status
        });
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
      let response: Response;

      try {
        response = await fetchImpl(buildWebDavUrl(profile), {
          method: 'PUT',
          cache: 'no-store',
          headers: {
            ...buildHeaders(profile, {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              Pragma: 'no-cache'
            }),
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
      } catch (error) {
        throw new WebDavClientError('upload', 'WebDAV upload failed', { cause: error });
      }

      if (!response.ok) {
        throw new WebDavClientError('upload', `WebDAV upload failed with status ${response.status}`, {
          statusCode: response.status
        });
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

function buildHeaders(
  profile: WebDavProfile,
  extraHeaders: Record<string, string> = {}
): Record<string, string> {
  if (!profile.username || !profile.password) {
    return extraHeaders;
  }

  const rawCredentials = new TextEncoder().encode(`${profile.username}:${profile.password}`);
  let binary = '';

  for (const byte of rawCredentials) {
    binary += String.fromCharCode(byte);
  }

  return {
    ...extraHeaders,
    Authorization: `Basic ${btoa(binary)}`
  };
}

function parseRemoteEnvelope(value: unknown): WebDavRemoteEnvelope {
  if (!isRemoteEnvelope(value)) {
    throw new WebDavClientError('validation', 'WebDAV payload is invalid');
  }

  return value;
}

function isRemoteEnvelope(value: unknown): value is WebDavRemoteEnvelope {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.schemaVersion === 1 &&
    typeof record.revision === 'string' &&
    typeof record.updatedAt === 'string' &&
    isEncryptedVaultBlob(record.encryptedVault)
  );
}
