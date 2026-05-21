import { resolveIconKey, type AccountRecord } from '@totp/core';
import { demoSeedDrafts } from '@totp/test-fixtures';
import type { AccountDraft, AccountGroup } from './account-service';

const SEED_UPDATED_AT = '2026-01-01T00:00:00.000Z';
const DEFAULT_GROUP_ID = 'default';

const accountGroups: AccountGroup[] = [
  { id: 'default', label: 'Default' },
  { id: 'personal', label: 'Personal' },
  { id: 'work', label: 'Work' }
];

export function createSeedAccounts(): AccountRecord[] {
  return demoSeedDrafts.map((draft, index) =>
    buildSeedAccountRecord(draft, `demo-${index + 1}`, SEED_UPDATED_AT)
  );
}

export function getSeedVaultPayload() {
  return {
    version: 1 as const,
    accounts: createSeedAccounts()
  };
}

function buildSeedAccountRecord(
  draft: Pick<AccountDraft, 'issuer' | 'accountName' | 'secret' | 'digits' | 'period' | 'algorithm'> & { groupId?: string | null },
  fixedId: string,
  fixedUpdatedAt: string
): AccountRecord {
  const normalizedIssuer = draft.issuer.trim();
  const normalizedAccountName = draft.accountName.trim();

  return {
    id: fixedId,
    issuer: normalizedIssuer,
    accountName: normalizedAccountName,
    secret: draft.secret.trim().replace(/\s+/g, '').toUpperCase(),
    digits: draft.digits,
    period: draft.period,
    algorithm: draft.algorithm,
    tags: [],
    groupId: normalizeGroupId(draft.groupId),
    pinned: false,
    iconKey: resolveIconKey({
      issuer: normalizedIssuer,
      accountName: normalizedAccountName
    }),
    updatedAt: fixedUpdatedAt
  };
}

function normalizeGroupId(groupId: string | null | undefined): string {
  return typeof groupId === 'string' && accountGroups.some((group) => group.id === groupId)
    ? groupId
    : DEFAULT_GROUP_ID;
}
