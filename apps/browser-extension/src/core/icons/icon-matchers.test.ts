import { expect, it } from 'vitest';
import { resolveIconKey } from './icon-matchers';

it('matches GitHub issuer to github icon', () => {
  expect(resolveIconKey({ issuer: 'GitHub', accountName: 'alice' })).toBe(
    'github'
  );
});
