import { http } from '@kit.NetworkKit';
import { util } from '@kit.ArkTS';
import { LocalVault } from '../model/LocalVault';
import { WebDavSettings } from '../model/WebDavSettings';
import { EncryptedRemoteVaultBlob, RemoteVaultCryptoService, RemoteVaultDecryption } from './RemoteVaultCryptoService';

interface WebDavRemoteEnvelopeRecord {
  schemaVersion: number;
  revision: string;
  updatedAt: string;
  encryptedVault: EncryptedRemoteVaultBlob;
}

export class WebDavRemoteSnapshot {
  revision: string;
  updatedAt: string;
  etag: string;
  vault: LocalVault;
  encryptedVault: EncryptedRemoteVaultBlob;
  vaultKey: Uint8Array;

  constructor(revision: string, updatedAt: string, etag: string, vault: LocalVault, encryptedVault: EncryptedRemoteVaultBlob, vaultKey: Uint8Array) {
    this.revision = revision;
    this.updatedAt = updatedAt;
    this.etag = etag;
    this.vault = vault;
    this.encryptedVault = encryptedVault;
    this.vaultKey = vaultKey;
  }
}

export class WebDavUploadResult {
  revision: string;
  etag: string;

  constructor(revision: string, etag: string) {
    this.revision = revision;
    this.etag = etag;
  }
}

export class WebDavClient {
  private cryptoService: RemoteVaultCryptoService = new RemoteVaultCryptoService();

  async download(settings: WebDavSettings): Promise<WebDavRemoteSnapshot | undefined> {
    return this.downloadWithPassword(settings, '');
  }

  async downloadWithPassword(settings: WebDavSettings, remotePassword: string): Promise<WebDavRemoteSnapshot | undefined> {
    let response: http.HttpResponse = await this.request(this.buildVaultUrl(settings), http.RequestMethod.GET, settings, '');
    if (response.responseCode === 404 || response.responseCode === 410) {
      return undefined;
    }
    if (response.responseCode < 200 || response.responseCode >= 300) {
      throw new Error(`WebDAV 下载失败，HTTP ${response.responseCode}`);
    }

    let payload: string = this.readResponseText(response);
    if (payload.trim().length === 0) {
      return undefined;
    }

    let record: Record<string, Object> = JSON.parse(payload) as Record<string, Object>;
    let encryptedVault: EncryptedRemoteVaultBlob = this.cryptoService.parseEncryptedBlob(record['encryptedVault']);
    let decrypted: RemoteVaultDecryption = remotePassword.length > 0
      ? this.cryptoService.decryptWithPassword(encryptedVault, remotePassword)
      : this.cryptoService.decryptWithKey(encryptedVault);
    return new WebDavRemoteSnapshot(
      this.readString(record, 'revision', ''),
      this.readString(record, 'updatedAt', ''),
      this.readEtag(response),
      decrypted.vault,
      encryptedVault,
      decrypted.vaultKey
    );
  }

  async upload(
    settings: WebDavSettings,
    vault: LocalVault,
    revision: string,
    previousEtag: string,
    keySource: WebDavRemoteSnapshot | undefined = undefined
  ): Promise<WebDavUploadResult> {
    let now: string = new Date().toISOString();
    let envelope: WebDavRemoteEnvelopeRecord = {
      schemaVersion: 1,
      revision: revision,
      updatedAt: now,
      encryptedVault: keySource === undefined
        ? this.cryptoService.encrypt(vault)
        : this.cryptoService.encryptWithVaultKey(vault, keySource.encryptedVault, keySource.vaultKey)
    };
    let response: http.HttpResponse = await this.request(
      this.buildVaultUrl(settings),
      http.RequestMethod.PUT,
      settings,
      JSON.stringify(envelope),
      previousEtag
    );
    if (response.responseCode < 200 || response.responseCode >= 300) {
      if (response.responseCode === 409) {
        throw new Error('WebDAV 上传失败，远端目录不存在或路径不可写。请确认保管库路径所在目录已存在。');
      }
      if (response.responseCode === 401 || response.responseCode === 403) {
        throw new Error('WebDAV 上传失败，用户名或密码无效。');
      }
      if (response.responseCode === 412) {
        throw new Error('WebDAV 上传失败，远端版本已变化，请先同步后再保存。');
      }
      throw new Error(`WebDAV 上传失败，HTTP ${response.responseCode}`);
    }
    return new WebDavUploadResult(revision, this.readEtag(response));
  }

