import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { buffer, util } from '@kit.ArkTS';
import { BusinessError } from '@kit.BasicServicesKit';
import { LocalVault } from '../model/LocalVault';
import { TotpAccount } from '../model/TotpAccount';
import { resolveIconKey } from './BrandIconMatcher';
import { UnlockService } from './UnlockService';
import { resolveTotpAlgorithm } from '../shared/TotpAlgorithm';

const REMOTE_FORMAT_VERSION: number = 2;
const REMOTE_KDF_NAME: string = 'PBKDF2';
const REMOTE_KDF_HASH: string = 'SHA-256';
const REMOTE_KDF_ALGORITHM: string = 'PBKDF2|SHA256';
const REMOTE_KDF_ITERATIONS: number = 310000;
const REMOTE_CIPHER: string = 'AES-GCM';
const REMOTE_AES_KEY_SIZE: number = 32;
const REMOTE_AES_ALGORITHM: string = 'AES256';
const REMOTE_AES_CIPHER: string = 'AES256|GCM|PKCS7';
const REMOTE_SALT_SIZE: number = 16;
const REMOTE_IV_SIZE: number = 12;
const REMOTE_TAG_SIZE: number = 16;

class RemoteKdfRecord {
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

class RemoteAesGcmRecord {
  cipher: string;
  iv: string;
  ciphertext: string;

  constructor(cipher: string, iv: string, ciphertext: string) {
    this.cipher = cipher;
    this.iv = iv;
    this.ciphertext = ciphertext;
  }
}

export class EncryptedRemoteVaultBlob {
  formatVersion: number;
  vaultId: string;
  kdf: RemoteKdfRecord;
  keyEncryption: RemoteAesGcmRecord;
  vaultEncryption: RemoteAesGcmRecord;

  constructor(
    formatVersion: number,
    vaultId: string,
    kdf: RemoteKdfRecord,
    keyEncryption: RemoteAesGcmRecord,
    vaultEncryption: RemoteAesGcmRecord
  ) {
    this.formatVersion = formatVersion;
    this.vaultId = vaultId;
    this.kdf = kdf;
    this.keyEncryption = keyEncryption;
    this.vaultEncryption = vaultEncryption;
  }
}

export class RemoteVaultDecryption {
  vault: LocalVault;
  vaultKey: Uint8Array;

  constructor(vault: LocalVault, vaultKey: Uint8Array) {
    this.vault = vault;
    this.vaultKey = vaultKey;
  }
}

interface RemoteAccountRecord {
  id: string;
  issuer: string;
  accountName: string;
  secret: string;
  digits: number;
  period: number;
  algorithm: string;
  tags: string[];
  groupId: string | null;
  pinned: boolean;
  iconKey: string | null;
  updatedAt: string;
}

interface RemoteVaultRecord {
  version: number;
  accounts: RemoteAccountRecord[];
}

export class RemoteVaultCryptoService {
  encrypt(vault: LocalVault): EncryptedRemoteVaultBlob {
    try {
      let password: string = UnlockService.getInstance().requireVaultPassword();
      let salt: Uint8Array = cryptoFramework.createRandom().generateRandomSync(REMOTE_SALT_SIZE).data;
      let keyIv: Uint8Array = cryptoFramework.createRandom().generateRandomSync(REMOTE_IV_SIZE).data;
      let vaultIv: Uint8Array = cryptoFramework.createRandom().generateRandomSync(REMOTE_IV_SIZE).data;
      let vaultKeyBytes: Uint8Array = cryptoFramework.createRandom().generateRandomSync(REMOTE_AES_KEY_SIZE).data;
      let wrappingKey: cryptoFramework.SymKey = this.createAesKey(password, salt, REMOTE_KDF_ITERATIONS);
      let vaultKey: cryptoFramework.SymKey = cryptoFramework.createSymKeyGenerator(REMOTE_AES_ALGORITHM).convertKeySync({ data: vaultKeyBytes });
      let encryptedVaultKey: Uint8Array = this.encryptGcm(wrappingKey, keyIv, vaultKeyBytes);
      let encryptedVault: Uint8Array = this.encryptGcm(vaultKey, vaultIv, this.encodeUtf8(this.createRemoteVaultPayload(vault)));
      return new EncryptedRemoteVaultBlob(
        REMOTE_FORMAT_VERSION,
        this.createVaultId(),
        new RemoteKdfRecord(REMOTE_KDF_NAME, REMOTE_KDF_ITERATIONS, REMOTE_KDF_HASH, this.encodeBase64(salt)),
        new RemoteAesGcmRecord(REMOTE_CIPHER, this.encodeBase64(keyIv), this.encodeBase64(encryptedVaultKey)),
        new RemoteAesGcmRecord(REMOTE_CIPHER, this.encodeBase64(vaultIv), this.encodeBase64(encryptedVault))
      );
    } catch (error) {
      throw new Error(`加密 WebDAV 保管库失败：${this.readErrorMessage(error)}`);
    }
  }

