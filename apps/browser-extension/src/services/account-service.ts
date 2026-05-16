import type { AccountRecord, TotpAlgorithm } from '@totp/core';
import { resolveIconKey } from '@totp/core';
import { generateTotpCode } from '@totp/core';

export interface AccountDraft {
  issuer: string;
  accountName: string;
  secret: string;
  digits: number;
  period: number;
  algorithm: TotpAlgorithm;
  groupId?: string | null;
}

export interface AccountFormValues {
  otpauthUri: string;
  issuer: string;
  accountName: string;
  secret: string;
  digits: string;
  period: string;
  algorithm: TotpAlgorithm;
  groupId: string;
}

export interface AccountGroup {
  id: string;
  label: string;
}

export interface AccountRuntime {
  id: string;
  issuer: string;
  accountName: string;
  iconKey: AccountRecord['iconKey'];
  code: string;
  period: number;
  secondsRemaining: number;
  groupId: string | null;
  groupLabel: string;
}

const DEFAULT_GROUP_ID = 'default';
const SEED_UPDATED_AT = '2026-01-01T00:00:00.000Z';

const accountGroups: AccountGroup[] = [
  { id: 'default', label: 'Default' },
  { id: 'personal', label: 'Personal' },
  { id: 'work', label: 'Work' }
];

const demoSeedAccounts: AccountDraft[] = [
  {
    issuer: 'GitHub',
    accountName: 'alice@company.com',
    secret: 'JBSWY3DPEHPK3PXP',
    digits: 6,
    period: 30,
    algorithm: 'SHA1'
  },
  {
    issuer: 'Google',
    accountName: 'product.team@gmail.com',
    secret: 'GEZDGNBVGY3TQOJQ',
    digits: 6,
    period: 30,
    algorithm: 'SHA1'
  },
  {
    issuer: 'Microsoft',
    accountName: 'contoso.dev@outlook.com',
    secret: 'JBSWY3DPFQQFO33S',
    digits: 6,
    period: 30,
    algorithm: 'SHA1'
  },
  {
    issuer: 'OpenAI',
    accountName: 'workspace-owner',
    secret: 'KRSXG5DSNFXGOIDB',
    digits: 6,
    period: 30,
    algorithm: 'SHA256'
  },
  {
    issuer: 'Slack',
    accountName: 'design-ops',
    secret: 'MZXW6YTBOI======',
    digits: 6,
    period: 30,
    algorithm: 'SHA1'
  }
];

let accounts: AccountRecord[] = [];
const listeners = new Set<() => void>();

