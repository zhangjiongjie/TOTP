declare module '*.svg?raw' {
  const content: string;
  export default content;
}

interface ChromeI18nRuntime {
  getMessage(name: string): string;
}

interface ChromeRuntimeGlobal {
  i18n?: ChromeI18nRuntime;
}

interface Window {
  chrome?: ChromeRuntimeGlobal;
}

declare var chrome: ChromeRuntimeGlobal | undefined;
