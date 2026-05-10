import type { AccountRecord, TotpAlgorithm } from '../core/types';
import { resolveIconKey } from '../core/icons/icon-matchers';

export interface AccountDraft {
  issuer: string;
  accountName: string;
  secret: string;
  digits: number;
  period: number;
  algorithm: TotpAlgorithm;
}

export interface AccountFormValues {
  issuer: string;
  accountName: string;
  secret: string;
  digits: string;
  period: string;
  algorithm: TotpAlgorithm;
}

export interface AccountRuntime {
  id: string;
  issuer: string;
  accountName: string;
  code: string;
  period: number;
  secondsRemaining: number;
}

const DEFAULT_GROUP_ID = 'default';
const DEFAULT_SECONDS_REMAINING = 24;

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

let accounts = demoSeedAccounts.map((draft, index) =>
  buildAccountRecord(draft, `demo-${index + 1}`)
);

const listeners = new Set<() => void>();

export const accountService = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  listAccounts() {
    return accounts.map(cloneAccount);
  },

  getAccount(accountId: string) {
    const account = accounts.find((item) => item.id === accountId);
    return account ? cloneAccount(account) : null;
  },

  addAccount(draft: AccountDraft) {
    const account = buildAccountRecord(draft);
    accounts = [account, ...accounts];
    emit();
    return cloneAccount(account);
  },

  updateAccount(accountId: string, draft: AccountDraft) {
    const existing = accounts.find((item) => item.id === accountId);
    if (!existing) {
      return null;
    }

    const updated: AccountRecord = {
      ...existing,
      issuer: draft.issuer.trim(),
      accountName: draft.accountName.trim(),
      secret: draft.secret.trim().replace(/\s+/g, '').toUpperCase(),
      digits: draft.digits,
      period: draft.period,
      algorithm: draft.algorithm,
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

  deleteAccount(accountId: string) {
    const nextAccounts = accounts.filter((item) => item.id !== accountId);
    if (nextAccounts.length === accounts.length) {
      return false;
    }

    accounts = nextAccounts;
    emit();
    return true;
  },

  createRuntime(account: AccountRecord, now = Date.now()): AccountRuntime {
    const period = account.period || 30;
    const elapsedSeconds = Math.floor(now / 1000);
    const secondsRemaining = period - (elapsedSeconds % period || period);
    const code = createDemoCode(account, Math.floor(now / (period * 1000)));

    return {
      id: account.id,
      issuer: account.issuer,
      accountName: account.accountName,
      code,
      period,
      secondsRemaining: secondsRemaining <= 0 ? period : secondsRemaining
    };
  },

  toFormValues(account: AccountRecord): AccountFormValues {
    return {
      issuer: account.issuer,
      accountName: account.accountName,
      secret: account.secret,
      digits: String(account.digits),
      period: String(account.period),
      algorithm: account.algorithm
    };
  }
};

function emit() {
  listeners.forEach((listener) => listener());
}

function buildAccountRecord(draft: AccountDraft, fixedId?: string): AccountRecord {
  const normalizedIssuer = draft.issuer.trim();
  const normalizedAccountName = draft.accountName.trim();
  const now = new Date().toISOString();

  return {
    id: fixedId ?? `account-${crypto.randomUUID()}`,
    issuer: normalizedIssuer,
    accountName: normalizedAccountName,
    secret: draft.secret.trim().replace(/\s+/g, '').toUpperCase(),
    digits: draft.digits,
    period: draft.period,
    algorithm: draft.algorithm,
    tags: [],
    groupId: DEFAULT_GROUP_ID,
    pinned: false,
    iconKey: resolveIconKey({
      issuer: normalizedIssuer,
      accountName: normalizedAccountName
    }),
    updatedAt: now
  };
}

function cloneAccount(account: AccountRecord): AccountRecord {
  return {
    ...account,
    tags: [...account.tags]
  };
}

function createDemoCode(account: AccountRecord, timeSlice: number): string {
  const source = `${account.id}:${account.secret}:${timeSlice}`;
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) % 1_000_000;
  }

  const raw = String(Math.abs(hash)).padStart(account.digits, '0').slice(0, account.digits);
  return raw.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

export function getDefaultAccountFormValues(): AccountFormValues {
  return {
    issuer: '',
    accountName: '',
    secret: '',
    digits: '6',
    period: '30',
    algorithm: 'SHA1'
  };
}

export function isAccountDraftValid(draft: AccountDraft) {
  return draft.issuer.length > 0 && draft.accountName.length > 0 && draft.secret.length > 0;
}

export function getDefaultSecondsRemaining() {
  return DEFAULT_SECONDS_REMAINING;
}