  decrypt(blob: EncryptedRemoteVaultBlob): LocalVault {
    return this.decryptWithKey(blob).vault;
  }

  decryptWithKey(blob: EncryptedRemoteVaultBlob): RemoteVaultDecryption {
    let password: string = UnlockService.getInstance().requireVaultPassword();
    return this.decryptWithPassword(blob, password);
  }

  decryptWithPassword(blob: EncryptedRemoteVaultBlob, password: string): RemoteVaultDecryption {
    try {
      this.assertSupportedBlob(blob);
      let salt: Uint8Array = this.decodeBase64(blob.kdf.salt);
      let wrappingKey: cryptoFramework.SymKey = this.createAesKey(password, salt, blob.kdf.iterations);
      let vaultKeyBytes: Uint8Array = this.decryptGcm(
        wrappingKey,
        this.decodeBase64(blob.keyEncryption.iv),
        this.decodeBase64(blob.keyEncryption.ciphertext)
      );
      let vaultKey: cryptoFramework.SymKey = cryptoFramework.createSymKeyGenerator(REMOTE_AES_ALGORITHM).convertKeySync({ data: vaultKeyBytes });
      let plaintext: Uint8Array = this.decryptGcm(
        vaultKey,
        this.decodeBase64(blob.vaultEncryption.iv),
        this.decodeBase64(blob.vaultEncryption.ciphertext)
      );
      return new RemoteVaultDecryption(this.createLocalVaultFromRemotePayload(this.decodeUtf8(plaintext)), vaultKeyBytes);
    } catch (error) {
      throw new Error(`解密 WebDAV 保管库失败：${this.readErrorMessage(error)}`);
    }
  }

  rewrapKeyEncryption(existingBlob: EncryptedRemoteVaultBlob, nextPassword: string, vaultKeyBytes: Uint8Array): EncryptedRemoteVaultBlob {
    try {
      this.assertSupportedBlob(existingBlob);
      let salt: Uint8Array = cryptoFramework.createRandom().generateRandomSync(REMOTE_SALT_SIZE).data;
      let keyIv: Uint8Array = cryptoFramework.createRandom().generateRandomSync(REMOTE_IV_SIZE).data;
      let wrappingKey: cryptoFramework.SymKey = this.createAesKey(nextPassword, salt, REMOTE_KDF_ITERATIONS);
      let encryptedVaultKey: Uint8Array = this.encryptGcm(wrappingKey, keyIv, vaultKeyBytes);
      return new EncryptedRemoteVaultBlob(
        existingBlob.formatVersion,
        existingBlob.vaultId,
        new RemoteKdfRecord(REMOTE_KDF_NAME, REMOTE_KDF_ITERATIONS, REMOTE_KDF_HASH, this.encodeBase64(salt)),
        new RemoteAesGcmRecord(REMOTE_CIPHER, this.encodeBase64(keyIv), this.encodeBase64(encryptedVaultKey)),
        existingBlob.vaultEncryption
      );
    } catch (error) {
      throw new Error(`重新保护 WebDAV 保管库密钥失败：${this.readErrorMessage(error)}`);
    }
  }

  encryptWithVaultKey(vault: LocalVault, existingBlob: EncryptedRemoteVaultBlob, vaultKeyBytes: Uint8Array): EncryptedRemoteVaultBlob {
    try {
      this.assertSupportedBlob(existingBlob);
      let vaultIv: Uint8Array = cryptoFramework.createRandom().generateRandomSync(REMOTE_IV_SIZE).data;
      let vaultKey: cryptoFramework.SymKey = cryptoFramework.createSymKeyGenerator(REMOTE_AES_ALGORITHM).convertKeySync({ data: vaultKeyBytes });
      let encryptedVault: Uint8Array = this.encryptGcm(vaultKey, vaultIv, this.encodeUtf8(this.createRemoteVaultPayload(vault)));
      return new EncryptedRemoteVaultBlob(
        existingBlob.formatVersion,
        existingBlob.vaultId,
        existingBlob.kdf,
        existingBlob.keyEncryption,
        new RemoteAesGcmRecord(REMOTE_CIPHER, this.encodeBase64(vaultIv), this.encodeBase64(encryptedVault))
      );
    } catch (error) {
      throw new Error(`使用远端密钥加密 WebDAV 保管库失败：${this.readErrorMessage(error)}`);
    }
  }

