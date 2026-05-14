import type { AccountRecord } from '../types';

export function sortAccounts(accounts: AccountRecord[]): AccountRecord[] {
  return [...accounts].sort(compareAccounts);
}

export function compareAccounts(a: AccountRecord, b: AccountRecord): number {
  if (a.pinned !== b.pinned) {
    return a.pinned ? -1 : 1;
  }

  const issuerComparison = a.issuer.localeCompare(b.issuer, 'en', {
    sensitivity: 'base'
  });

  if (issuerComparison !== 0) {
    return issuerComparison;
  }

  const accountComparison = a.accountName.localeCompare(b.accountName, 'en', {
    sensitivity: 'base'
  });

  if (accountComparison !== 0) {
    return accountComparison;
  }

  return b.updatedAt.localeCompare(a.updatedAt);
}
