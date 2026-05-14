import { common } from '@kit.AbilityKit';
import { fileIo as fs, picker } from '@kit.CoreFileKit';
import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { buffer, util } from '@kit.ArkTS';
import { DEFAULT_WEBDAV_FILE_PATH, WebDavSettings } from '../model/WebDavSettings';
import { LocalVault, createLocalVaultFromJson } from '../model/LocalVault';
import { TotpAccount } from '../model/TotpAccount';
import { createDefaultWebDavSyncMetadata } from '../model/WebDavSyncMetadata';
import { BiometricVaultCredentialService } from './BiometricVaultCredentialService';
import { UnlockService } from './UnlockService';
import { LocalVaultStore } from '../storage/LocalVaultStore';
import { SettingsStore } from '../storage/SettingsStore';

const WEB_EXPORT_FORMAT_VERSION: number = 1;
const WEB_EXPORT_KDF_NAME: string = 'PBKDF2';
const WEB_EXPORT_KDF_HASH: string = 'SHA-256';
const WEB_EXPORT_KDF_ALG_NAME: string = 'PBKDF2';
const WEB_EXPORT_KDF_ITERATIONS: number = 310000;
const WEB_EXPORT_CIPHER: string = 'AES-GCM';
const WEB_EXPORT_AES_ALGORITHM: string = 'AES256';
const WEB_EXPORT_AES_CIPHER: string = 'AES256|GCM|PKCS7';
const WEB_EXPORT_KEY_SIZE: number = 32;
const WEB_EXPORT_SALT_SIZE: number = 16;
const WEB_EXPORT_IV_SIZE: number = 12;
const WEB_EXPORT_TAG_SIZE: number = 16;

export interface WebDavSettingsDraft {
  enabled: boolean;
  serverUrl: string;
  filePath: string;
  username: string;
  password: string;
  syncIntervalMinutes: number;
}

export class ExportVaultResult {
  filename: string;
  exportedCount: number;

  constructor(filename: string, exportedCount: number) {
    this.filename = filename;
    this.exportedCount = exportedCount;
  }
}

export class ImportVaultResult {
  vault: LocalVault;
  importedCount: number;

  constructor(vault: LocalVault, importedCount: number) {
    this.vault = vault;
    this.importedCount = importedCount;
  }
}

class PlainExportBundle {
  mode: string;
  vault: PlainExportVaultPayload;

  constructor(vault: PlainExportVaultPayload) {
    this.mode = 'plain';
    this.vault = vault;
  }
}

class EncryptedExportBundle {
  mode: string;
  encryptedVault: WebEncryptedVaultBlob;

  constructor(encryptedVault: WebEncryptedVaultBlob) {
    this.mode = 'encrypted';
    this.encryptedVault = encryptedVault;
  }
}

class WebKdfConfig {
  name: string;
  iterations: number;
  hash: string;

  constructor() {
    this.name = WEB_EXPORT_KDF_NAME;
    this.iterations = WEB_EXPORT_KDF_ITERATIONS;
    this.hash = WEB_EXPORT_KDF_HASH;
  }
}

class WebEncryptedVaultBlob {
  formatVersion: number;
  kdf: WebKdfConfig;
  cipher: string;
  salt: string;
  iv: string;
  ciphertext: string;
  passwordVerifier: string;

  constructor(salt: string, iv: string, ciphertext: string, passwordVerifier: string) {
    this.formatVersion = WEB_EXPORT_FORMAT_VERSION;
    this.kdf = new WebKdfConfig();
    this.cipher = WEB_EXPORT_CIPHER;
    this.salt = salt;
    this.iv = iv;
    this.ciphertext = ciphertext;
    this.passwordVerifier = passwordVerifier;
  }
}

class PlainExportVaultPayload {
  version: number;
  accounts: WebAccountExportRecord[];

  constructor(version: number, accounts: WebAccountExportRecord[]) {
    this.version = version;
    this.accounts = accounts;
  }
}

class WebAccountExportRecord {
  id: string;
  issuer: string;
  accountName: string;
  secret: string;
  digits: number;
  period: number;
  algorithm: string;
  tags: string[];
  groupId: string;
  pinned: boolean;
  iconKey: string;
  updatedAt: string;

