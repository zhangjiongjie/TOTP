import { common } from '@kit.AbilityKit';
import { LocalVault } from '../model/LocalVault';
import { TotpAccount } from '../model/TotpAccount';
import { LocalVaultStore } from '../storage/LocalVaultStore';

export interface AccountDraft {
  issuer: string;
  accountName: string;
  secret: string;
  digits: number;
  period: number;
  algorithm: string;
  groupName: string;
}

export class AccountEditorService {
  private store: LocalVaultStore = new LocalVaultStore();

  create(context: common.UIAbilityContext, draft: AccountDraft): LocalVault {
    let vault: LocalVault = this.store.load(context);
    let now: string = this.createTimestamp();
    let accounts: TotpAccount[] = this.cloneAccounts(vault.accounts);
    accounts.push(this.buildAccount(this.createAccountId(), draft, this.resolveIconKey(draft.issuer, draft.accountName), now));
    return this.store.save(context, new LocalVault(vault.schemaVersion, now, accounts));
  }

  update(context: common.UIAbilityContext, accountId: string, draft: AccountDraft): LocalVault {
    let vault: LocalVault = this.store.load(context);
    let now: string = this.createTimestamp();
    let accounts: TotpAccount[] = this.cloneAccounts(vault.accounts);
    let accountIndex: number = this.findAccountIndex(accounts, accountId);

    if (accountIndex < 0) {
      throw new Error('未找到要更新的账号');
    }

    let current: TotpAccount = accounts[accountIndex];
    accounts[accountIndex] = this.buildAccount(current.id, draft, this.resolveIconKey(draft.issuer, draft.accountName), now);
    return this.store.save(context, new LocalVault(vault.schemaVersion, now, accounts));
  }

  delete(context: common.UIAbilityContext, accountId: string): LocalVault {
    let vault: LocalVault = this.store.load(context);
    let accounts: TotpAccount[] = [];

    for (let index: number = 0; index < vault.accounts.length; index++) {
      let account: TotpAccount = vault.accounts[index];
      if (account.id !== accountId) {
        accounts.push(this.copyAccount(account));
      }
    }

    if (accounts.length === vault.accounts.length) {
      throw new Error('未找到要删除的账号');
    }

    let now: string = this.createTimestamp();
    return this.store.save(context, new LocalVault(vault.schemaVersion, now, accounts));
  }

  private buildAccount(id: string, draft: AccountDraft, iconKey: string, updatedAt: string): TotpAccount {
    return new TotpAccount(
      id,
      this.normalizeText(draft.issuer, ''),
      this.normalizeText(draft.accountName, ''),
      this.normalizeSecret(draft.secret),
      this.normalizeNumber(draft.digits, 6),
      this.normalizeNumber(draft.period, 30),
      this.normalizeAlgorithm(draft.algorithm),
      this.normalizeText(draft.groupName, 'Default'),
      iconKey,
      updatedAt
    );
  }

  private cloneAccounts(accounts: TotpAccount[]): TotpAccount[] {
    let copies: TotpAccount[] = [];
    for (let index: number = 0; index < accounts.length; index++) {
      copies.push(this.copyAccount(accounts[index]));
    }
    return copies;
  }

  private copyAccount(account: TotpAccount): TotpAccount {
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

  private findAccountIndex(accounts: TotpAccount[], accountId: string): number {
    for (let index: number = 0; index < accounts.length; index++) {
      if (accounts[index].id === accountId) {
        return index;
      }
    }
    return -1;
  }

  private normalizeText(value: string, fallback: string): string {
    let normalized: string = value.trim();
    return normalized.length > 0 ? normalized : fallback;
  }

  private normalizeSecret(value: string): string {
    return value.trim().replace(/\s+/g, '').toUpperCase();
  }

  private normalizeNumber(value: number, fallback: number): number {
    return value > 0 ? value : fallback;
  }

  private normalizeAlgorithm(value: string): string {
    let normalized: string = value.trim().toUpperCase();
    if (normalized === 'SHA256' || normalized === 'SHA512') {
      return normalized;
    }
    return 'SHA1';
  }

  private resolveIconKey(issuer: string, accountName: string): string {
    let candidate: string = `${issuer} ${accountName}`.toLowerCase();
    if (candidate.indexOf('github') >= 0) {
      return 'github';
    }
    if (candidate.indexOf('google') >= 0 || candidate.indexOf('gmail') >= 0) {
      return 'google';
    }
    if (candidate.indexOf('microsoft') >= 0 || candidate.indexOf('outlook') >= 0 || candidate.indexOf('azure') >= 0) {
      return 'microsoft';
    }
    if (candidate.indexOf('openai') >= 0 || candidate.indexOf('chatgpt') >= 0) {
      return 'openai';
    }
    if (candidate.indexOf('slack') >= 0) {
      return 'slack';
    }
    if (candidate.indexOf('apple') >= 0 || candidate.indexOf('icloud') >= 0) {
      return 'apple';
    }
    if (candidate.indexOf('discord') >= 0) {
      return 'discord';
    }
    if (candidate.indexOf('spotify') >= 0) {
      return 'spotify';
    }
    return '';
  }

  private createTimestamp(): string {
    return new Date().toISOString();
  }

  private createAccountId(): string {
    return `local-${Date.now()}`;
  }
}
