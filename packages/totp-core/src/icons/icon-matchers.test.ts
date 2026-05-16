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

it('matches common social and commerce issuers', () => {
  expect(resolveIconKey({ issuer: 'Facebook', accountName: 'alice' })).toBe('facebook');
  expect(resolveIconKey({ issuer: 'Instagram', accountName: 'alice' })).toBe('instagram');
  expect(resolveIconKey({ issuer: 'TikTok', accountName: 'alice' })).toBe('tiktok');
  expect(resolveIconKey({ issuer: 'Reddit', accountName: 'alice' })).toBe('reddit');
  expect(resolveIconKey({ issuer: 'WhatsApp', accountName: 'alice' })).toBe('whatsapp');
  expect(resolveIconKey({ issuer: 'Amazon', accountName: 'alice' })).toBe('amazon');
  expect(resolveIconKey({ issuer: 'AWS', accountName: 'alice' })).toBe('aws');
  expect(resolveIconKey({ issuer: 'Amazon Web Services', accountName: 'alice' })).toBe('aws');
  expect(resolveIconKey({ issuer: 'Zoom', accountName: 'alice' })).toBe('zoom');
  expect(resolveIconKey({ issuer: 'Yahoo', accountName: 'alice' })).toBe('yahoo');
});

it('matches productivity, cloud, payment, and game issuers', () => {
  expect(resolveIconKey({ issuer: 'Steam', accountName: 'alice' })).toBe('steam');
  expect(resolveIconKey({ issuer: 'Canva', accountName: 'alice' })).toBe('canva');
  expect(resolveIconKey({ issuer: 'Stripe', accountName: 'alice' })).toBe('stripe');
  expect(resolveIconKey({ issuer: 'Binance', accountName: 'alice' })).toBe('binance');
  expect(resolveIconKey({ issuer: 'Coinbase', accountName: 'alice' })).toBe('coinbase');
  expect(resolveIconKey({ issuer: 'Cloudflare', accountName: 'alice' })).toBe('cloudflare');
  expect(resolveIconKey({ issuer: 'Twitch', accountName: 'alice' })).toBe('twitch');
});