  constructor(account: TotpAccount) {
    this.id = account.id;
    this.issuer = account.issuer;
    this.accountName = account.accountName;
    this.secret = account.secret;
    this.digits = account.digits;
    this.period = account.period;
    this.algorithm = account.algorithm;
    this.tags = [account.groupName.length > 0 ? account.groupName : 'Default'];
    this.groupId = '';
    this.pinned = false;
    this.iconKey = account.iconKey;
    this.updatedAt = account.updatedAt;
  }
}

export class SettingsService {
  private static instance: SettingsService | undefined;
  private store: SettingsStore = new SettingsStore();
  private vaultStore: LocalVaultStore = new LocalVaultStore();

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  loadWebDavSettings(context: common.UIAbilityContext): WebDavSettings {
    return this.store.loadWebDavSettings(context);
  }

  loadBiometricUnlockEnabled(context: common.UIAbilityContext): boolean {
    return this.store.loadBiometricUnlockEnabled(context);
  }

  saveWebDavSettings(context: common.UIAbilityContext, draft: WebDavSettingsDraft): WebDavSettings {
    let previousSettings: WebDavSettings = this.store.loadWebDavSettings(context);
    let filePath: string = draft.filePath.trim();
    let normalizedPath: string = filePath.length > 0 ? filePath : DEFAULT_WEBDAV_FILE_PATH;
    if (!normalizedPath.startsWith('/')) {
      normalizedPath = `/${normalizedPath}`;
    }

    if (draft.enabled && draft.serverUrl.trim().length === 0) {
      throw new Error('启用 WebDAV 前需要填写服务器地址');
    }

    let interval: number = draft.syncIntervalMinutes > 0 ? draft.syncIntervalMinutes : 15;
    let settings: WebDavSettings = new WebDavSettings(
      draft.enabled,
      draft.serverUrl.trim(),
      normalizedPath,
      draft.username.trim(),
      draft.password,
      interval,
      new Date().toISOString()
    );
    let savedSettings: WebDavSettings = this.store.saveWebDavSettings(context, settings);
    if (this.hasSyncProfileChanged(previousSettings, savedSettings)) {
      this.store.saveWebDavSyncMetadata(context, createDefaultWebDavSyncMetadata());
    }
    return savedSettings;
  }

  async saveBiometricUnlockEnabled(context: common.UIAbilityContext, enabled: boolean): Promise<boolean> {
    if (enabled) {
      UnlockService.getInstance().ensureBiometricAuthenticatorAvailable();
      await UnlockService.getInstance().confirmBiometricForSetup();
      let password: string = UnlockService.getInstance().requireVaultPassword();
      BiometricVaultCredentialService.getInstance().saveMasterPassword(password);
    } else {
      BiometricVaultCredentialService.getInstance().removeMasterPassword();
    }
    return this.store.saveBiometricUnlockEnabled(context, enabled);
  }

  async exportVault(context: common.UIAbilityContext): Promise<ExportVaultResult> {
    let vault: LocalVault = this.vaultStore.load(context);
    let filename: string = this.createBackupFilename();
    let documentSaveOptions: picker.DocumentSaveOptions = new picker.DocumentSaveOptions();
    documentSaveOptions.newFileNames = [filename];
    let documentPicker: picker.DocumentViewPicker = new picker.DocumentViewPicker(context);
    let selectedUris: string[] = await documentPicker.save(documentSaveOptions);
    if (selectedUris.length === 0) {
      throw new Error('未选择导出位置。');
    }

    this.writeTextFile(selectedUris[0], this.createEncryptedExportContent(vault));
    return new ExportVaultResult(filename, vault.accounts.length);
  }

  async importVault(context: common.UIAbilityContext): Promise<ImportVaultResult> {
    let documentSelectOptions: picker.DocumentSelectOptions = new picker.DocumentSelectOptions();
    let documentPicker: picker.DocumentViewPicker = new picker.DocumentViewPicker(context);
    let selectedUris: string[] = await documentPicker.select(documentSelectOptions);
    if (selectedUris.length === 0) {
      throw new Error('未选择备份文件。');
    }

    let raw: string = this.readTextFile(selectedUris[0]);
    let vault: LocalVault = this.parseImportContent(raw);
    let savedVault: LocalVault = this.vaultStore.save(context, vault);
    return new ImportVaultResult(savedVault, savedVault.accounts.length);
  }

  private hasSyncProfileChanged(previousSettings: WebDavSettings, nextSettings: WebDavSettings): boolean {
    return previousSettings.serverUrl !== nextSettings.serverUrl ||
      previousSettings.filePath !== nextSettings.filePath ||
      previousSettings.username !== nextSettings.username ||
      previousSettings.password !== nextSettings.password;
  }

