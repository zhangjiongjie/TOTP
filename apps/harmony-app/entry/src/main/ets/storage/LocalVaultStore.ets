import { preferences } from '@kit.ArkData';
import { common } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { buffer, util } from '@kit.ArkTS';
import { LocalVault, createEmptyLocalVault, createLocalVaultFromJson } from '../model/LocalVault';
import { EncryptedRemoteVaultBlob } from '../services/RemoteVaultCryptoService';
import { UnlockService } from '../services/UnlockService';

const STORE_NAME: string = 'totp_local_vault';
const SNAPSHOT_KEY: string = 'vault.snapshot';
const CORRUPT_SNAPSHOT_PREFIX: string = 'vault.snapshot.corrupt.';
const FORMAT_VERSION: number = 2;
const KDF_NAME: string = 'PBKDF2';
const KDF_HASH: string = 'SHA-256';
const KDF_ALGORITHM: string = 'PBKDF2|SHA256';
const KDF_ITERATIONS: number = 310000;
const CIPHER: string = 'AES-GCM';
const AES_KEY_SIZE: number = 32;
const AES_ALGORITHM: string = 'AES256';
const AES_CIPHER: string = 'AES256|GCM|PKCS7';
const SALT_SIZE: number = 16;
const IV_SIZE: number = 12;
const TAG_SIZE: number = 16;

class KdfRecord {
  name: string;
  iterations: number;
  hash: string;
  salt: string;

  constructor(name: string, iterations: number, hash: string, salt: string) {
    this.name = name;
    this.iterations = iterations;
    this.hash = hash;
    this.salt = salt;
  }
}

class AesGcmRecord {
  cipher: string;
  iv: string;
  ciphertext: string;

  constructor(cipher: string, iv: string, ciphertext: string) {
    this.cipher = cipher;
    this.iv = iv;
    this.ciphertext = ciphertext;
  }
}

class EncryptedVaultRecord {
  formatVersion: number;
  vaultId: string;
  kdf: KdfRecord;
  keyEncryption: AesGcmRecord;
  vaultEncryption: AesGcmRecord;
  updatedAt: string;