export const accountService = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async listAccounts() {
    return accounts.map(cloneAccount);
  },

  async getAccount(accountId: string) {
    const account = accounts.find((item) => item.id === accountId);
    return account ? cloneAccount(account) : null;
  },

  async addAccount(draft: AccountDraft) {
    const account = buildAccountRecord(draft);
    accounts = [account, ...accounts];
    emit();
    return cloneAccount(account);
  },

  async replaceAllAccounts(nextAccounts: AccountRecord[]) {
    accounts = nextAccounts.map(cloneAccount);
    emit();
    return accounts.map(cloneAccount);
  },

  async updateAccount(accountId: string, draft: AccountDraft) {
    const existing = accounts.find((item) => item.id === accountId);
    if (!existing) {
      throw new Error('Account not found.');
    }

    const updated: AccountRecord = {
      ...existing,
      issuer: draft.issuer.trim(),
      accountName: draft.accountName.trim(),
      secret: draft.secret.trim().replace(/\s+/g, '').toUpperCase(),
      digits: draft.digits,
      period: draft.period,
      algorithm: draft.algorithm,
      groupId: normalizeGroupId(draft.groupId),
      iconKey: resolveIconKey({
        issuer: draft.issuer,
        accountName: draft.accountName
      }),
      updatedAt: new Date().toISOString()
    };

    accounts = accounts.map((item) => (item.id === accountId ? updated : item));
    emit();
    return cloneAccount(updated);
  },

  async deleteAccount(accountId: string) {
    const nextAccounts = accounts.filter((item) => item.id !== accountId);
    if (nextAccounts.length === accounts.length) {
      throw new Error('Account not found.');
    }

    accounts = nextAccounts;
    emit();
    return true;
  },

  async moveGroup(accountId: string, groupId: string) {
    const existing = accounts.find((item) => item.id === accountId);
    if (!existing) {
      throw new Error('Account not found.');
    }

    const targetGroup = accountGroups.find((group) => group.id === groupId);
    if (!targetGroup) {
      throw new Error('Target group not found.');
    }

    const updated: AccountRecord = {
      ...existing,
      groupId,
      updatedAt: new Date().toISOString()
    };

    accounts = accounts.map((item) => (item.id === accountId ? updated : item));
    emit();
    return cloneAccount(updated);
  },

  getGroups() {
    return accountGroups.map((group) => ({ ...group }));
  },

  getGroupLabel(groupId: string | null) {
    return accountGroups.find((group) => group.id === groupId)?.label ?? 'Ungrouped';
  },

  async createRuntime(account: AccountRecord, now = Date.now()): Promise<AccountRuntime> {
    const period = account.period || 30;
    const elapsedSeconds = Math.floor(now / 1000);
    const cyclePosition = elapsedSeconds % period;
    const secondsRemaining = cyclePosition === 0 ? period : period - cyclePosition;
    const code = await generateTotpCode({
      secret: account.secret,
      digits: account.digits,
      period,
      algorithm: account.algorithm,
      timestamp: now
    });
    const resolvedIconKey = resolveIconKey({
      issuer: account.issuer,
      accountName: account.accountName
    });

    return {
      id: account.id,
      issuer: account.issuer,
      accountName: account.accountName,
      iconKey: resolvedIconKey !== 'default' ? resolvedIconKey : account.iconKey ?? resolvedIconKey,
      code: formatTotpCode(code),
      period,
      secondsRemaining,
      groupId: account.groupId,
      groupLabel: this.getGroupLabel(account.groupId)
    };
  },

  toFormValues(account: AccountRecord): AccountFormValues {
    return {
      otpauthUri: '',
      issuer: account.issuer,
      accountName: account.accountName,
      secret: account.secret,
      digits: String(account.digits),
      period: String(account.period),
      algorithm: account.algorithm,
      groupId: account.groupId ?? DEFAULT_GROUP_ID
    };
  },

  __resetForTests() {
    accounts = [];
    emit();
  },

  __seedDemoForTests() {
    accounts = createSeedAccounts();
    emit();
  }
};

function createSeedAccounts() {
  return demoSeedAccounts.map((draft, index) =>
    buildAccountRecord(draft, `demo-${index + 1}`, SEED_UPDATED_AT)
  );
}

function emit() {
  listeners.forEach((listener) => listener());
}

function buildAccountRecord(
  draft: AccountDraft,
  fixedId?: string,
  fixedUpdatedAt?: string
): AccountRecord {
  const normalizedIssuer = draft.issuer.trim();
  const normalizedAccountName = draft.accountName.trim();
  const now = fixedUpdatedAt ?? new Date().toISOString();

  return {
    id: fixedId ?? `account-${crypto.randomUUID()}`,
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
    updatedAt: now
  };
}

export function getSeedVaultPayload() {
  return {
    version: 1 as const,
    accounts: createSeedAccounts()
  };
}

function cloneAccount(account: AccountRecord): AccountRecord {
  return {
    ...account,
    tags: [...account.tags]
  };
}

function formatTotpCode(rawCode: string): string {
  if (rawCode.length === 6) {
    return `${rawCode.slice(0, 3)} ${rawCode.slice(3)}`;
  }

  if (rawCode.length === 8) {
    return `${rawCode.slice(0, 4)} ${rawCode.slice(4)}`;
  }

  if (rawCode.length > 4 && rawCode.length % 2 === 0) {
    const middle = rawCode.length / 2;
    return `${rawCode.slice(0, middle)} ${rawCode.slice(middle)}`;
  }

  return rawCode;
}

export function getDefaultAccountFormValues(): AccountFormValues {
  return {
    otpauthUri: '',
    issuer: '',
    accountName: '',
    secret: '',
    digits: '6',
    period: '30',
    algorithm: 'SHA1',
    groupId: DEFAULT_GROUP_ID
  };
}

function normalizeGroupId(groupId: string | null | undefined): string {
  return typeof groupId === 'string' && accountGroups.some((group) => group.id === groupId)
    ? groupId
    : DEFAULT_GROUP_ID;
}
