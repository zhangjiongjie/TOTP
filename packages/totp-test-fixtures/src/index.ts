export const rfc6238Sha1Vector = {
  secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
  timestampMillis: 59000,
  period: 30,
  digits: 8,
  algorithm: 'SHA1',
  expected: '94287082'
} as const;

export const base32InvalidInputs = [
  'M',
  'MY===A==',
  'MZX=====',
  'MZ'
] as const;

export const otpAuthSamples = {
  issuerAndAccount:
    'otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub',
  encodedColon:
    'otpauth://totp/alice%3Awork?secret=JBSWY3DPEHPK3PXP',
  defaults:
    'otpauth://totp/alice?secret=JBSWY3DPEHPK3PXP',
  nonDecimalDigits:
    'otpauth://totp/alice?secret=JBSWY3DPEHPK3PXP&digits=1e2',
  malformedLabel:
    'otpauth://totp/%E0?secret=JBSWY3DPEHPK3PXP',
  malformedSecret:
    'otpauth://totp/alice?secret=%E0',
  malformedIssuer:
    'otpauth://totp/alice?secret=JBSWY3DPEHPK3PXP&issuer=%E0'
} as const;

export const accountFixture = {
  id: 'fixture-google-alice',
  issuer: 'Google',
  accountName: 'alice@example.com',
  secret: 'JBSWY3DPEHPK3PXP',
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
  group: 'Default',
  createdAt: 1779010000000,
  updatedAt: 1779010000000
} as const;

export const demoSeedDrafts = [
  {
    issuer: 'GitHub',
    accountName: 'alice@company.com',
    secret: 'JBSWY3DPEHPK3PXP',
    digits: 6,
    period: 30,
    algorithm: 'SHA1' as const
  },
  {
    issuer: 'Google',
    accountName: 'product.team@gmail.com',
    secret: 'GEZDGNBVGY3TQOJQ',
    digits: 6,
    period: 30,
    algorithm: 'SHA1' as const
  },
  {
    issuer: 'Microsoft',
    accountName: 'contoso.dev@outlook.com',
    secret: 'JBSWY3DPFQQFO33S',
    digits: 6,
    period: 30,
    algorithm: 'SHA1' as const
  },
  {
    issuer: 'OpenAI',
    accountName: 'workspace-owner',
    secret: 'KRSXG5DSNFXGOIDB',
    digits: 6,
    period: 30,
    algorithm: 'SHA256' as const
  },
  {
    issuer: 'Slack',
    accountName: 'design-ops',
    secret: 'MZXW6YTBOI======',
    digits: 6,
    period: 30,
    algorithm: 'SHA1' as const
  }
] as const;
