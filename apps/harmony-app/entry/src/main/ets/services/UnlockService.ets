import { preferences } from '@kit.ArkData';
import { common } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { util } from '@kit.ArkTS';
import { userAuth } from '@kit.UserAuthenticationKit';
import { BiometricVaultCredentialService } from './BiometricVaultCredentialService';
import { SettingsStore } from '../storage/SettingsStore';

const STORE_NAME: string = 'totp_unlock_state';
const MASTER_PASSWORD_KEY: string = 'unlock.masterPassword';
const PASSWORD_RECORD_VERSION: number = 1;
const PASSWORD_KDF_NAME: string = 'PBKDF2';
const PASSWORD_KDF_HASH: string = 'SHA256';
const PASSWORD_KDF_ITERATIONS: number = 310000;
const PASSWORD_VERIFIER_SIZE: number = 32;
const PASSWORD_SALT_SIZE: number = 16;

class MasterPasswordRecord {
  formatVersion: number;
  kdfName: string;
  hash: string;
  iterations: number;
  salt: string;
  verifier: string;
  updatedAt: string;

  constructor(
    formatVersion: number,
    kdfName: string,
    hash: string,
    iterations: number,
    salt: string,
    verifier: string,
    updatedAt: string
  ) {
    this.formatVersion = formatVersion;
    this.kdfName = kdfName;
    this.hash = hash;
    this.iterations = iterations;
    this.salt = salt;
    this.verifier = verifier;
    this.updatedAt = updatedAt;
  }
}

class BiometricAuthConfig {
  authTypes: userAuth.UserAuthType[];
  trustLevel: userAuth.AuthTrustLevel;

  constructor(authTypes: userAuth.UserAuthType[], trustLevel: userAuth.AuthTrustLevel) {
    this.authTypes = authTypes;
    this.trustLevel = trustLevel;
  }
}

export class UnlockState {
  hasMasterPassword: boolean = false;
  isUnlocked: boolean = false;
  lastUnlockAt: string = '';
  hintMessage: string = '';

  constructor(
    hasMasterPassword: boolean = false,
    isUnlocked: boolean = false,
    lastUnlockAt: string = '',
    hintMessage: string = ''
  ) {
    this.hasMasterPassword = hasMasterPassword;
    this.isUnlocked = isUnlocked;
    this.lastUnlockAt = lastUnlockAt;
    this.hintMessage = hintMessage;
  }
}

export class UnlockService {
  private static instance: UnlockService | undefined;
  private isUnlocked: boolean = false;
  private lastUnlockAt: string = '';
  private sessionPassword: string = '';
  private settingsStore: SettingsStore = new SettingsStore();

  static getInstance(): UnlockService {
    if (!UnlockService.instance) {
      UnlockService.instance = new UnlockService();
    }
    return UnlockService.instance;
  }

  readState(context: common.UIAbilityContext): UnlockState {
    let store: preferences.Preferences = this.getStore(context);
    let hasMasterPassword: boolean = this.getStoredMasterPassword(store).length > 0;
    let hintMessage: string = '这是首次解锁，输入主密码后会在本机完成初始化。';

    if (hasMasterPassword) {
      hintMessage = this.isUnlocked
        ? '当前设备保管库已解锁。'
        : '请输入主密码以解锁本地保管库。';
    }

    return new UnlockState(
      hasMasterPassword,
      this.isUnlocked,
      this.lastUnlockAt,
      hintMessage
    );
  }

  isBiometricUnlockAvailable(context: common.UIAbilityContext): boolean {
    return this.settingsStore.loadBiometricUnlockEnabled(context);
  }

  ensureBiometricAuthenticatorAvailable(): void {
    this.resolveBiometricAuthConfig();
  }

  async confirmBiometricForSetup(): Promise<void> {
    await this.authenticateBiometric();
  }