  constructor(
    formatVersion: number,
    vaultId: string,
    kdf: KdfRecord,
    keyEncryption: AesGcmRecord,
    vaultEncryption: AesGcmRecord,
    updatedAt: string
  ) {
    this.formatVersion = formatVersion;
    this.vaultId = vaultId;
    this.kdf = kdf;
    this.keyEncryption = keyEncryption;
    this.vaultEncryption = vaultEncryption;
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

      let record: EncryptedVaultRecord;
      try {
        record = this.parseEncryptedPayload(payload);
      } catch (error) {
        this.backupCorruptSnapshot(store, payload, this.readErrorMessage(error));
        return createEmptyLocalVault();
      }

      return createLocalVaultFromJson(this.decryptRecord(record));
    } catch (error) {
      throw new Error(`load local vault failed: ${this.readErrorMessage(error)}`);
    }
  }

  save(context: common.UIAbilityContext, vault: LocalVault): LocalVault {
    try {
      let store: preferences.Preferences = this.getStore(context);
      let existingPayload: string = store.getSync(SNAPSHOT_KEY, '') as string;
      store.putSync(SNAPSHOT_KEY, this.encryptPayload(JSON.stringify(vault.toRecord()), existingPayload));
      store.flushSync();
      return vault;
    } catch (error) {
      let businessError: BusinessError = error as BusinessError;
      throw new Error(`save local vault failed: ${businessError.message}`);
    }
  }

  saveWithRemoteKey(context: common.UIAbilityContext, vault: LocalVault, remoteEnvelope: EncryptedRemoteVaultBlob, vaultKeyBytes: Uint8Array): LocalVault {
    try {
      let store: preferences.Preferences = this.getStore(context);
      let vaultKey: cryptoFramework.SymKey = cryptoFramework.createSymKeyGenerator(AES_ALGORITHM).convertKeySync({ data: vaultKeyBytes });
      let vaultIv: Uint8Array = cryptoFramework.createRandom().generateRandomSync(IV_SIZE).data;
      let encryptedVault: Uint8Array = this.encryptGcm(vaultKey, vaultIv, this.encodeUtf8(JSON.stringify(vault.toRecord())));
      let record: EncryptedVaultRecord = new EncryptedVaultRecord(
        remoteEnvelope.formatVersion,
        remoteEnvelope.vaultId,
        new KdfRecord(remoteEnvelope.kdf.name, remoteEnvelope.kdf.iterations, remoteEnvelope.kdf.hash, remoteEnvelope.kdf.salt),
        new AesGcmRecord(remoteEnvelope.keyEncryption.cipher, remoteEnvelope.keyEncryption.iv, remoteEnvelope.keyEncryption.ciphertext),
        new AesGcmRecord(CIPHER, this.encodeBase64(vaultIv), this.encodeBase64(encryptedVault)),
        new Date().toISOString()
      );
      store.putSync(SNAPSHOT_KEY, JSON.stringify(record));
      store.flushSync();
      return vault;
    } catch (error) {
      let businessError: BusinessError = error as BusinessError;
      throw new Error(`save local vault failed: ${businessError.message}`);
    }
  }

  rewrapMasterPassword(context: common.UIAbilityContext, currentPassword: string, nextPassword: string): void {
    try {
      let store: preferences.Preferences = this.getStore(context);
      let payload: string = store.getSync(SNAPSHOT_KEY, '') as string;
      if (payload.length === 0) {
        return;
      }
      let existing: EncryptedVaultRecord = this.parseEncryptedPayload(payload);
      let vaultKeyBytes: Uint8Array = this.unwrapVaultKeyWithPassword(existing, currentPassword);
      let salt: Uint8Array = cryptoFramework.createRandom().generateRandomSync(SALT_SIZE).data;
      let keyIv: Uint8Array = cryptoFramework.createRandom().generateRandomSync(IV_SIZE).data;
      let wrappingKey: cryptoFramework.SymKey = this.createAesKey(nextPassword, salt, KDF_ITERATIONS);
      let updated: EncryptedVaultRecord = new EncryptedVaultRecord(
        existing.formatVersion,
        existing.vaultId,
        new KdfRecord(KDF_NAME, KDF_ITERATIONS, KDF_HASH, this.encodeBase64(salt)),
        new AesGcmRecord(CIPHER, this.encodeBase64(keyIv), this.encodeBase64(this.encryptGcm(wrappingKey, keyIv, vaultKeyBytes))),
        existing.vaultEncryption,
        new Date().toISOString()
      );
      store.putSync(SNAPSHOT_KEY, JSON.stringify(updated));
      store.flushSync();
    } catch (error) {
      throw new Error(`修改本地主密码失败：${this.readErrorMessage(error)}`);
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

  private encryptPayload(payload: string, existingPayload: string): string {
    try {
      let password: string = UnlockService.getInstance().requireVaultPassword();
      let existing: EncryptedVaultRecord | null = this.tryParseEncryptedPayload(existingPayload);
      let vaultKeyBytes: Uint8Array = existing === null
        ? cryptoFramework.createRandom().generateRandomSync(AES_KEY_SIZE).data
        : this.unwrapVaultKey(existing, password);
      let vaultKey: cryptoFramework.SymKey = cryptoFramework.createSymKeyGenerator(AES_ALGORITHM).convertKeySync({ data: vaultKeyBytes });
      let vaultIv: Uint8Array = cryptoFramework.createRandom().generateRandomSync(IV_SIZE).data;
      let encryptedVault: Uint8Array = this.encryptGcm(vaultKey, vaultIv, this.encodeUtf8(payload));
      let record: EncryptedVaultRecord;

      if (existing === null) {
        let salt: Uint8Array = cryptoFramework.createRandom().generateRandomSync(SALT_SIZE).data;
        let keyIv: Uint8Array = cryptoFramework.createRandom().generateRandomSync(IV_SIZE).data;
        let wrappingKey: cryptoFramework.SymKey = this.createAesKey(password, salt, KDF_ITERATIONS);
        record = new EncryptedVaultRecord(
          FORMAT_VERSION,
          this.createVaultId(),
          new KdfRecord(KDF_NAME, KDF_ITERATIONS, KDF_HASH, this.encodeBase64(salt)),
          new AesGcmRecord(CIPHER, this.encodeBase64(keyIv), this.encodeBase64(this.encryptGcm(wrappingKey, keyIv, vaultKeyBytes))),
          new AesGcmRecord(CIPHER, this.encodeBase64(vaultIv), this.encodeBase64(encryptedVault)),
          new Date().toISOString()
        );
      } else {
        record = new EncryptedVaultRecord(
          existing.formatVersion,
          existing.vaultId,
          existing.kdf,
          existing.keyEncryption,
          new AesGcmRecord(CIPHER, this.encodeBase64(vaultIv), this.encodeBase64(encryptedVault)),
          new Date().toISOString()
        );
      }
      return JSON.stringify(record);
    } catch (error) {
      throw new Error(`加密本地保管库失败：${this.readErrorMessage(error)}`);
    }
  }

  private decryptRecord(record: EncryptedVaultRecord): string {
    try {
      this.assertSupportedRecord(record);
      let password: string = UnlockService.getInstance().requireVaultPassword();
      let vaultKeyBytes: Uint8Array = this.unwrapVaultKey(record, password);
      let vaultKey: cryptoFramework.SymKey = cryptoFramework.createSymKeyGenerator(AES_ALGORITHM).convertKeySync({ data: vaultKeyBytes });
      return this.decodeUtf8(this.decryptGcm(vaultKey, this.decodeBase64(record.vaultEncryption.iv), this.decodeBase64(record.vaultEncryption.ciphertext)));
    } catch (error) {
      throw new Error(`解密本地保管库失败：${this.readErrorMessage(error)}`);
    }
  }

  private unwrapVaultKey(record: EncryptedVaultRecord, password: string): Uint8Array {
    return this.unwrapVaultKeyWithPassword(record, password);
  }

  private unwrapVaultKeyWithPassword(record: EncryptedVaultRecord, password: string): Uint8Array {
    let wrappingKey: cryptoFramework.SymKey = this.createAesKey(password, this.decodeBase64(record.kdf.salt), record.kdf.iterations);
    return this.decryptGcm(
      wrappingKey,
      this.decodeBase64(record.keyEncryption.iv),
      this.decodeBase64(record.keyEncryption.ciphertext)
    );
  }

  private createAesKey(password: string, salt: Uint8Array, iterations: number): cryptoFramework.SymKey {
    let spec: cryptoFramework.PBKDF2Spec = {
      algName: KDF_NAME,
      password: password,
      salt: salt,
      iterations: iterations,
      keySize: AES_KEY_SIZE
    };
    try {
      let kdf: cryptoFramework.Kdf = cryptoFramework.createKdf(KDF_ALGORITHM);
      let keyBytes: Uint8Array = kdf.generateSecretSync(spec).data;
      return cryptoFramework.createSymKeyGenerator(AES_ALGORITHM).convertKeySync({ data: keyBytes });
    } catch (error) {
      throw new Error(`派生本地保管库密钥失败：${this.readErrorMessage(error)}`);
    }
  }

  private encryptGcm(key: cryptoFramework.SymKey, iv: Uint8Array, plaintext: Uint8Array): Uint8Array {
    try {
      let cipher: cryptoFramework.Cipher = cryptoFramework.createCipher(AES_CIPHER);
      cipher.initSync(cryptoFramework.CryptoMode.ENCRYPT_MODE, key, this.createGcmParams(iv, new Uint8Array(TAG_SIZE)));
      return cipher.doFinalSync({ data: plaintext }).data;
    } catch (error) {
      throw new Error(`本地 AES-GCM 加密失败：${this.readErrorMessage(error)}`);
    }
  }

  private decryptGcm(key: cryptoFramework.SymKey, iv: Uint8Array, encryptedWithTag: Uint8Array): Uint8Array {
    try {
      if (encryptedWithTag.length < TAG_SIZE) {
        throw new Error('本地保管库密文缺少认证标签。');
      }
      let splitIndex: number = encryptedWithTag.length - TAG_SIZE;
      let ciphertext: Uint8Array = this.sliceBytes(encryptedWithTag, 0, splitIndex);
      let authTag: Uint8Array = this.sliceBytes(encryptedWithTag, splitIndex, encryptedWithTag.length);
      let cipher: cryptoFramework.Cipher = cryptoFramework.createCipher(AES_CIPHER);
      cipher.initSync(cryptoFramework.CryptoMode.DECRYPT_MODE, key, this.createGcmParams(iv, authTag));
      return cipher.doFinalSync({ data: ciphertext }).data;
    } catch (error) {
      throw new Error(`本地 AES-GCM 解密失败：${this.readErrorMessage(error)}`);
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

  private tryParseEncryptedPayload(payload: string): EncryptedVaultRecord | null {
    if (payload.length === 0) {
      return null;
    }
    return this.parseEncryptedPayload(payload);
  }

  private parseEncryptedPayload(payload: string): EncryptedVaultRecord {
    let parsed: Record<string, Object>;
    try {
      parsed = JSON.parse(payload) as Record<string, Object>;
    } catch (error) {
      throw new Error(`本地保管库格式损坏，无法解析：${this.readErrorMessage(error)}`);
    }
    let kdf: Record<string, Object> = this.readRecord(parsed, 'kdf');
    let keyEncryption: Record<string, Object> = this.readRecord(parsed, 'keyEncryption');
    let vaultEncryption: Record<string, Object> = this.readRecord(parsed, 'vaultEncryption');
    let record: EncryptedVaultRecord = new EncryptedVaultRecord(
      this.readNumber(parsed, 'formatVersion', 0),
      this.readString(parsed, 'vaultId', ''),
      new KdfRecord(
        this.readString(kdf, 'name', ''),
        this.readNumber(kdf, 'iterations', 0),
        this.readString(kdf, 'hash', ''),
        this.readString(kdf, 'salt', '')
      ),
      new AesGcmRecord(
        this.readString(keyEncryption, 'cipher', ''),
        this.readString(keyEncryption, 'iv', ''),
        this.readString(keyEncryption, 'ciphertext', '')
      ),
      new AesGcmRecord(
        this.readString(vaultEncryption, 'cipher', ''),
        this.readString(vaultEncryption, 'iv', ''),
        this.readString(vaultEncryption, 'ciphertext', '')
      ),
      this.readString(parsed, 'updatedAt', '')
    );
    return record;
  }

  private readRecord(record: Record<string, Object>, key: string): Record<string, Object> {
    let value: Object | undefined = record[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, Object>;
    }
    return {};
  }

  private assertSupportedRecord(record: EncryptedVaultRecord): void {
    if (record.formatVersion !== FORMAT_VERSION ||
      record.kdf.name !== KDF_NAME ||
      record.kdf.hash !== KDF_HASH ||
      record.kdf.iterations !== KDF_ITERATIONS ||
      record.keyEncryption.cipher !== CIPHER ||
      record.vaultEncryption.cipher !== CIPHER) {
      throw new Error('本地加密保管库格式暂不支持。');
    }
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

  private sliceBytes(bytes: Uint8Array, start: number, end: number): Uint8Array {
    let sliced: Uint8Array = new Uint8Array(end - start);
    sliced.set(bytes.subarray(start, end), 0);
    return sliced;
  }

  private createVaultId(): string {
    return `harmony-local-${new Date().getTime()}-${Math.floor(Math.random() * 1000000)}`;
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
