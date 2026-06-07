import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAppName } from './app-name';

describe('getAppName', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses Chrome localized app name when available', () => {
    vi.stubGlobal('chrome', {
      i18n: {
        getMessage: vi.fn().mockReturnValue('TOTP密令')
      }
    });

    expect(getAppName()).toBe('TOTP密令');
  });

  it('falls back to TOTP密令 inside Chinese locales', () => {
    vi.stubGlobal('chrome', undefined);
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('zh-CN');
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['zh-CN']);

    expect(getAppName()).toBe('TOTP密令');
  });

  it('falls back to TOTP Token outside Chinese locales', () => {
    vi.stubGlobal('chrome', undefined);
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);

    expect(getAppName()).toBe('TOTP Token');
  });
});
