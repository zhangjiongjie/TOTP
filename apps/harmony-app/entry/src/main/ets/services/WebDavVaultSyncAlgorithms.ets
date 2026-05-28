import { LocalVault } from '../model/LocalVault';
import { TotpAccount } from '../model/TotpAccount';

class AccountMergeResult {
  hasConflict: boolean;
  account: TotpAccount | null;

  constructor(hasConflict: boolean, account: TotpAccount | null) {
    this.hasConflict = hasConflict;
    this.account = account;
  }
}

class StringMergeResult {
  hasConflict: boolean;
  value: string;

  constructor(hasConflict: boolean, value: string) {
    this.hasConflict = hasConflict;
    this.value = value;
  }
}

class NumberMergeResult {
  hasConflict: boolean;
  value: number;

  constructor(hasConflict: boolean, value: number) {
    this.hasConflict = hasConflict;
    this.value = value;
  }
}

export class WebDavVaultSyncAlgorithms {
  static mergeAccountLevelChanges(baseVault: LocalVault, localVault: LocalVault, remoteVault: LocalVault): LocalVault | undefined {
    let mergedAccounts: TotpAccount[] | undefined = WebDavVaultSyncAlgorithms.mergeAccountRecords(
      baseVault.accounts,
      localVault.accounts,
      remoteVault.accounts
    );
    if (mergedAccounts === undefined) {
      return undefined;
    }

    return new LocalVault(
      Math.max(baseVault.schemaVersion, Math.max(localVault.schemaVersion, remoteVault.schemaVersion)),
      WebDavVaultSyncAlgorithms.pickLatestTimestamp(baseVault.updatedAt, localVault.updatedAt, remoteVault.updatedAt),
      mergedAccounts
    );
  }

  static createFingerprint(vault: LocalVault): string {
    let accountPayloads: string[] = [];
    for (let index: number = 0; index < vault.accounts.length; index++) {
      let account: TotpAccount = vault.accounts[index];
      accountPayloads.push(JSON.stringify({
        id: account.id,
        issuer: account.issuer,
        accountName: account.accountName,
        secret: account.secret,
        digits: account.digits,
        period: account.period,
        algorithm: account.algorithm,
        groupName: account.groupName,
        iconKey: account.iconKey
      }));
    }
    accountPayloads.sort();
    return WebDavVaultSyncAlgorithms.hashText(JSON.stringify(accountPayloads));
  }