  unlockWithPassword(context: common.UIAbilityContext, password: string): UnlockState {
    let normalizedPassword: string = password.trim();
    if (normalizedPassword.length === 0) {
      throw new Error('请输入主密码后再解锁。');
    }

    let store: preferences.Preferences = this.getStore(context);
    let savedPassword: string = this.getStoredMasterPassword(store);

    if (savedPassword.length === 0) {
      this.saveMasterPassword(store, normalizedPassword);
      this.isUnlocked = true;
      this.sessionPassword = normalizedPassword;
      this.lastUnlockAt = new Date().toISOString();
      return new UnlockState(
        true,
        true,
        this.lastUnlockAt,
        '主密码已初始化，当前设备保管库已解锁。'
      );
    }

    if (!this.verifyStoredPassword(savedPassword, normalizedPassword)) {
      this.isUnlocked = false;
      throw new Error('主密码不匹配，请重新输入。');
    }

    if (!this.isPasswordRecord(savedPassword)) {
      this.saveMasterPassword(store, normalizedPassword);
    }

    this.isUnlocked = true;
    this.sessionPassword = normalizedPassword;
    this.lastUnlockAt = new Date().toISOString();
    return new UnlockState(
      true,
      true,
      this.lastUnlockAt,
      '主密码验证通过，当前设备保管库已解锁。'
    );
  }

  async unlockWithBiometric(context: common.UIAbilityContext): Promise<UnlockState> {
    if (!this.settingsStore.loadBiometricUnlockEnabled(context)) {
      throw new Error('未开启生物识别解锁。');
    }

    let savedPassword: string = BiometricVaultCredentialService.getInstance().loadMasterPassword();
    if (savedPassword.length === 0) {
      throw new Error('未找到生物识别凭据，请先用主密码解锁后重新开启。');
    }

    await this.authenticateBiometric();
    return this.unlockWithPassword(context, savedPassword);
  }

  requireVaultPassword(): string {
    if (!this.isUnlocked || this.sessionPassword.length === 0) {
      throw new Error('本地保管库尚未解锁，请先输入主密码。');
    }
    return this.sessionPassword;
  }

  lockSession(): void {
    this.isUnlocked = false;
    this.sessionPassword = '';
  }

  private saveMasterPassword(store: preferences.Preferences, password: string): void {
    try {
      store.putSync(MASTER_PASSWORD_KEY, this.createPasswordRecordPayload(password));
      store.flushSync();
    } catch (error) {
      let businessError: BusinessError = error as BusinessError;
      throw new Error(`保存主密码失败：${businessError.message}`);
    }
  }

  private authenticateBiometric(): Promise<void> {
    return new Promise<void>((resolve: () => void, reject: (reason?: Object) => void) => {
      try {
        let config: BiometricAuthConfig = this.resolveBiometricAuthConfig();
        let challenge: Uint8Array = cryptoFramework.createRandom().generateRandomSync(16).data;
        let authParam: userAuth.AuthParam = {
          challenge: challenge,
          authType: config.authTypes,
          authTrustLevel: config.trustLevel,
          skipLockedBiometricAuth: true
        };
        let widgetParam: userAuth.WidgetParam = {
          title: '验证身份',
          navigationButtonText: '使用主密码'
        };
        let authInstance: userAuth.UserAuthInstance = userAuth.getUserAuthInstance(authParam, widgetParam);
        authInstance.on('result', {
          onResult: (result: userAuth.UserAuthResult) => {
            if (this.isBiometricAuthSuccess(result.result)) {
              resolve();
              return;
            }
            reject(new Error(this.describeBiometricAuthFailure(result.result)));
          }
        });
        authInstance.start();
      } catch (error) {
        reject(new Error(`启动生物识别失败：${this.readErrorMessage(error)}`));
      }
    });
  }

  private resolveBiometricAuthConfig(): BiometricAuthConfig {
    let strongTypes: userAuth.UserAuthType[] = this.collectAvailableBiometricTypes(userAuth.AuthTrustLevel.ATL3);
    if (strongTypes.length > 0) {
      return new BiometricAuthConfig(strongTypes, userAuth.AuthTrustLevel.ATL3);
    }

    let basicTypes: userAuth.UserAuthType[] = this.collectAvailableBiometricTypes(userAuth.AuthTrustLevel.ATL1);
    if (basicTypes.length > 0) {
      return new BiometricAuthConfig(basicTypes, userAuth.AuthTrustLevel.ATL1);
    }

    throw new Error('当前设备未录入可用的人脸或指纹，请先在系统设置中录入后再开启。');
  }

  private isBiometricAuthSuccess(resultCode: number): boolean {
    return resultCode === userAuth.UserAuthResultCode.SUCCESS || resultCode === 0;
  }