  private createPlainExportContent(vault: LocalVault): string {
    return JSON.stringify(
      new PlainExportBundle(new PlainExportVaultPayload(1, this.toWebAccountRecords(vault.accounts))),
      null,
      2
    );
  }

  private createEncryptedExportContent(vault: LocalVault): string {
    let payload: PlainExportVaultPayload = new PlainExportVaultPayload(1, this.toWebAccountRecords(vault.accounts));
    let encryptedVault: WebEncryptedVaultBlob = this.encryptWebVaultPayload(JSON.stringify(payload));
    return JSON.stringify(new EncryptedExportBundle(encryptedVault), null, 2);
  }

  private parseImportContent(raw: string): LocalVault {
    let parsed: Record<string, Object> = JSON.parse(raw) as Record<string, Object>;
    let modeValue: Object | undefined = parsed['mode'];
    if (modeValue === 'encrypted') {
      let encryptedVaultValue: Object | undefined = parsed['encryptedVault'];
      if (typeof encryptedVaultValue !== 'object' || encryptedVaultValue === null || Array.isArray(encryptedVaultValue)) {
        throw new Error('加密备份内容无效。');
      }
      return this.createLocalVaultFromWebPayload(
        this.decryptWebVaultPayload(encryptedVaultValue as Record<string, Object>)
      );
    }

    if (modeValue === 'plain') {
      let vaultValue: Object | undefined = parsed['vault'];
      if (typeof vaultValue !== 'object' || vaultValue === null || Array.isArray(vaultValue)) {
        throw new Error('明文备份内容无效。');
      }
      return this.createLocalVaultFromWebPayload(vaultValue as Record<string, Object>);
    }

    return createLocalVaultFromJson(raw);
  }

  private createLocalVaultFromWebPayload(payload: Record<string, Object>): LocalVault {
    let accountsValue: Object | undefined = payload['accounts'];
    if (!Array.isArray(accountsValue)) {
      throw new Error('备份文件中没有账号列表。');
    }

    let now: string = new Date().toISOString();
    let accounts: TotpAccount[] = [];
    for (let index: number = 0; index < accountsValue.length; index++) {
      let item: Object = accountsValue[index];
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        accounts.push(this.createLocalAccountFromWebRecord(item as Record<string, Object>, index, now));
      }
    }

