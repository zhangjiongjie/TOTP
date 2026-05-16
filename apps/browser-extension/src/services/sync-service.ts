import { getSessionState } from '../state/session-store';
import { decryptVault, encryptVault, type EncryptedVaultBlob, type VaultPayload } from '@totp/core';
import type { PendingConflictSnapshot, SyncInspectionSnapshot } from '@totp/sync';
import { getCurrentMasterPassword } from '../state/master-password-store';
import {
  createSyncEngine,
  type CreateSyncEngineOptions,
  type PendingSyncConflict,
  type SyncOnOpenResult,
  type SyncRunResult
} from '@totp/sync';
import type { SyncMetadataSnapshot } from '@totp/sync';

export interface SyncScheduler {
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

export interface SyncService {
  syncOnOpen(): Promise<SyncOnOpenResult>;
  manualSync(): Promise<SyncRunResult>;
  resolveConflict(payload: PendingSyncConflict, choice: 'local' | 'remote'): Promise<SyncRunResult>;
  scheduleSync(intervalMs: number): SyncScheduler;
}

export function createSyncService(options: CreateSyncEngineOptions): SyncService {
  const emptyVaultFingerprintPromise = hashString(
    JSON.stringify(normalizeVaultForFingerprint({ version: 1, accounts: [] }))
  );
  const engine = createSyncEngine({
    ...options,
    fingerprintVault: createRuntimeVaultFingerprint,
    mergeConflict: ({ metadata, local, remote }) => mergeAccountLevelConflict(metadata, local, remote),
    preferRemoteOnFirstSync: ({ local, remote, metadata }) =>
      shouldPreferRemoteOnFirstSync(local, remote, metadata, emptyVaultFingerprintPromise)
  });

  return {
    async syncOnOpen() {
      if (!getSessionState().isUnlocked) {
        const initial: SyncRunResult = {
          status: 'noop',
          source: 'none',
          localRevision: null,
          remoteRevision: null,
          localVault: null,
          pendingConflict: null
        };

        return {
          initial,
          background: Promise.resolve(initial)
        };
      }

      return engine.syncOnOpen();
    },
    async manualSync() {
      return engine.syncNow();
    },
    async resolveConflict(payload, choice) {
      return engine.resolveConflict(payload, choice);
    },
    scheduleSync(intervalMs) {
      let timerId: ReturnType<typeof globalThis.setInterval> | null = null;

      return {
        start() {
          if (timerId !== null) {
            return;
          }

          timerId = globalThis.setInterval(() => {
            void engine.syncNow().catch(() => undefined);
          }, intervalMs);
        },
        stop() {
          if (timerId === null) {
            return;
          }

          globalThis.clearInterval(timerId);
          timerId = null;
        },
        isRunning() {
          return timerId !== null;
        }
      };
    }
  };
}

async function createRuntimeVaultFingerprint(
  encryptedVault: EncryptedVaultBlob
): Promise<string> {
  const masterPassword = getCurrentMasterPassword();

  if (!masterPassword) {
    return createBlobFingerprint(encryptedVault);
  }

  try {
    const decryptedVault = await decryptVault(encryptedVault, masterPassword);
    return hashString(JSON.stringify(normalizeVaultForFingerprint(decryptedVault)));
  } catch {
    return createBlobFingerprint(encryptedVault);
  }
}

async function createBlobFingerprint(encryptedVault: EncryptedVaultBlob) {
  return hashString(JSON.stringify(encryptedVault));
}

async function hashString(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeVaultForFingerprint(vault: {
  version: number;
  accounts: Array<{
    id: string;
    issuer: string;
    accountName: string;
    secret: string;
    digits: number;
    period: number;
    algorithm: string;
    tags: string[];
    groupId: string | null;
    pinned: boolean;
    iconKey: string | null;
    updatedAt: string;
  }>;
}) {
  return {
    version: vault.version,
    accounts: vault.accounts.map((account) => ({
      id: account.id,
      issuer: account.issuer,
      accountName: account.accountName,
      secret: account.secret,
      digits: account.digits,
      period: account.period,
      algorithm: account.algorithm,
      tags: [...account.tags],
      groupId: account.groupId,
      pinned: account.pinned,
      iconKey: account.iconKey
    }))
  };
}

async function mergeAccountLevelConflict(
  metadata: SyncMetadataSnapshot,
  local: PendingConflictSnapshot,
  remote: PendingConflictSnapshot
) {
  const masterPassword = getCurrentMasterPassword();

  if (!masterPassword || !metadata.baseVault) {
    return null;
  }

  try {
    const [baseVault, localVault, remoteVault] = await Promise.all([
      decryptVault(metadata.baseVault, masterPassword),
      decryptVault(local.encryptedVault, masterPassword),
      decryptVault(remote.encryptedVault, masterPassword)
    ]);
    const mergedAccounts = mergeAccountRecords(
      baseVault.accounts,
      localVault.accounts,
      remoteVault.accounts
    );

    if (!mergedAccounts) {
      return null;
    }

    return encryptVault(
      {
        version: Math.max(baseVault.version, localVault.version, remoteVault.version),
        accounts: mergedAccounts
      },
      masterPassword
    );
  } catch {
    return null;
  }
}

async function shouldPreferRemoteOnFirstSync(
  local: SyncInspectionSnapshot,
  remote: SyncInspectionSnapshot,
  metadata: SyncMetadataSnapshot,
  emptyVaultFingerprintPromise: Promise<string>
) {
  if (metadata.baseFingerprint || metadata.baseRevision) {
    return false;
  }

  if (local.fingerprint === remote.fingerprint) {
    return false;
  }

  const emptyVaultFingerprint = await emptyVaultFingerprintPromise;
  return local.fingerprint === emptyVaultFingerprint;
}

function mergeAccountRecords(
  baseAccounts: VaultPayload['accounts'],
  localAccounts: VaultPayload['accounts'],
  remoteAccounts: VaultPayload['accounts']
) {
  const baseMap = new Map(baseAccounts.map((account) => [account.id, account]));
  const localMap = new Map(localAccounts.map((account) => [account.id, account]));
  const remoteMap = new Map(remoteAccounts.map((account) => [account.id, account]));
  const mergedAccounts: VaultPayload['accounts'] = [];
  const accountIds = new Set([
    ...baseMap.keys(),
    ...localMap.keys(),
    ...remoteMap.keys()
  ]);

  for (const accountId of accountIds) {
    const merged = mergeSingleAccount(
      baseMap.get(accountId) ?? null,
      localMap.get(accountId) ?? null,
      remoteMap.get(accountId) ?? null
    );

    if (merged === undefined) {
      return null;
    }

    if (merged) {
      mergedAccounts.push(merged);
    }
  }

  return mergedAccounts.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function mergeSingleAccount(
  baseAccount: VaultPayload['accounts'][number] | null,
  localAccount: VaultPayload['accounts'][number] | null,
  remoteAccount: VaultPayload['accounts'][number] | null
) {
  if (!baseAccount) {
    if (localAccount && remoteAccount) {
      return accountsEquivalent(localAccount, remoteAccount) ? cloneAccountRecord(localAccount) : undefined;
    }

    return localAccount ? cloneAccountRecord(localAccount) : remoteAccount ? cloneAccountRecord(remoteAccount) : null;
  }

  if (!localAccount && !remoteAccount) {
    return null;
  }

  if (!localAccount && remoteAccount) {
    return accountsEquivalent(baseAccount, remoteAccount) ? null : undefined;
  }

  if (localAccount && !remoteAccount) {
    return accountsEquivalent(baseAccount, localAccount) ? null : undefined;
  }

  if (!localAccount || !remoteAccount) {
    return null;
  }

  if (accountsEquivalent(localAccount, remoteAccount)) {
    return cloneAccountRecord(localAccount);
  }

  const merged = { ...baseAccount, tags: [...baseAccount.tags] };
  const fieldMergers = [
    'issuer',
    'accountName',
    'secret',
    'digits',
    'period',
    'algorithm',
    'groupId',
    'pinned',
    'iconKey'
  ] as const;

  for (const field of fieldMergers) {
    const localValue = localAccount[field];
    const remoteValue = remoteAccount[field];
    const baseValue = baseAccount[field];

    if (valuesEqual(localValue, remoteValue)) {
      merged[field] = localValue as never;
      continue;
    }

    if (valuesEqual(localValue, baseValue)) {
      merged[field] = remoteValue as never;
      continue;
    }

    if (valuesEqual(remoteValue, baseValue)) {
      merged[field] = localValue as never;
      continue;
    }

    return undefined;
  }

  const mergedTags = mergeField(baseAccount.tags, localAccount.tags, remoteAccount.tags);
  if (mergedTags === null) {
    return undefined;
  }

  merged.tags = [...mergedTags];
  const sortedUpdatedAts = [baseAccount.updatedAt, localAccount.updatedAt, remoteAccount.updatedAt].sort();
  merged.updatedAt = sortedUpdatedAts[sortedUpdatedAts.length - 1] ?? baseAccount.updatedAt;

  return merged;
}

function mergeField<T>(baseValue: T, localValue: T, remoteValue: T) {
  if (valuesEqual(localValue, remoteValue)) {
    return localValue;
  }

  if (valuesEqual(localValue, baseValue)) {
    return remoteValue;
  }

  if (valuesEqual(remoteValue, baseValue)) {
    return localValue;
  }

  return null;
}

function accountsEquivalent(
  left: VaultPayload['accounts'][number],
  right: VaultPayload['accounts'][number]
) {
  return (
    left.id === right.id &&
    left.issuer === right.issuer &&
    left.accountName === right.accountName &&
    left.secret === right.secret &&
    left.digits === right.digits &&
    left.period === right.period &&
    left.algorithm === right.algorithm &&
    left.groupId === right.groupId &&
    left.pinned === right.pinned &&
    left.iconKey === right.iconKey &&
    valuesEqual(left.tags, right.tags)
  );
}

function valuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function cloneAccountRecord(account: VaultPayload['accounts'][number]) {
  return {
    ...account,
    tags: [...account.tags]
  };
}