  parseEncryptedBlob(value: Object | undefined): EncryptedRemoteVaultBlob {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('WebDAV encryptedVault 字段无效。');
    }
    let record: Record<string, Object> = value as Record<string, Object>;
    let kdfValue: Object | undefined = record['kdf'];
    if (typeof kdfValue !== 'object' || kdfValue === null || Array.isArray(kdfValue)) {
      throw new Error('WebDAV encryptedVault.kdf 字段无效。');
    }
    let kdfRecord: Record<string, Object> = kdfValue as Record<string, Object>;
    let keyEncryption: RemoteAesGcmRecord = this.parseAesGcmRecord(record['keyEncryption']);
    let vaultEncryption: RemoteAesGcmRecord = this.parseAesGcmRecord(record['vaultEncryption']);
    return new EncryptedRemoteVaultBlob(
      this.readNumber(record, 'formatVersion', 0),
      this.readString(record, 'vaultId', ''),
      new RemoteKdfRecord(
        this.readString(kdfRecord, 'name', ''),
        this.readNumber(kdfRecord, 'iterations', 0),
        this.readString(kdfRecord, 'hash', ''),
        this.readString(kdfRecord, 'salt', '')
      ),
      keyEncryption,
      vaultEncryption
    );
  }

  private createRemoteVaultPayload(vault: LocalVault): string {
    let accounts: RemoteAccountRecord[] = [];
    for (let index: number = 0; index < vault.accounts.length; index++) {
      let account: TotpAccount = vault.accounts[index];
      accounts.push({
        id: account.id,
        issuer: account.issuer,
        accountName: account.accountName,
        secret: account.secret,
        digits: account.digits,
        period: account.period,
        algorithm: this.normalizeAlgorithm(account.algorithm),
        tags: [],
        groupId: this.toRemoteGroupId(account.groupName),
        pinned: false,
        iconKey: resolveIconKey(account.issuer, account.accountName),
        updatedAt: account.updatedAt
      });
    }
    let payload: RemoteVaultRecord = {
      version: 1,
      accounts: accounts
    };
    return JSON.stringify(payload);
  }

  private createLocalVaultFromRemotePayload(payload: string): LocalVault {
    let parsed: Record<string, Object> = JSON.parse(payload) as Record<string, Object>;
    let accountsValue: Object | undefined = parsed['accounts'];
    let accounts: TotpAccount[] = [];
    if (Array.isArray(accountsValue)) {
      for (let index: number = 0; index < accountsValue.length; index++) {
        let accountValue: Object = accountsValue[index];
        if (typeof accountValue === 'object' && accountValue !== null && !Array.isArray(accountValue)) {
          accounts.push(this.createLocalAccount(accountValue as Record<string, Object>));
        }
      }
    }
    return new LocalVault(1, new Date().toISOString(), accounts);
  }

  private createLocalAccount(record: Record<string, Object>): TotpAccount {
    let issuer: string = this.readString(record, 'issuer', '');
    let accountName: string = this.readString(record, 'accountName', '');
    let resolvedIconKey: string = resolveIconKey(issuer, accountName);
    return new TotpAccount(
      this.readString(record, 'id', `remote-${Date.now()}`),
      issuer,
      accountName,
      this.readString(record, 'secret', ''),
      this.readNumber(record, 'digits', 6),
      this.readNumber(record, 'period', 30),
      this.normalizeAlgorithm(this.readString(record, 'algorithm', 'SHA1')),
      this.toLocalGroupName(this.readNullableString(record, 'groupId', 'default')),
      resolvedIconKey,
      this.readString(record, 'updatedAt', new Date().toISOString())
    );
  }

  private assertSupportedBlob(blob: EncryptedRemoteVaultBlob): void {
    if (blob.formatVersion !== REMOTE_FORMAT_VERSION ||
      blob.kdf.name !== REMOTE_KDF_NAME ||
      blob.kdf.hash !== REMOTE_KDF_HASH ||
      blob.kdf.iterations !== REMOTE_KDF_ITERATIONS ||
      blob.keyEncryption.cipher !== REMOTE_CIPHER ||
      blob.vaultEncryption.cipher !== REMOTE_CIPHER) {
      throw new Error('WebDAV 加密保管库格式暂不支持。');
    }
  }