  private describeBiometricAuthFailure(resultCode: number): string {
    switch (resultCode) {
      case userAuth.UserAuthResultCode.FAIL:
      case 1:
        return this.formatBiometricAuthMessage('生物识别未通过，请重试。', resultCode);
      case userAuth.UserAuthResultCode.CANCELED:
      case 3:
        return this.formatBiometricAuthMessage('已取消生物识别。', resultCode);
      case userAuth.UserAuthResultCode.TIMEOUT:
      case 4:
        return this.formatBiometricAuthMessage('生物识别超时，请重新验证。', resultCode);
      case userAuth.UserAuthResultCode.TYPE_NOT_SUPPORT:
      case 5:
        return this.formatBiometricAuthMessage('当前设备不支持所选生物识别类型。', resultCode);
      case userAuth.UserAuthResultCode.TRUST_LEVEL_NOT_SUPPORT:
      case 6:
        return this.formatBiometricAuthMessage('当前设备的生物识别安全等级不足。', resultCode);
      case userAuth.UserAuthResultCode.BUSY:
      case 7:
        return this.formatBiometricAuthMessage('生物识别服务忙，请稍后重试。', resultCode);
      case userAuth.UserAuthResultCode.INVALID_PARAMETERS:
      case 8:
        return this.formatBiometricAuthMessage('生物识别参数校验失败。', resultCode);
      case userAuth.UserAuthResultCode.LOCKED:
      case 9:
        return this.formatBiometricAuthMessage('生物识别已被系统临时锁定，请稍后重试或使用主密码。', resultCode);
      case userAuth.UserAuthResultCode.NOT_ENROLLED:
      case 10:
        return this.formatBiometricAuthMessage('系统未录入可用的人脸或指纹。', resultCode);
      case userAuth.UserAuthResultCode.CANCELED_FROM_WIDGET:
        return this.formatBiometricAuthMessage('已切换为应用主密码验证。', resultCode);
      case userAuth.UserAuthResultCode.PIN_EXPIRED:
        return this.formatBiometricAuthMessage('系统锁屏密码已过期，请先到系统设置更新。', resultCode);
      default:
        return this.formatBiometricAuthMessage('生物识别未完成，请使用主密码解锁。', resultCode);
    }
  }

  private formatBiometricAuthMessage(message: string, resultCode: number): string {
    return `${message}（${resultCode}）`;
  }

  private collectAvailableBiometricTypes(trustLevel: userAuth.AuthTrustLevel): userAuth.UserAuthType[] {
    let authTypes: userAuth.UserAuthType[] = [];
    if (this.isAuthTypeAvailable(userAuth.UserAuthType.FACE, trustLevel)) {
      authTypes.push(userAuth.UserAuthType.FACE);
    }
    if (this.isAuthTypeAvailable(userAuth.UserAuthType.FINGERPRINT, trustLevel)) {
      authTypes.push(userAuth.UserAuthType.FINGERPRINT);
    }
    return authTypes;
  }

  private isAuthTypeAvailable(authType: userAuth.UserAuthType, trustLevel: userAuth.AuthTrustLevel): boolean {
    try {
      userAuth.getAvailableStatus(authType, trustLevel);
      return true;
    } catch (_error) {
      return false;
    }
  }

  private getStoredMasterPassword(store: preferences.Preferences): string {
    try {
      return store.getSync(MASTER_PASSWORD_KEY, '') as string;
    } catch (error) {
      throw new Error(`读取主密码记录失败：${this.readErrorMessage(error)}`);
    }
  }

  private verifyStoredPassword(payload: string, password: string): boolean {
    if (!this.isPasswordRecord(payload)) {
      return payload === password;
    }

    let record: MasterPasswordRecord = this.parsePasswordRecord(payload);
    if (record.formatVersion !== PASSWORD_RECORD_VERSION ||
      record.kdfName !== PASSWORD_KDF_NAME ||
      record.hash !== PASSWORD_KDF_HASH ||
      record.iterations !== PASSWORD_KDF_ITERATIONS) {
      throw new Error('主密码记录版本暂不支持，请先备份数据后重置本机配置。');
    }

    let salt: Uint8Array = this.decodeBase64(record.salt);
    let expectedVerifier: Uint8Array = this.decodeBase64(record.verifier);
    let actualVerifier: Uint8Array = this.deriveVerifier(password, salt, record.iterations);
    return this.bytesEqual(expectedVerifier, actualVerifier);
  }