    return new LocalVault(1, now, accounts);
  }

  private encryptWebVaultPayload(payload: string): WebEncryptedVaultBlob {
    try {
      let password: string = UnlockService.getInstance().requireVaultPassword();
      let salt: Uint8Array = cryptoFramework.createRandom().generateRandomSync(WEB_EXPORT_SALT_SIZE).data;
      let iv: Uint8Array = cryptoFramework.createRandom().generateRandomSync(WEB_EXPORT_IV_SIZE).data;
      let key: cryptoFramework.SymKey = this.createWebAesKey(password, salt);
      let params: cryptoFramework.GcmParamsSpec = this.createGcmParams(iv, new Uint8Array(WEB_EXPORT_TAG_SIZE));
      let cipher: cryptoFramework.Cipher = cryptoFramework.createCipher(WEB_EXPORT_AES_CIPHER);
      cipher.initSync(cryptoFramework.CryptoMode.ENCRYPT_MODE, key, params);
      let encryptedWithTag: Uint8Array = cipher.doFinalSync({ data: this.encodeUtf8(payload) }).data;
      let passwordVerifier: Uint8Array = this.deriveWebPasswordVerifier(password, salt);
      return new WebEncryptedVaultBlob(
        this.encodeBase64(salt),
        this.encodeBase64(iv),
        this.encodeBase64(encryptedWithTag),
        this.encodeBase64(passwordVerifier)
      );
    } catch (error) {
      throw new Error(`导出加密备份失败：${this.readErrorMessage(error)}`);
    }
  }

  private decryptWebVaultPayload(encryptedVault: Record<string, Object>): Record<string, Object> {
    try {
      this.validateWebEncryptedVault(encryptedVault);
      let password: string = UnlockService.getInstance().requireVaultPassword();
      let salt: Uint8Array = this.decodeBase64(this.readString(encryptedVault, 'salt', ''));
      let iv: Uint8Array = this.decodeBase64(this.readString(encryptedVault, 'iv', ''));
      let encryptedWithTag: Uint8Array = this.decodeBase64(this.readString(encryptedVault, 'ciphertext', ''));
      let expectedVerifier: Uint8Array = this.decodeBase64(this.readString(encryptedVault, 'passwordVerifier', ''));
      let actualVerifier: Uint8Array = this.deriveWebPasswordVerifier(password, salt);
      if (!this.bytesEqual(expectedVerifier, actualVerifier)) {
        throw new Error('备份密码与当前主密码不匹配。');
      }
      if (encryptedWithTag.length <= WEB_EXPORT_TAG_SIZE) {
        throw new Error('加密备份密文不完整。');
      }

      let ciphertext: Uint8Array = this.sliceBytes(encryptedWithTag, 0, encryptedWithTag.length - WEB_EXPORT_TAG_SIZE);
      let authTag: Uint8Array = this.sliceBytes(encryptedWithTag, encryptedWithTag.length - WEB_EXPORT_TAG_SIZE, encryptedWithTag.length);
      let key: cryptoFramework.SymKey = this.createWebAesKey(password, salt);
      let cipher: cryptoFramework.Cipher = cryptoFramework.createCipher(WEB_EXPORT_AES_CIPHER);
      cipher.initSync(cryptoFramework.CryptoMode.DECRYPT_MODE, key, this.createGcmParams(iv, authTag));
      let decrypted: Uint8Array = cipher.doFinalSync({ data: ciphertext }).data;
      return JSON.parse(this.decodeUtf8(decrypted)) as Record<string, Object>;
    } catch (error) {
      throw new Error(`导入加密备份失败：${this.readErrorMessage(error)}`);
    }
  }

  private validateWebEncryptedVault(encryptedVault: Record<string, Object>): void {
    let kdfValue: Object | undefined = encryptedVault['kdf'];
    if (typeof kdfValue !== 'object' || kdfValue === null || Array.isArray(kdfValue)) {
      throw new Error('加密备份缺少 KDF 参数。');
    }
    let kdf: Record<string, Object> = kdfValue as Record<string, Object>;
    if (this.readNumber(encryptedVault, 'formatVersion', 0) !== WEB_EXPORT_FORMAT_VERSION ||
      this.readString(kdf, 'name', '') !== WEB_EXPORT_KDF_NAME ||
      this.readNumber(kdf, 'iterations', 0) !== WEB_EXPORT_KDF_ITERATIONS ||
      this.readString(kdf, 'hash', '') !== WEB_EXPORT_KDF_HASH ||
      this.readString(encryptedVault, 'cipher', '') !== WEB_EXPORT_CIPHER) {
      throw new Error('加密备份格式暂不支持。');
    }
  }

  private createWebAesKey(password: string, salt: Uint8Array): cryptoFramework.SymKey {
    try {
      let keyBytes: Uint8Array = this.deriveWebKeyBytes(password, salt);
      return cryptoFramework.createSymKeyGenerator(WEB_EXPORT_AES_ALGORITHM).convertKeySync({ data: keyBytes });
    } catch (error) {
      throw new Error(`创建备份加密密钥失败：${this.readErrorMessage(error)}`);
    }
  }

  private deriveWebPasswordVerifier(password: string, salt: Uint8Array): Uint8Array {
    return this.deriveWebKeyBytes(password, salt);
  }

  private deriveWebKeyBytes(password: string, salt: Uint8Array): Uint8Array {
    let spec: cryptoFramework.PBKDF2Spec = {
      algName: WEB_EXPORT_KDF_ALG_NAME,
      password: password,
      salt: salt,
      iterations: WEB_EXPORT_KDF_ITERATIONS,
      keySize: WEB_EXPORT_KEY_SIZE
    };
    try {
      let kdf: cryptoFramework.Kdf = cryptoFramework.createKdf('PBKDF2|SHA256');
      return kdf.generateSecretSync(spec).data;
    } catch (error) {
      throw new Error(`派生备份密钥失败：${this.readErrorMessage(error)}`);
    }
  }

  private createGcmParams(iv: Uint8Array, authTag: Uint8Array): cryptoFramework.GcmParamsSpec {
    return {
      iv: { data: iv },
      aad: { data: new Uint8Array() },
      authTag: { data: authTag },
      algName: 'GcmParamsSpec'
    };
  }

  private createLocalAccountFromWebRecord(record: Record<string, Object>, index: number, now: string): TotpAccount {
    return new TotpAccount(
      this.readString(record, 'id', `imported-${new Date().getTime()}-${index}`),
      this.readString(record, 'issuer', ''),
      this.readString(record, 'accountName', ''),
      this.readString(record, 'secret', ''),
      this.readNumber(record, 'digits', 6),
      this.readNumber(record, 'period', 30),
      this.readString(record, 'algorithm', 'SHA1'),
      this.readGroupName(record),
      this.readString(record, 'iconKey', ''),
      this.readString(record, 'updatedAt', now)
    );
  }

  private toWebAccountRecords(accounts: TotpAccount[]): WebAccountExportRecord[] {
    let records: WebAccountExportRecord[] = [];
    for (let index: number = 0; index < accounts.length; index++) {
      records.push(new WebAccountExportRecord(accounts[index]));
    }
    return records;
  }

  private readGroupName(record: Record<string, Object>): string {
    let tagsValue: Object | undefined = record['tags'];
    if (Array.isArray(tagsValue) && tagsValue.length > 0 && typeof tagsValue[0] === 'string') {
      return tagsValue[0] as string;
    }
    return 'Default';
  }

  private createBackupFilename(): string {
    let date: Date = new Date();
    return `totp-backup-encrypted-${date.getFullYear()}${this.pad(date.getMonth() + 1)}${this.pad(date.getDate())}-${this.pad(date.getHours())}${this.pad(date.getMinutes())}.json`;
  }

  private readTextFile(uri: string): string {
    let file: fs.File | undefined = undefined;
    try {
      file = fs.openSync(uri, fs.OpenMode.READ_ONLY);
      let stat: fs.Stat = fs.statSync(file.fd);
      let contentBuffer: ArrayBuffer = new ArrayBuffer(stat.size);
      let readLength: number = fs.readSync(file.fd, contentBuffer);
      return buffer.from(contentBuffer.slice(0, readLength)).toString('utf-8');
    } catch (error) {
      throw new Error(`读取备份文件失败：${this.readErrorMessage(error)}`);
    } finally {
      if (file !== undefined) {
        this.closeFileQuietly(file);
      }
    }
  }

  private writeTextFile(uri: string, content: string): void {
    let file: fs.File | undefined = undefined;
    try {
      file = fs.openSync(uri, fs.OpenMode.WRITE_ONLY | fs.OpenMode.TRUNC);
      fs.writeSync(file.fd, content);
      fs.fsyncSync(file.fd);
    } catch (error) {
      throw new Error(`写入备份文件失败：${this.readErrorMessage(error)}`);
    } finally {
      if (file !== undefined) {
        this.closeFileQuietly(file);
      }
    }
  }

  private encodeUtf8(value: string): Uint8Array {
    try {
      return new Uint8Array(buffer.from(value, 'utf-8').buffer);
    } catch (error) {
      throw new Error(`UTF-8 编码失败：${this.readErrorMessage(error)}`);
    }
  }

  private decodeUtf8(value: Uint8Array): string {
    try {
      return buffer.from(this.sliceBytes(value, 0, value.length).buffer).toString('utf-8');
    } catch (error) {
      throw new Error(`UTF-8 解码失败：${this.readErrorMessage(error)}`);
    }
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

  private closeFileQuietly(file: fs.File): void {
    try {
      fs.closeSync(file);
    } catch (error) {
      // Closing a file in cleanup should not hide the original read/write error.
    }
  }

  private sliceBytes(bytes: Uint8Array, start: number, end: number): Uint8Array {
    let sliced: Uint8Array = new Uint8Array(end - start);
    sliced.set(bytes.subarray(start, end), 0);
    return sliced;
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

  private readErrorMessage(error: Object): string {
    let runtimeError: Error = error as Error;
    if (runtimeError && runtimeError.message && runtimeError.message.length > 0) {
      return runtimeError.message;
    }
    return '未知错误';
  }

  private readString(record: Record<string, Object>, key: string, fallback: string): string {
    let value: Object | undefined = record[key];
    return typeof value === 'string' ? value : fallback;
  }

  private readNumber(record: Record<string, Object>, key: string, fallback: number): number {
    let value: Object | undefined = record[key];
    return typeof value === 'number' ? value : fallback;
  }

  private pad(value: number): string {
    return value < 10 ? `0${value}` : `${value}`;
  }
}
