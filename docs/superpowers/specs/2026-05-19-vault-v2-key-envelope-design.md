# Vault v2 Key Envelope Design

## Goal

Upgrade the browser extension, Harmony app, Android app, WebDAV sync, and encrypted import/export to one shared vault encryption format based on a long-lived random `vaultKey`.

The apps will not read legacy v1 vaults directly after this migration. A repo tool will convert old encrypted exports into the new v2 export format so users can import once and continue syncing with the new clients.

## Core Model

Vault v2 separates password-derived wrapping from data encryption:

```text
masterPassword + kdf salt/params
  -> wrappingKey
  -> decrypt encryptedVaultKey
  -> vaultKey
  -> decrypt encryptedVault accounts payload
```

`vaultKey` is generated with a cryptographically secure random source when a vault is first created. It is 256-bit, belongs to a single vault, and normally remains stable for the lifetime of that vault. Account edits, WebDAV sync, import/export, and normal saves reuse the same `vaultKey`.

`wrappingKey` is derived from the master password with the envelope KDF metadata. It is temporary and only used to wrap or unwrap `vaultKey`. Clients must not persist `wrappingKey`.

## Unified Envelope

Local storage, WebDAV `encryptedVault`, and encrypted import/export all use the same v2 encrypted vault envelope. WebDAV may wrap it in sync metadata such as `revision` and `updatedAt`, but the inner encrypted vault blob is identical.

```json
{
  "formatVersion": 2,
  "vaultId": "...uuid...",
  "kdf": {
    "name": "PBKDF2",
    "iterations": 310000,
    "hash": "SHA-256",
    "salt": "base64"
  },
  "keyEncryption": {
    "cipher": "AES-GCM",
    "iv": "base64",
    "ciphertext": "base64"
  },
  "vaultEncryption": {
    "cipher": "AES-GCM",
    "iv": "base64",
    "ciphertext": "base64"
  }
}
```

The encrypted vault payload remains the existing normalized vault JSON:

```json
{
  "version": 1,
  "accounts": []
}
```

## Creation and Saving

Creating a vault:

1. Generate `vaultId`.
2. Generate random 32-byte `vaultKey`.
3. Generate KDF salt.
4. Derive `wrappingKey` from master password and KDF metadata.
5. Encrypt `vaultKey` with `wrappingKey` into `keyEncryption`.
6. Encrypt the vault payload with `vaultKey` into `vaultEncryption`.

Saving account changes reuses the existing `vaultKey` and only rewrites `vaultEncryption` with a fresh IV. `keyEncryption` stays unchanged unless the master password or KDF metadata changes.

## WebDAV Rules

When enabling WebDAV:

- If remote vault is missing, upload the local v2 envelope.
- If remote vault exists, decrypt remote `encryptedVaultKey` first.
- If remote decrypt succeeds, remote `vaultId` and `vaultKey` become authoritative. Local accounts are merged into the remote vault, then local storage and remote are both saved with the remote key.
- If remote decrypt fails, sync enters `BlockedRemotePassword`. The client must not upload local data.

When already bound to WebDAV:

- Deleting the final account is a valid user change and may upload an empty vault if local sync metadata proves the client belongs to the same remote `vaultId`.
- Empty local data must not overwrite an existing remote vault before the remote has been decrypted or verified.
- If another client changes the master password, clients with the old password enter `BlockedRemotePassword` and ask the user to verify the remote password.

## Master Password Changes

Settings must include a "change master password" action.

For local-only vaults:

1. Verify current master password by unwrapping `vaultKey`.
2. Derive a new `wrappingKey` from the new password and a fresh KDF salt.
3. Re-encrypt the same `vaultKey`.
4. Save the local envelope.

For WebDAV-enabled vaults:

1. Confirm the remote vault is currently decryptable, or block with remote password verification.
2. Rewrap the same `vaultKey` locally with the new password.
3. Upload the updated envelope immediately.

The account payload does not need to be re-encrypted for password-only changes, but the implementation may rewrite it with a fresh IV as part of one atomic save.

## Android Key Cache

Android quick unlock caches only `vaultKey` protected by Android Keystore. It must not cache `masterPassword`, `wrappingKey`, or a separate WebDAV remote key.

The cached `vaultKey` must be invalidated when the vault identity changes, for example:

- `vaultId` changes.
- `keyEncryption` fingerprint changes in a way that indicates a different vault.
- User imports or joins a different remote vault.
- User disables or clears the vault.

WebDAV no longer needs a distinct persistent remote key cache because local and remote share `vaultKey`.

## Migration Tool

The apps do not read legacy v1 directly. A command-line tool converts old encrypted exports:

```text
old encrypted export + master password
  -> decrypt v1
  -> create v2 envelope with random vaultKey
  -> write v2 encrypted export
```

If a user already has a v2 WebDAV vault, importing a converted v2 export should merge accounts into the current vault rather than replace the current shared `vaultKey` unless the user explicitly chooses replacement.

## Errors and Safety

Remote password mismatch is a blocking sync state, not an ordinary network failure.

Clients must not:

- Upload local data when remote exists but cannot be decrypted.
- Cache or persist `wrappingKey`.
- Generate a new `vaultKey` for normal account edits.
- Silently replace the remote vault key from a newly initialized local client.

## Testing

Tests must cover:

- v2 encrypt/decrypt round trip.
- Wrong password fails while corrupted payload fails as integrity error.
- Account edits reuse `vaultKey`.
- Password changes rewrap `vaultKey`.
- Remote-existing WebDAV attach adopts remote `vaultKey`.
- Remote password mismatch blocks upload.
- Converted v1 export imports as v2.