  private createAesKey(password: string, salt: Uint8Array, iterations: number): cryptoFramework.SymKey {
    let spec: cryptoFramework.PBKDF2Spec = {
      algName: REMOTE_KDF_NAME,
      password: password,
      salt: salt,
      iterations: iterations,
      keySize: REMOTE_AES_KEY_SIZE
    };
    try {
      let kdf: cryptoFramework.Kdf = cryptoFramework.createKdf(REMOTE_KDF_ALGORITHM);
      let keyBytes: Uint8Array = kdf.generateSecretSync(spec).data;
      return cryptoFramework.createSymKeyGenerator(REMOTE_AES_ALGORITHM).convertKeySync({ data: keyBytes });
    } catch (error) {
      throw new Error(`派生 WebDAV 保管库密钥失败：${this.readErrorMessage(error)}`);
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

  private encryptGcm(key: cryptoFramework.SymKey, iv: Uint8Array, plaintext: Uint8Array): Uint8Array {
    try {
      let params: cryptoFramework.GcmParamsSpec = this.createGcmParams(iv, new Uint8Array(REMOTE_TAG_SIZE));
      let cipher: cryptoFramework.Cipher = cryptoFramework.createCipher(REMOTE_AES_CIPHER);
      cipher.initSync(cryptoFramework.CryptoMode.ENCRYPT_MODE, key, params);
      return cipher.doFinalSync({ data: plaintext }).data;
    } catch (error) {
      throw new Error(`WebDAV AES-GCM 加密失败：${this.readErrorMessage(error)}`);
    }
  }

  private decryptGcm(key: cryptoFramework.SymKey, iv: Uint8Array, encryptedWithTag: Uint8Array): Uint8Array {
    try {
      if (encryptedWithTag.length < REMOTE_TAG_SIZE) {
        throw new Error('远端保管库密文缺少认证标签。');
      }
      let splitIndex: number = encryptedWithTag.length - REMOTE_TAG_SIZE;
      let ciphertext: Uint8Array = this.sliceBytes(encryptedWithTag, 0, splitIndex);
      let authTag: Uint8Array = this.sliceBytes(encryptedWithTag, splitIndex, encryptedWithTag.length);
      let params: cryptoFramework.GcmParamsSpec = this.createGcmParams(iv, authTag);
      let cipher: cryptoFramework.Cipher = cryptoFramework.createCipher(REMOTE_AES_CIPHER);
      cipher.initSync(cryptoFramework.CryptoMode.DECRYPT_MODE, key, params);
      return cipher.doFinalSync({ data: ciphertext }).data;
    } catch (error) {
      throw new Error(`WebDAV AES-GCM 解密失败：${this.readErrorMessage(error)}`);
    }
  }

  private parseAesGcmRecord(value: Object | undefined): RemoteAesGcmRecord {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('WebDAV encryptedVault AES-GCM 字段无效。');
    }
    let record: Record<string, Object> = value as Record<string, Object>;
    return new RemoteAesGcmRecord(
      this.readString(record, 'cipher', ''),
      this.readString(record, 'iv', ''),
      this.readString(record, 'ciphertext', '')
    );
  }

  private createVaultId(): string {
    return `harmony-${new Date().getTime()}-${Math.floor(Math.random() * 1000000)}`;
  }

  private toRemoteGroupId(groupName: string): string {
    let normalized: string = groupName.trim().toLowerCase();
    if (normalized === 'personal') {
      return 'personal';
    }
    if (normalized === 'work') {
      return 'work';
    }
    return 'default';
  }

  private toLocalGroupName(groupId: string): string {
    let normalized: string = groupId.trim().toLowerCase();
    if (normalized === 'personal') {
      return 'Personal';
    }
    if (normalized === 'work') {
      return 'Work';
    }
    return 'Default';
  }

  private normalizeAlgorithm(value: string): string {
    return resolveTotpAlgorithm(value, 'SHA1');
  }

  private readString(record: Record<string, Object>, key: string, fallback: string): string {
    let value: Object | undefined = record[key];
    return typeof value === 'string' ? value : fallback;
  }

  private readNullableString(record: Record<string, Object>, key: string, fallback: string): string {
    let value: Object | undefined = record[key];
    if (typeof value === 'string') {
      return value;
    }
    return fallback;
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
    return new util.Base64Helper().encodeToStringSync(bytes, util.Type.BASIC);
  }

  private decodeBase64(value: string): Uint8Array {
    return new util.Base64Helper().decodeSync(value, util.Type.BASIC);
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
