import { BusinessError } from '@kit.BasicServicesKit';
import { asset } from '@kit.AssetStoreKit';
import { util } from '@kit.ArkTS';

const MASTER_PASSWORD_ALIAS: string = 'totp.biometric.masterPassword';

export class BiometricVaultCredentialService {
  private static instance: BiometricVaultCredentialService | undefined;

  static getInstance(): BiometricVaultCredentialService {
    if (!BiometricVaultCredentialService.instance) {
      BiometricVaultCredentialService.instance = new BiometricVaultCredentialService();
    }
    return BiometricVaultCredentialService.instance;
  }

  saveMasterPassword(password: string): void {
    this.removeMasterPassword();

    try {
      let attributes: asset.AssetMap = new Map();
      attributes.set(asset.Tag.SECRET, this.encodeText(password));
      attributes.set(asset.Tag.ALIAS, this.encodeText(MASTER_PASSWORD_ALIAS));
      attributes.set(asset.Tag.ACCESSIBILITY, asset.Accessibility.DEVICE_UNLOCKED);
      attributes.set(asset.Tag.REQUIRE_PASSWORD_SET, true);
      attributes.set(asset.Tag.SYNC_TYPE, asset.SyncType.NEVER);
      asset.addSync(attributes);
    } catch (error) {
      throw new Error(`保存生物识别凭据失败：${this.readErrorMessage(error)}`);
    }
  }

  loadMasterPassword(): string {
    try {
      let query: asset.AssetMap = new Map();
      query.set(asset.Tag.ALIAS, this.encodeText(MASTER_PASSWORD_ALIAS));
      query.set(asset.Tag.RETURN_TYPE, asset.ReturnType.ALL);
      let result: Array<asset.AssetMap> = asset.querySync(query);
      if (result.length === 0) {
        return '';
      }
      let secret: Uint8Array = result[0].get(asset.Tag.SECRET) as Uint8Array;
      return this.decodeText(secret);
    } catch (error) {
      throw new Error(`读取生物识别凭据失败：${this.readErrorMessage(error)}`);
    }
  }

  hasMasterPassword(): boolean {
    try {
      return this.loadMasterPassword().length > 0;
    } catch (_error) {
      return false;
    }
  }

  removeMasterPassword(): void {
    try {
      let query: asset.AssetMap = new Map();
      query.set(asset.Tag.ALIAS, this.encodeText(MASTER_PASSWORD_ALIAS));
      asset.removeSync(query);
    } catch (_error) {
      // Removing a non-existing local asset is fine when toggling the setting off.
    }
  }

  private encodeText(value: string): Uint8Array {
    let encoder: util.TextEncoder = new util.TextEncoder('utf-8');
    return encoder.encodeInto(value);
  }

  private decodeText(value: Uint8Array): string {
    let decoder: util.TextDecoder = util.TextDecoder.create('utf-8');
    return decoder.decodeToString(value);
  }

  private readErrorMessage(error: Object): string {
    let businessError: BusinessError = error as BusinessError;
    if (businessError && businessError.message && businessError.message.length > 0) {
      return businessError.message;
    }
    let runtimeError: Error = error as Error;
    if (runtimeError && runtimeError.message && runtimeError.message.length > 0) {
      return runtimeError.message;
    }
    return '未知错误';
  }
}
