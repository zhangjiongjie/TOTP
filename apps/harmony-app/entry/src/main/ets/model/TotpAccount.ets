export interface TotpAccountRecord {
  id: string;
  issuer: string;
  accountName: string;
  secret: string;
  digits: number;
  period: number;
  algorithm: string;
  groupName: string;
  iconKey: string;
  updatedAt: string;
}

export class TotpAccount {
  id: string;
  issuer: string;
  accountName: string;
  secret: string;
  digits: number;
  period: number;
  algorithm: string;
  groupName: string;
  iconKey: string;
  updatedAt: string;

  constructor(
    id: string,
    issuer: string,
    accountName: string,
    secret: string,
    digits: number,
    period: number,
    algorithm: string,
    groupName: string,
    iconKey: string,
    updatedAt: string
  ) {
    this.id = id;
    this.issuer = issuer;
    this.accountName = accountName;
    this.secret = secret;
    this.digits = digits;
    this.period = period;
    this.algorithm = algorithm;
    this.groupName = groupName;
    this.iconKey = iconKey;
    this.updatedAt = updatedAt;
  }

  toRecord(): TotpAccountRecord {
    return {
      id: this.id,
      issuer: this.issuer,
      accountName: this.accountName,
      secret: this.secret,
      digits: this.digits,
      period: this.period,
      algorithm: this.algorithm,
      groupName: this.groupName,
      iconKey: this.iconKey,
      updatedAt: this.updatedAt
    };
  }
}

function readString(value: Object | undefined, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function readNumber(value: Object | undefined, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

export function createTotpAccountFromRecord(record: Record<string, Object>): TotpAccount {
  return new TotpAccount(
    readString(record['id'], ''),
    readString(record['issuer'], ''),
    readString(record['accountName'], ''),
    readString(record['secret'], ''),
    readNumber(record['digits'], 6),
    readNumber(record['period'], 30),
    readString(record['algorithm'], 'SHA1'),
    readString(record['groupName'], 'Default'),
    readString(record['iconKey'], ''),
    readString(record['updatedAt'], '')
  );
}