  static hashText(text: string): string {
    let hash: number = 2166136261;
    for (let index: number = 0; index < text.length; index++) {
      hash = hash ^ text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fp:${(hash >>> 0).toString(16)}:${text.length}`;
  }

  private static mergeAccountRecords(baseAccounts: TotpAccount[], localAccounts: TotpAccount[], remoteAccounts: TotpAccount[]): TotpAccount[] | undefined {
    let baseMap: Map<string, TotpAccount> = WebDavVaultSyncAlgorithms.createAccountMap(baseAccounts);
    let localMap: Map<string, TotpAccount> = WebDavVaultSyncAlgorithms.createAccountMap(localAccounts);
    let remoteMap: Map<string, TotpAccount> = WebDavVaultSyncAlgorithms.createAccountMap(remoteAccounts);
    let accountIds: string[] = WebDavVaultSyncAlgorithms.collectAccountIds(baseAccounts, localAccounts, remoteAccounts);
    let mergedAccounts: TotpAccount[] = [];

    for (let index: number = 0; index < accountIds.length; index++) {
      let accountId: string = accountIds[index];
      let result: AccountMergeResult = WebDavVaultSyncAlgorithms.mergeSingleAccount(
        WebDavVaultSyncAlgorithms.readAccount(baseMap, accountId),
        WebDavVaultSyncAlgorithms.readAccount(localMap, accountId),
        WebDavVaultSyncAlgorithms.readAccount(remoteMap, accountId)
      );

      if (result.hasConflict) {
        return undefined;
      }

      if (result.account !== null) {
        mergedAccounts.push(result.account);
      }
    }

    mergedAccounts.sort((left: TotpAccount, right: TotpAccount) => right.updatedAt.localeCompare(left.updatedAt));
    return mergedAccounts;
  }

  private static mergeSingleAccount(baseAccount: TotpAccount | null, localAccount: TotpAccount | null, remoteAccount: TotpAccount | null): AccountMergeResult {
    if (baseAccount === null) {
      if (localAccount !== null && remoteAccount !== null) {
        if (WebDavVaultSyncAlgorithms.accountsEquivalent(localAccount, remoteAccount)) {
          return new AccountMergeResult(false, WebDavVaultSyncAlgorithms.copyAccount(localAccount));
        }
        return new AccountMergeResult(true, null);
      }
      if (localAccount !== null) {
        return new AccountMergeResult(false, WebDavVaultSyncAlgorithms.copyAccount(localAccount));
      }
      if (remoteAccount !== null) {
        return new AccountMergeResult(false, WebDavVaultSyncAlgorithms.copyAccount(remoteAccount));
      }
      return new AccountMergeResult(false, null);
    }

    if (localAccount === null && remoteAccount === null) {
      return new AccountMergeResult(false, null);
    }

    if (localAccount === null && remoteAccount !== null) {
      return new AccountMergeResult(!WebDavVaultSyncAlgorithms.accountsEquivalent(baseAccount, remoteAccount), null);
    }

    if (localAccount !== null && remoteAccount === null) {
      return new AccountMergeResult(!WebDavVaultSyncAlgorithms.accountsEquivalent(baseAccount, localAccount), null);
    }

    if (localAccount === null || remoteAccount === null) {
      return new AccountMergeResult(false, null);
    }

    if (WebDavVaultSyncAlgorithms.accountsEquivalent(localAccount, remoteAccount)) {
      return new AccountMergeResult(false, WebDavVaultSyncAlgorithms.copyAccount(localAccount));
    }

    let issuer: StringMergeResult = WebDavVaultSyncAlgorithms.mergeStringField(baseAccount.issuer, localAccount.issuer, remoteAccount.issuer);
    let accountName: StringMergeResult = WebDavVaultSyncAlgorithms.mergeStringField(baseAccount.accountName, localAccount.accountName, remoteAccount.accountName);
    let secret: StringMergeResult = WebDavVaultSyncAlgorithms.mergeStringField(baseAccount.secret, localAccount.secret, remoteAccount.secret);
    let digits: NumberMergeResult = WebDavVaultSyncAlgorithms.mergeNumberField(baseAccount.digits, localAccount.digits, remoteAccount.digits);
    let period: NumberMergeResult = WebDavVaultSyncAlgorithms.mergeNumberField(baseAccount.period, localAccount.period, remoteAccount.period);
    let algorithm: StringMergeResult = WebDavVaultSyncAlgorithms.mergeStringField(baseAccount.algorithm, localAccount.algorithm, remoteAccount.algorithm);
    let groupName: StringMergeResult = WebDavVaultSyncAlgorithms.mergeStringField(baseAccount.groupName, localAccount.groupName, remoteAccount.groupName);
    let iconKey: StringMergeResult = WebDavVaultSyncAlgorithms.mergeStringField(baseAccount.iconKey, localAccount.iconKey, remoteAccount.iconKey);

    if (issuer.hasConflict || accountName.hasConflict || secret.hasConflict || digits.hasConflict ||
      period.hasConflict || algorithm.hasConflict || groupName.hasConflict || iconKey.hasConflict) {
      return new AccountMergeResult(true, null);
    }

    return new AccountMergeResult(false, new TotpAccount(
      baseAccount.id,
      issuer.value,
      accountName.value,
      secret.value,
      digits.value,
      period.value,
      algorithm.value,
      groupName.value,
      iconKey.value,
      WebDavVaultSyncAlgorithms.pickLatestTimestamp(baseAccount.updatedAt, localAccount.updatedAt, remoteAccount.updatedAt)
    ));
  }

  private static mergeStringField(baseValue: string, localValue: string, remoteValue: string): StringMergeResult {
    if (localValue === remoteValue) {
      return new StringMergeResult(false, localValue);
    }
    if (localValue === baseValue) {
      return new StringMergeResult(false, remoteValue);
    }
    if (remoteValue === baseValue) {
      return new StringMergeResult(false, localValue);
    }
    return new StringMergeResult(true, '');
  }

  private static mergeNumberField(baseValue: number, localValue: number, remoteValue: number): NumberMergeResult {
    if (localValue === remoteValue) {
      return new NumberMergeResult(false, localValue);
    }
    if (localValue === baseValue) {
      return new NumberMergeResult(false, remoteValue);
    }
    if (remoteValue === baseValue) {
      return new NumberMergeResult(false, localValue);
    }
    return new NumberMergeResult(true, 0);
  }

  private static createAccountMap(accounts: TotpAccount[]): Map<string, TotpAccount> {
    let accountMap: Map<string, TotpAccount> = new Map<string, TotpAccount>();
    for (let index: number = 0; index < accounts.length; index++) {
      accountMap.set(accounts[index].id, accounts[index]);
    }
    return accountMap;
  }

  private static collectAccountIds(baseAccounts: TotpAccount[], localAccounts: TotpAccount[], remoteAccounts: TotpAccount[]): string[] {
    let accountIds: string[] = [];
    WebDavVaultSyncAlgorithms.appendAccountIds(accountIds, baseAccounts);
    WebDavVaultSyncAlgorithms.appendAccountIds(accountIds, localAccounts);
    WebDavVaultSyncAlgorithms.appendAccountIds(accountIds, remoteAccounts);
    return accountIds;
  }

  private static appendAccountIds(accountIds: string[], accounts: TotpAccount[]): void {
    for (let index: number = 0; index < accounts.length; index++) {
      if (accountIds.indexOf(accounts[index].id) < 0) {
        accountIds.push(accounts[index].id);
      }
    }
  }

  private static readAccount(accountMap: Map<string, TotpAccount>, accountId: string): TotpAccount | null {
    let account: TotpAccount | undefined = accountMap.get(accountId);
    return account === undefined ? null : account;
  }

  private static accountsEquivalent(left: TotpAccount, right: TotpAccount): boolean {
    return left.id === right.id &&
      left.issuer === right.issuer &&
      left.accountName === right.accountName &&
      left.secret === right.secret &&
      left.digits === right.digits &&
      left.period === right.period &&
      left.algorithm === right.algorithm &&
      left.groupName === right.groupName &&
      left.iconKey === right.iconKey;
  }

  private static copyAccount(account: TotpAccount): TotpAccount {
    return new TotpAccount(
      account.id,
      account.issuer,
      account.accountName,
      account.secret,
      account.digits,
      account.period,
      account.algorithm,
      account.groupName,
      account.iconKey,
      account.updatedAt
    );
  }

  private static pickLatestTimestamp(first: string, second: string, third: string): string {
    let latest: string = first;
    if (second > latest) {
      latest = second;
    }
    if (third > latest) {
      latest = third;
    }
    return latest;
  }
}
