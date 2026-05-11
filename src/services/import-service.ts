import { parseOtpAuthUri } from '../core/totp/otpauth';
import type { TotpAlgorithm } from '../core/types';
import { decodeQrFromDataUrl, decodeQrFromImageFile } from '../core/import/qr-decode';
import type { AccountDraft, AccountFormValues } from './account-service';

export class ImportServiceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ImportServiceError';
  }
}

export const importService = {
  fromManualForm(values: AccountFormValues): AccountDraft {
    const draft = normalizeDraft({
      issuer: values.issuer,
      accountName: values.accountName,
      secret: values.secret,
      digits: Number(values.digits),
      period: Number(values.period),
      algorithm: values.algorithm,
      groupId: values.groupId
    });

    return draft;
  },

  fromOtpAuthUri(uri: string): AccountDraft {
    const parsed = parseOtpAuthUri(uri.trim());
    return normalizeDraft(parsed);
  },

  async fromQrFile(file: File): Promise<AccountDraft> {
    const otpauthUri = await decodeQrFromImageFile(file);
    return this.fromOtpAuthUri(otpauthUri);
  },

  async fromCurrentTabQr(): Promise<AccountDraft> {
    const imageDataUrl = await captureVisibleTabImage();
    const otpauthUri = await decodeQrFromDataUrl(imageDataUrl);
    return this.fromOtpAuthUri(otpauthUri);
  }
};

function normalizeDraft(input: {
  issuer: string;
  accountName: string;
  secret: string;
  digits: number;
  period: number;
  algorithm: TotpAlgorithm;
  groupId?: string | null;
}): AccountDraft {
  const normalizedAccountName = input.accountName.trim();
  const normalizedIssuer = input.issuer.trim() || normalizedAccountName || 'Imported account';
  const draft: AccountDraft = {
    issuer: normalizedIssuer,
    accountName: normalizedAccountName,
    secret: input.secret.trim().replace(/\s+/g, '').toUpperCase(),
    digits: Number(input.digits),
    period: Number(input.period),
    algorithm: input.algorithm,
    groupId: input.groupId ?? 'default'
  };

  if (!draft.accountName) {
    throw new ImportServiceError('Account name is required.');
  }

  if (!draft.secret) {
    throw new ImportServiceError('Secret is required.');
  }

  if (!Number.isInteger(draft.digits) || draft.digits < 6 || draft.digits > 8) {
    throw new ImportServiceError('Digits must be a whole number between 6 and 8.');
  }

  if (!Number.isInteger(draft.period) || draft.period < 15 || draft.period > 120) {
    throw new ImportServiceError('Period must be a whole number between 15 and 120.');
  }

  return draft;
}

async function captureVisibleTabImage(): Promise<string> {
  const tabsApi = (
    globalThis as typeof globalThis & {
      chrome?: {
        tabs?: {
          captureVisibleTab(
            windowId?: number,
            options?: { format?: 'jpeg' | 'png'; quality?: number },
            callback?: (dataUrl?: string) => void
          ): void;
        };
        runtime?: { lastError?: { message?: string } };
      };
    }
  ).chrome?.tabs;

  if (!tabsApi?.captureVisibleTab) {
    throw new ImportServiceError('当前浏览器暂不支持扫描当前网页，请改用图片上传。');
  }

  return new Promise((resolve, reject) => {
    tabsApi.captureVisibleTab(undefined, { format: 'png' }, (dataUrl) => {
      const lastError = (
        globalThis as typeof globalThis & {
          chrome?: { runtime?: { lastError?: { message?: string } } };
        }
      ).chrome?.runtime?.lastError;

      if (lastError) {
        reject(
          new ImportServiceError(
            lastError.message ?? '无法读取当前网页内容，请改用图片上传。'
          )
        );
        return;
      }

      if (!dataUrl) {
        reject(new ImportServiceError('当前网页中未读取到可扫描的图像，请改用图片上传。'));
        return;
      }

      resolve(dataUrl);
    });
  });
}
