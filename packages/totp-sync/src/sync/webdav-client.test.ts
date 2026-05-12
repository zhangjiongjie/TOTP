import { describe, expect, it, vi } from 'vitest';
import { createFetchWebDavClient, type WebDavProfile } from './webdav-client';

const profile: WebDavProfile = {
  id: 'primary',
  enabled: true,
  baseUrl: 'https://dav.example.com/root',
  filePath: '/vault.json',
  username: 'alice',
  password: 'secret'
};

describe('createFetchWebDavClient', () => {
  it('disables caching for WebDAV downloads', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: 1,
          revision: 'rev-1',
          updatedAt: '2026-05-11T10:00:00.000Z',
          encryptedVault: {
            formatVersion: 1,
            kdf: {
              name: 'PBKDF2',
              iterations: 310000,
              hash: 'SHA-256'
            },
            cipher: 'AES-GCM',
            salt: 'salt',
            iv: 'iv',
            ciphertext: 'ciphertext',
            passwordVerifier: 'verifier'
          }
        }),
        {
          status: 200,
          headers: {
            ETag: '"etag-1"'
          }
        }
      )
    );
    const client = createFetchWebDavClient(fetchImpl as typeof fetch);

    await client.download(profile);

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://dav.example.com/root/vault.json',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: expect.objectContaining({
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache'
        })
      })
    );
  });

  it('disables caching for WebDAV uploads while keeping optimistic concurrency headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: {
          ETag: '"etag-2"'
        }
      })
    );
    const client = createFetchWebDavClient(fetchImpl as typeof fetch);

    await client.upload(profile, {
      revision: 'local:123',
      updatedAt: '2026-05-11T10:05:00.000Z',
      encryptedVault: {
        formatVersion: 1,
        kdf: {
          name: 'PBKDF2',
          iterations: 310000,
          hash: 'SHA-256'
        },
        cipher: 'AES-GCM',
        salt: 'salt',
        iv: 'iv',
        ciphertext: 'ciphertext',
        passwordVerifier: 'verifier'
      },
      previousEtag: '"etag-1"'
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://dav.example.com/root/vault.json',
      expect.objectContaining({
        method: 'PUT',
        cache: 'no-store',
        headers: expect.objectContaining({
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          'If-Match': '"etag-1"'
        })
      })
    );
  });
});
