# Android Keystore Local Wrapper Design

## Goal

Add Android-only, device-bound protection around the locally persisted vault file without changing the cross-platform vault envelope used by WebDAV sync and encrypted backups.

This is a local at-rest hardening layer. It must not become part of the portable vault format.

## Non-Goals

- Do not change `EncryptedVaultEnvelope` semantics for WebDAV or backups.
- Do not require Android Keystore to unlock a synced vault on another device.
- Do not make the Android vault unrecoverable when Keystore material is lost, as long as the user still has the master password and the stored portable envelope.

## Current State

`VaultCipher` encrypts the vault key with a key derived from the master password, then encrypts vault JSON with the vault key. `VaultRepository` stores the encoded `EncryptedVaultEnvelope` directly in SharedPreferences under `KEY_ENCRYPTED_VAULT`.

`AndroidKeystoreWrappingKeyProvider` exists, but no repository path uses it.

## Proposed Storage Shape

Keep the existing portable envelope unchanged:

```text
EncryptedVaultEnvelope
  kdf + password-wrapped vault key
  vaultEncryption
```

Wrap only the serialized local envelope before writing it to Android storage:

```text
LocalKeystoreWrappedVault
  formatVersion = 1
  wrapping = "android-keystore-aes-gcm"
  keyAlias = "totp_local_vault_wrapping_key_v2"
  payload = AES-GCM(keystoreKey, VaultEnvelopeJson.encodeEnvelope(envelope))
```

The remote WebDAV envelope and backup export continue to use `EncryptedVaultEnvelope` directly.

## Read Path and Migration

1. Read the stored string.
2. If it decodes as `LocalKeystoreWrappedVault`, unwrap with Android Keystore and then decode the inner `EncryptedVaultEnvelope`.
3. If it decodes as the existing `EncryptedVaultEnvelope`, treat it as a legacy local vault.
4. After successful unlock or save, rewrite local storage as `LocalKeystoreWrappedVault`.

This gives existing installs a lazy migration with no explicit upgrade prompt.

## Failure Behavior

If Keystore unwrap fails but the stored value is wrapped, show a recoverable local storage error and guide the user to restore from WebDAV or backup. Do not silently discard the vault.

If the stored value is legacy, the master password path still works and migration can proceed.

## Repository Boundary

Add a small storage codec below `VaultRepository`:

```text
VaultRepository
  -> LocalVaultEnvelopeStore
       readEnvelope(): EncryptedVaultEnvelope
       writeEnvelope(envelope: EncryptedVaultEnvelope)
       exportPortableEnvelope(): EncryptedVaultEnvelope
```

`exportPortableEnvelope()` must return the inner portable envelope, never the Keystore-wrapped local payload.

## Sync and Backup Safety

- WebDAV pull paths may replace the local envelope with a remote portable envelope, but storage writes wrap it locally before persistence.
- WebDAV push and backup export receive the portable envelope only.
- Multi-device sync remains master-password based and is not tied to Android Keystore.

## Test Plan

- Legacy stored envelope can be read and then rewritten as wrapped storage.
- Wrapped storage can be read back with the same fake wrapping key.
- `exportEncryptedEnvelope()` returns the portable inner envelope.
- WebDAV code never serializes `LocalKeystoreWrappedVault`.
- Keystore unwrap failure reports an explicit recoverable error.
