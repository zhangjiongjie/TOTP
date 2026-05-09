export type TotpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';

export interface AccountRecord {
  id: string;
  issuer: string;
  accountName: string;
  secret: string;
  digits: number;
  period: number;
  algorithm: TotpAlgorithm;
  tags: string[];
  groupId: string | null;
  pinned: boolean;
  iconKey: string | null;
  updatedAt: string;
}

export interface TotpConfig {
  secret: string;
  digits: number;
  period: number;
  algorithm: TotpAlgorithm;
  timestamp?: number;
}

export interface ParsedOtpAuthUri {
  issuer: string;
  accountName: string;
  secret: string;
  digits: number;
  period: number;
  algorithm: TotpAlgorithm;
}
