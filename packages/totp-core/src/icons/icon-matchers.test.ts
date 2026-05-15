import { expect, it } from 'vitest';
import { resolveIconKey } from './icon-matchers';

it('matches GitHub issuer to github icon', () => {
  expect(resolveIconKey({ issuer: 'GitHub', accountName: 'alice' })).toBe(
    'github'
  );
});

it('matches Bitwarden issuer to bitwarden icon', () => {
  expect(resolveIconKey({ issuer: 'Bitwarden', accountName: 'alice' })).toBe(
    'bitwarden'
  );
});

it('falls back to the default icon for unknown issuers', () => {
  expect(resolveIconKey({ issuer: 'Internal VPN', accountName: 'alice' })).toBe(
    'default'
  );
});

it('matches PayPal issuer to paypal icon', () => {
  expect(resolveIconKey({ issuer: 'PayPAL', accountName: 'alice@outlook.com' })).toBe(
    'paypal'
  );
});

it('matches Mobiwire GitLab issuer to gitlab icon', () => {
  expect(resolveIconKey({ issuer: 'git01.mobiwire.com', accountName: 'alice' })).toBe(
    'gitlab'
  );
});
