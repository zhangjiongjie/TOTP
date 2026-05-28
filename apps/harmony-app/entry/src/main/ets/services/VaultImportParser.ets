import { LocalVault, createLocalVaultFromJson } from '../model/LocalVault';
import { TotpAccount } from '../model/TotpAccount';

export const VAULT_IMPORT_FORMAT_LOCAL_JSON: string = 'localJson';
export const VAULT_IMPORT_FORMAT_PLAIN: string = 'plain';
export const VAULT_IMPORT_FORMAT_ENCRYPTED_V1: string = 'encryptedV1';
export const VAULT_IMPORT_FORMAT_REMOTE_V2: string = 'remoteV2';

export class VaultImportParseResult {
  format: string;
  vault: LocalVault | undefined;
  encryptedVault: Record<string, Object> | undefined;

  constructor(format: string, vault: LocalVault | undefined = undefined, encryptedVault: Record<string, Object> | undefined = undefined) {
    this.format = format;
    this.vault = vault;
    this.encryptedVault = encryptedVault;
  }
}

export class VaultImportParser {
  static parse(raw: string): VaultImportParseResult {
    let parsed: Record<string, Object> = JSON.parse(raw) as Record<string, Object>;
    let modeValue: Object | undefined = parsed['mode'];
    if (modeValue === 'plain') {
      let vaultValue: Object | undefined = parsed['vault'];
      if (!VaultImportParser.isRecord(vaultValue)) {
        throw new Error('明文备份内容无效。');
      }
      return new VaultImportParseResult(VAULT_IMPORT_FORMAT_PLAIN, VaultImportParser.createLocalVaultFromWebPayload(vaultValue as Record<string, Object>));
    }
    if (modeValue === 'encrypted') {
      let encryptedVaultValue: Object | undefined = parsed['encryptedVault'];
      if (!VaultImportParser.isRecord(encryptedVaultValue)) {
        throw new Error('加密备份内容无效。');
      }
      let encryptedVault: Record<string, Object> = encryptedVaultValue as Record<string, Object>;
      if (VaultImportParser.isRemoteV2Envelope(encryptedVault)) {
        return new VaultImportParseResult(VAULT_IMPORT_FORMAT_REMOTE_V2, undefined, encryptedVault);
      }
      VaultImportParser.assertLegacyEncryptedV1(encryptedVault);
      return new VaultImportParseResult(VAULT_IMPORT_FORMAT_ENCRYPTED_V1, undefined, encryptedVault);
    }

    return new VaultImportParseResult(VAULT_IMPORT_FORMAT_LOCAL_JSON, createLocalVaultFromJson(raw));
  }

  static createLocalVaultFromWebPayload(payload: Record<string, Object>): LocalVault {
    let accountsValue: Object | undefined = payload['accounts'];
    if (!Array.isArray(accountsValue)) {
      throw new Error('备份文件中没有账号列表。');
    }

    let now: string = new Date().toISOString();
    let accounts: TotpAccount[] = [];
    for (let index: number = 0; index < accountsValue.length; index++) {
      let item: Object = accountsValue[index];
      if (VaultImportParser.isRecord(item)) {
        accounts.push(VaultImportParser.createLocalAccountFromWebRecord(item as Record<string, Object>, index, now));
      }
    }

    return new LocalVault(1, now, accounts);
  }

  private static isRemoteV2Envelope(encryptedVault: Record<string, Object>): boolean {
    return VaultImportParser.readNumber(encryptedVault, 'formatVersion', 0) === 2 &&
      VaultImportParser.isRecord(encryptedVault['keyEncryption']) &&
      VaultImportParser.isRecord(encryptedVault['vaultEncryption']);
  }

  private static assertLegacyEncryptedV1(encryptedVault: Record<string, Object>): void {
    let kdfValue: Object | undefined = encryptedVault['kdf'];
    if (!VaultImportParser.isRecord(kdfValue)) {
      throw new Error('加密备份缺少 KDF 参数。');
    }
    let kdf: Record<string, Object> = kdfValue as Record<string, Object>;
    if (VaultImportParser.readNumber(encryptedVault, 'formatVersion', 0) !== 1 ||
      VaultImportParser.readString(kdf, 'name', '') !== 'PBKDF2' ||
      VaultImportParser.readNumber(kdf, 'iterations', 0) !== 310000 ||
      VaultImportParser.readString(kdf, 'hash', '') !== 'SHA-256' ||
      VaultImportParser.readString(encryptedVault, 'cipher', '') !== 'AES-GCM') {
      throw new Error('加密备份格式暂不支持。');
    }
  }

  private static createLocalAccountFromWebRecord(record: Record<string, Object>, index: number, now: string): TotpAccount {
    return new TotpAccount(
      VaultImportParser.readString(record, 'id', `imported-${new Date().getTime()}-${index}`),
      VaultImportParser.readString(record, 'issuer', ''),
      VaultImportParser.readString(record, 'accountName', ''),
      VaultImportParser.readString(record, 'secret', ''),
      VaultImportParser.readNumber(record, 'digits', 6),
      VaultImportParser.readNumber(record, 'period', 30),
      VaultImportParser.readString(record, 'algorithm', 'SHA1'),
      VaultImportParser.readGroupName(record),
      VaultImportParser.readString(record, 'iconKey', ''),
      VaultImportParser.readString(record, 'updatedAt', now)
    );
  }

  private static readGroupName(record: Record<string, Object>): string {
    let tagsValue: Object | undefined = record['tags'];
    if (Array.isArray(tagsValue) && tagsValue.length > 0 && typeof tagsValue[0] === 'string') {
      return tagsValue[0] as string;
    }
    return 'Default';
  }

  private static isRecord(value: Object | undefined): boolean {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private static readString(record: Record<string, Object>, key: string, fallback: string): string {
    let value: Object | undefined = record[key];
    return typeof value === 'string' ? value : fallback;
  }

  private static readNumber(record: Record<string, Object>, key: string, fallback: number): number {
    let value: Object | undefined = record[key];
    return typeof value === 'number' ? value : fallback;
  }
}
