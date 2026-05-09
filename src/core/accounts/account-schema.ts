import type { AccountRecord, ParsedOtpAuthUri } from '../types';

export function createAccountRecord(
  input: ParsedOtpAuthUri & Pick<AccountRecord, 'id' | 'updatedAt'>,
  overrides?: Partial<
    Pick<AccountRecord, 'tags' | 'groupId' | 'pinned' | 'iconKey'>
  >
): AccountRecord {
  return {
    id: input.id,
    issuer: input.issuer,
    accountName: input.accountName,
    secret: input.secret,
    digits: input.digits,
    period: input.period,
    algorithm: input.algorithm,
    tags: overrides?.tags ? [...overrides.tags] : [],
    groupId: overrides?.groupId ?? null,
    pinned: overrides?.pinned ?? false,
    iconKey: overrides?.iconKey ?? null,
    updatedAt: input.updatedAt
  };
}
