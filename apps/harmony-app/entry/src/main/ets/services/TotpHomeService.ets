import { common } from '@kit.AbilityKit';
import { LocalVault, createEmptyLocalVault } from '../model/LocalVault';
import { LocalVaultStore } from '../storage/LocalVaultStore';

export class TotpHomeService {
  private static instance: TotpHomeService | undefined;
  private store: LocalVaultStore = new LocalVaultStore();

  static getInstance(): TotpHomeService {
    if (!TotpHomeService.instance) {
      TotpHomeService.instance = new TotpHomeService();
    }
    return TotpHomeService.instance;
  }

  loadVault(context: common.UIAbilityContext): LocalVault {
    return this.store.load(context);
  }

  ensureVault(context: common.UIAbilityContext): LocalVault {
    let vault: LocalVault = this.store.load(context);
    if (vault.updatedAt.length === 0 && vault.accounts.length === 0) {
      return this.store.save(context, createEmptyLocalVault());
    }
    return vault;
  }
}
