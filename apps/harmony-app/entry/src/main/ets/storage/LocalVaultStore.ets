import { preferences } from '@kit.ArkData';
import { common } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { buffer, util } from '@kit.ArkTS';
import { LocalVault, createEmptyLocalVault, createLocalVaultFromJson } from '../model/LocalVault';
import { UnlockService } from '../services/UnlockService';

const STORE_NAME: string = 'totp_local_vault';
const SNAPSHOT_KEY: string = 'vault.snapshot';
const CORRUPT_SNAPSHOT_PREFIX: string = 'vault.snapshot.corrupt.';
const ENCRYPTED_VAULT_FORMAT: string = 'totp.localVault.encrypted.v1';
const VAULT_KDF_NAME: string = 'PBKDF2';
const VAULT_KDF_HASH: string = 'SHA256';
const VAULT_KDF_ITERATIONS: number = 310000;
const VAULT_KEY_SIZE: number = 16;
const VAULT_SALT_SIZE: number = 16;
const VAULT_IV_SIZE: number = 12;
const VAULT_TAG_SIZE: number = 16;

class EncryptedVaultRecord {
  format: string;
  kdfName: string;
  hash: string;
  iterations: number;
  salt: string;
  iv: string;
  authTag: string;
  ciphertext: string;
  updatedAt: string;

  constructor(
    format: string,
    kdfName: string,
    hash: string,
    iterations: number,
    salt: string,
    iv: string,
    authTag: string,
    ciphertext: string,
    updatedAt: string
  ) {
    this.format = format;
    this.kdfName = kdfName;
    this.hash = hash;
    this.iterations = iterations;
    this.salt = salt;
    this.iv = iv;
    this.authTag = authTag;
    this.ciphertext = ciphertext;
    this.updatedAt = updatedAt;
  }
}

export class LocalVaultStore {
  load(context: common.UIAbilityContext): LocalVault {
    try {
      let store: preferences.Preferences = this.getStore(context);
      let payload: string = store.getSync(SNAPSHOT_KEY, '') as string;
      if (payload.length === 0) {
        return createEmptyLocalVault();
      }

      if (this.isEncryptedPayload(payload)) {
        try {
          return createLocalVaultFromJson(this.decryptPayload(payload));
        } catch (error) {
          this.backupCorruptSnapshot(store, payload, this.readErrorMessage(error));
          return createEmptyLocalVault();
        }
      }

      return createLocalVaultFromJson(payload);
    } catch (error) {
      throw new Error(`load local vault failed: ${this.readErrorMessage(error)}`);
    }
  }

  save(context: common.UIAbilityContext, vault: LocalVault): LocalVault {
    try {
      let store: preferences.Preferences = this.getStore(context);
      store.putSync(SNAPSHOT_KEY, this.encryptPayload(JSON.stringify(vault.toRecord())));
      store.flushSync();
      return vault;
    } catch (error) {
      let businessError: BusinessError = error as BusinessError;
      throw new Error(`save local vault failed: ${businessError.message}`);
    }
  }

  private getStore(context: common.UIAbilityContext): preferences.Preferences {
    try {
      let options: preferences.Options = { name: STORE_NAME };
      return preferences.getPreferencesSync(context, options);
    } catch (error) {
      let businessError: BusinessError = error as BusinessError;
      throw new Error(`open preferences store failed: ${businessError.message}`);
    }
  }

  private backupCorruptSnapshot(store: preferences.Preferences, payload: string, reason: string): void {
    try {
      let timestamp: number = new Date().getTime();
      store.putSync(`${CORRUPT_SNAPSHOT_PREFIX}${timestamp}`, `${reason}\n${payload}`);
      store.putSync(SNAPSHOT_KEY, '');
      store.flushSync();
    } catch (_error) {
    }
  }

  private encryptPayload(payload: string): string {
    try {
      let password: string = UnlockService.getInstance().requireVaultPassword();
      let salt: Uint8Array = cryptoFramework.createRandom().generateRandomSync(VAULT_SALT_SIZE).data;
      let iv: Uint8Array = cryptoFramework.createRandom().generateRandomSync(VAULT_IV_SIZE).data;
      let key: cryptoFramework.SymKey = this.createAesKey(password, salt, VAULT_KDF_ITERATIONS);
      let params: cryptoFramework.GcmParamsSpec = this.createGcmParams(iv, new Uint8Array(VAULT_TAG_SIZE));
      let cipher: cryptoFramework.Cipher = cryptoFramework.createCipher('AES128|GCM|PKCS7');
      cipher.initSync(cryptoFramework.CryptoMode.ENCRYPT_MODE, key, params);
      let encryptedWithTag: Uint8Array = cipher.doFinalSync({ data: this.encodeUtf8(payload) }).data;
      let splitIndex: number = encryptedWithTag.length - VAULT_TAG_SIZE;
      if (splitIndex < 0) {
        throw new Error('加密结果缺少认证标签');
      }
      let encrypted: Uint8Array = this.sliceBytes(encryptedWithTag, 0, splitIndex);
      let authTag: Uint8Array = this.sliceBytes(encryptedWithTag, splitIndex, encryptedWithTag.length);
      let record: EncryptedVaultRecord = new EncryptedVaultRecord(
        ENCRYPTED_VAULT_FORMAT,
        VAULT_KDF_NAME,
        VAULT_KDF_HASH,
        VAULT_KDF_ITERATIONS,
        this.encodeBase64(salt),
        this.encodeBase64(iv),
        this.encodeBase64(authTag),
        this.encodeBase64(encrypted),
        new Date().toISOString()
      );
      return JSON.stringify(record);
    } catch (error) {
      throw new Error(`加密本地保管库失败：${this.readErrorMessage(error)}`);
    }
  }