  async uploadEncryptedVault(
    settings: WebDavSettings,
    encryptedVault: EncryptedRemoteVaultBlob,
    revision: string,
    previousEtag: string
  ): Promise<WebDavUploadResult> {
    let now: string = new Date().toISOString();
    let envelope: WebDavRemoteEnvelopeRecord = {
      schemaVersion: 1,
      revision: revision,
      updatedAt: now,
      encryptedVault: encryptedVault
    };
    let response: http.HttpResponse = await this.request(
      this.buildVaultUrl(settings),
      http.RequestMethod.PUT,
      settings,
      JSON.stringify(envelope),
      previousEtag
    );
    if (response.responseCode < 200 || response.responseCode >= 300) {
      if (response.responseCode === 409) {
        throw new Error('WebDAV 上传失败，远端目录不存在或路径不可写。请确认保管库路径所在目录已存在。');
      }
      if (response.responseCode === 401 || response.responseCode === 403) {
        throw new Error('WebDAV 上传失败，用户名或密码无效。');
      }
      if (response.responseCode === 412) {
        throw new Error('WebDAV 上传失败，远端版本已变化，请先同步后再保存。');
      }
      throw new Error(`WebDAV 上传失败，HTTP ${response.responseCode}`);
    }
    return new WebDavUploadResult(revision, this.readEtag(response));
  }

  private async request(
    url: string,
    method: http.RequestMethod,
    settings: WebDavSettings,
    body: string,
    previousEtag: string = ''
  ): Promise<http.HttpResponse> {
    let request: http.HttpRequest = http.createHttp();
    let authorization: string = '';
    if (settings.username.length > 0 || settings.password.length > 0) {
      authorization = `Basic ${this.createBasicAuth(settings.username, settings.password)}`;
    }
    let contentType: string = body.length > 0 ? 'application/json; charset=utf-8' : '';
    let headers: Record<string, string> = this.createHeaders(authorization, contentType, previousEtag);

    let options: http.HttpRequestOptions = {
      method: method,
      header: headers,
      extraData: body,
      connectTimeout: 15000,
      readTimeout: 15000,
      usingCache: false,
      expectDataType: http.HttpDataType.STRING
    };

    try {
      return await request.request(url, options);
    } catch (error) {
      throw new Error(`WebDAV 请求失败：${this.readErrorMessage(error)}`);
    } finally {
      request.destroy();
    }
  }

  private createHeaders(authorization: string, contentType: string, previousEtag: string): Record<string, string> {
    let headers: Record<string, string> = {};
    headers['Cache-Control'] = 'no-cache';
    headers['Pragma'] = 'no-cache';
    if (authorization.length > 0) {
      headers['Authorization'] = authorization;
    }
    if (contentType.length > 0) {
      headers['Content-Type'] = contentType;
    }
    if (previousEtag.length > 0) {
      headers['If-Match'] = previousEtag;
    }
    return headers;
  }

  private buildVaultUrl(settings: WebDavSettings): string {
    let serverUrl: string = settings.serverUrl.trim();
    let filePath: string = settings.filePath.trim();
    while (serverUrl.endsWith('/')) {
      serverUrl = serverUrl.substring(0, serverUrl.length - 1);
    }
    if (!filePath.startsWith('/')) {
      filePath = `/${filePath}`;
    }
    return `${serverUrl}${filePath}`;
  }

  private createBasicAuth(username: string, password: string): string {
    try {
      let encoder: util.TextEncoder = new util.TextEncoder('utf-8');
      let bytes: Uint8Array = encoder.encodeInto(`${username}:${password}`);
      let base64: util.Base64Helper = new util.Base64Helper();
      return base64.encodeToStringSync(bytes, util.Type.BASIC);
    } catch (error) {
      throw new Error(`生成 WebDAV 鉴权信息失败：${this.readErrorMessage(error)}`);
    }
  }

  private readResponseText(response: http.HttpResponse): string {
    if (typeof response.result === 'string') {
      return response.result;
    }
    return JSON.stringify(response.result);
  }

  private readEtag(response: http.HttpResponse): string {
    let headers: Record<string, Object> = response.header as Record<string, Object>;
    let keys: string[] = Object.keys(headers);
    for (let index: number = 0; index < keys.length; index++) {
      if (keys[index].toLowerCase() === 'etag') {
        let value: Object | undefined = headers[keys[index]];
        return typeof value === 'string' ? value.trim() : '';
      }
    }
    return '';
  }

  private readString(record: Record<string, Object>, key: string, fallback: string): string {
    let value: Object | undefined = record[key];
    return typeof value === 'string' ? value : fallback;
  }

  private readErrorMessage(error: Object): string {
    let runtimeError: Error = error as Error;
    if (runtimeError && runtimeError.message && runtimeError.message.length > 0) {
      return runtimeError.message;
    }
    return '未知错误';
  }
}