  private createPasswordRecordPayload(password: string): string {
    try {
      let salt: Uint8Array = cryptoFramework.createRandom().generateRandomSync(PASSWORD_SALT_SIZE).data;
      let verifier: Uint8Array = this.deriveVerifier(password, salt, PASSWORD_KDF_ITERATIONS);
      let record: MasterPasswordRecord = new MasterPasswordRecord(
        PASSWORD_RECORD_VERSION,
        PASSWORD_KDF_NAME,
        PASSWORD_KDF_HASH,
        PASSWORD_KDF_ITERATIONS,
        this.encodeBase64(salt),
        this.encodeBase64(verifier),
        new Date().toISOString()
      );
      return JSON.stringify(record);
    } catch (error) {
      throw new Error(`生成主密码记录失败：${this.readErrorMessage(error)}`);
    }
  }

  private deriveVerifier(password: string, salt: Uint8Array, iterations: number): Uint8Array {
    let spec: cryptoFramework.PBKDF2Spec = {
      algName: PASSWORD_KDF_NAME,
      password: password,
      salt: salt,
      iterations: iterations,
      keySize: PASSWORD_VERIFIER_SIZE
    };
    try {
      let kdf: cryptoFramework.Kdf = cryptoFramework.createKdf('PBKDF2|SHA256');
      return kdf.generateSecretSync(spec).data;
    } catch (error) {
      throw new Error(`派生主密码校验密钥失败：${this.readErrorMessage(error)}`);
    }
  }

  private isPasswordRecord(payload: string): boolean {
    if (!payload.startsWith('{')) {
      return false;
    }

    try {
      let parsed: Record<string, Object> = JSON.parse(payload) as Record<string, Object>;
      return typeof parsed['formatVersion'] === 'number' &&
        typeof parsed['kdfName'] === 'string' &&
        typeof parsed['hash'] === 'string' &&
        typeof parsed['iterations'] === 'number' &&
        typeof parsed['salt'] === 'string' &&
        typeof parsed['verifier'] === 'string';
    } catch (_error) {
      return false;
    }
  }

  private parsePasswordRecord(payload: string): MasterPasswordRecord {
    let parsed: Record<string, Object> = JSON.parse(payload) as Record<string, Object>;
    return new MasterPasswordRecord(
      this.readNumber(parsed, 'formatVersion', 0),
      this.readString(parsed, 'kdfName', ''),
      this.readString(parsed, 'hash', ''),
      this.readNumber(parsed, 'iterations', 0),
      this.readString(parsed, 'salt', ''),
      this.readString(parsed, 'verifier', ''),
      this.readString(parsed, 'updatedAt', '')
    );
  }

  private readString(record: Record<string, Object>, key: string, fallback: string): string {
    let value: Object | undefined = record[key];
    return typeof value === 'string' ? value : fallback;
  }

  private readNumber(record: Record<string, Object>, key: string, fallback: number): number {
    let value: Object | undefined = record[key];
    return typeof value === 'number' ? value : fallback;
  }

  private encodeBase64(bytes: Uint8Array): string {
    try {
      return new util.Base64Helper().encodeToStringSync(bytes, util.Type.BASIC);
    } catch (error) {
      throw new Error(`Base64 编码失败：${this.readErrorMessage(error)}`);
    }
  }

  private decodeBase64(value: string): Uint8Array {
    try {
      return new util.Base64Helper().decodeSync(value, util.Type.BASIC);
    } catch (error) {
      throw new Error(`Base64 解码失败：${this.readErrorMessage(error)}`);
    }
  }

  private bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
    if (left.length !== right.length) {
      return false;
    }

    let result: number = 0;
    for (let index: number = 0; index < left.length; index++) {
      result = result | (left[index] ^ right[index]);
    }
    return result === 0;
  }

  private getStore(context: common.UIAbilityContext): preferences.Preferences {
    try {
      let options: preferences.Options = { name: STORE_NAME };
      return preferences.getPreferencesSync(context, options);
    } catch (error) {
      let businessError: BusinessError = error as BusinessError;
      throw new Error(`打开解锁状态存储失败：${businessError.message}`);
    }
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
