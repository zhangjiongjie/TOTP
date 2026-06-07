export function getAppName(): string {
  const localizedName = readChromeLocalizedAppName();
  if (localizedName) {
    return localizedName;
  }

  return isChineseLocale() ? 'TOTP密令' : 'TOTP Token';
}

function readChromeLocalizedAppName(): string | null {
  const runtime = typeof chrome === 'undefined' ? undefined : chrome.i18n;
  if (!runtime?.getMessage) {
    return null;
  }

  return runtime.getMessage('appName') || null;
}

function isChineseLocale(): boolean {
  const locales = [navigator.language, ...navigator.languages]
    .filter((locale): locale is string => Boolean(locale));
  return locales.some((locale) => locale.toLowerCase().startsWith('zh'));
}
