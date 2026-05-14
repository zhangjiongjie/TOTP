import { TotpAccount, TotpAccountRecord, createTotpAccountFromRecord } from './TotpAccount';

export interface LocalVaultRecord {
  schemaVersion: number;
  updatedAt: string;
  accounts: TotpAccountRecord[];
}

export class LocalVault {
  schemaVersion: number;
  updatedAt: string;
  accounts: TotpAccount[];

  constructor(schemaVersion: number, updatedAt: string, accounts: TotpAccount[]) {
    this.schemaVersion = schemaVersion;
    this.updatedAt = updatedAt;
    this.accounts = accounts;
  }

  toRecord(): LocalVaultRecord {
    let records: TotpAccountRecord[] = [];
    for (let index = 0; index < this.accounts.length; index++) {
      records.push(this.accounts[index].toRecord());
    }

    return {
      schemaVersion: this.schemaVersion,
      updatedAt: this.updatedAt,
      accounts: records
    };
  }
}

function readString(value: Object | undefined, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function readNumber(value: Object | undefined, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

function readAccounts(value: Object | undefined): TotpAccount[] {
  if (!Array.isArray(value)) {
    return [];
  }

  let accounts: TotpAccount[] = [];
  for (let index = 0; index < value.length; index++) {
    let item: Object = value[index];
    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
      accounts.push(createTotpAccountFromRecord(item as Record<string, Object>));
    }
  }
  return accounts;
}

export function createEmptyLocalVault(): LocalVault {
  return new LocalVault(1, '', []);
}

export function createLocalVaultFromJson(payload: string): LocalVault {
  if (payload.length === 0) {
    return createEmptyLocalVault();
  }

  let parsed: Record<string, Object> = JSON.parse(payload) as Record<string, Object>;
  return createLocalVaultFromRecord(parsed);
}

export function createLocalVaultFromRecord(parsed: Record<string, Object>): LocalVault {
  return new LocalVault(
    readNumber(parsed['schemaVersion'], 1),
    readString(parsed['updatedAt'], ''),
    readAccounts(parsed['accounts'])
  );
}