  private decryptPayload(payload: string): string {
    try {
      let record: EncryptedVaultRecord = this.parseEncryptedPayload(payload);
      let password: string = UnlockService.getInstance().requireVaultPassword();
      let salt: Uint8Array = this.decodeBase64(record.salt);
      let iv: Uint8Array = this.decodeBase64(record.iv);
      let authTag: Uint8Array = this.decodeBase64(record.authTag);
      let ciphertext: Uint8Array = this.decodeBase64(record.ciphertext);
      let key: cryptoFramework.SymKey = this.createAesKey(password, salt, record.iterations);
      let params: cryptoFramework.GcmParamsSpec = this.createGcmParams(iv, authTag);
      let cipher: cryptoFramework.Cipher = cryptoFramework.createCipher('AES128|GCM|PKCS7');
      cipher.initSync(cryptoFramework.CryptoMode.DECRYPT_MODE, key, params);
      let decrypted: Uint8Array = cipher.doFinalSync({ data: ciphertext }).data;
      return this.decodeUtf8(decrypted);
    } catch (error) {
      throw new Error(`解密本地保管库失败：${this.readErrorMessage(error)}`);
    }
  }

  private createAesKey(password: string, salt: Uint8Array, iterations: number): cryptoFramework.SymKey {
    let spec: cryptoFramework.PBKDF2Spec = {
      algName: VAULT_KDF_NAME,
      password: password,
      salt: salt,
      iterations: iterations,
      keySize: VAULT_KEY_SIZE
    };
    try {
      let kdf: cryptoFramework.Kdf = cryptoFramework.createKdf('PBKDF2|SHA256');
      let keyBytes: Uint8Array = kdf.generateSecretSync(spec).data;
      return cryptoFramework.createSymKeyGenerator('AES128').convertKeySync({ data: keyBytes });
    } catch (error) {
      throw new Error(`派生本地保管库密钥失败：${this.readErrorMessage(error)}`);
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

  private isEncryptedPayload(payload: string): boolean {
    if (!payload.startsWith('{')) {
      return false;
    }
    try {
      let parsed: Record<string, Object> = JSON.parse(payload) as Record<string, Object>;
      return this.readString(parsed, 'format', '') === ENCRYPTED_VAULT_FORMAT;
    } catch (_error) {
      return false;
    }
  }

  private parseEncryptedPayload(payload: string): EncryptedVaultRecord {
    let parsed: Record<string, Object> = JSON.parse(payload) as Record<string, Object>;
    let format: string = this.readString(parsed, 'format', '');
    let kdfName: string = this.readString(parsed, 'kdfName', '');
    let hash: string = this.readString(parsed, 'hash', '');
    let iterations: number = this.readNumber(parsed, 'iterations', 0);
    if (format !== ENCRYPTED_VAULT_FORMAT ||
      kdfName !== VAULT_KDF_NAME ||
      hash !== VAULT_KDF_HASH ||
      iterations !== VAULT_KDF_ITERATIONS) {
      throw new Error('本地加密保管库格式暂不支持。');
    }

    return new EncryptedVaultRecord(
      format,
      kdfName,
      hash,
      iterations,
      this.readString(parsed, 'salt', ''),
      this.readString(parsed, 'iv', ''),
      this.readString(parsed, 'authTag', ''),
      this.readString(parsed, 'ciphertext', ''),
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

  private concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
    if (right.length === 0) {
      return left;
    }
    let merged: Uint8Array = new Uint8Array(left.length + right.length);
    merged.set(left, 0);
    merged.set(right, left.length);
    return merged;
  }

  private sliceBytes(bytes: Uint8Array, start: number, end: number): Uint8Array {
    let sliced: Uint8Array = new Uint8Array(end - start);
    sliced.set(bytes.subarray(start, end), 0);
    return sliced;
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
