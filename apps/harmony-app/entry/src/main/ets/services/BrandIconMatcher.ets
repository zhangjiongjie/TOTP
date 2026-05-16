// Generated from packages/totp-core/src/icons/icon-matchers-data.json.
// Run npm run generate:harmony-brand-matcher after changing brand rules.

export function resolveIconKey(issuer: string, accountName: string): string {
  let candidates: string[] = [issuer.trim().toLowerCase(), accountName.trim().toLowerCase()];
  for (let index: number = 0; index < candidates.length; index++) {
    let resolvedKey: string = resolveCandidate(candidates[index]);
    if (resolvedKey !== 'default') {
      return resolvedKey;
    }
  }

  return 'default';
}

export function resolveDisplayBrandKey(iconKey: string, issuer: string, accountName: string): string {
  let recognizedKey: string = resolveIconKey(issuer, accountName);
  if (recognizedKey !== 'default') {
    return recognizedKey;
  }

  return 'default';
}

function resolveCandidate(candidate: string): string {
  if (candidate.length === 0) {
    return 'default';
  }
  if (containsWord(candidate, "apple") || containsWord(candidate, "icloud")) {
    return 'apple';
  }
  if (containsWord(candidate, "bitwarden")) {
    return 'bitwarden';
  }
  if (containsWord(candidate, "discord")) {
    return 'discord';
  }
  if (containsWord(candidate, "dropbox")) {
    return 'dropbox';
  }
  if (containsWord(candidate, "facebook") || candidate === "fb") {
    return 'facebook';
  }
  if (candidate.indexOf("github") >= 0) {
    return 'github';
  }
  if (candidate.indexOf("gitlab") >= 0 || candidate === "git01.mobiwire.com") {
    return 'gitlab';
  }
  if (containsWord(candidate, "google") || containsWord(candidate, "gmail")) {
    return 'google';
  }
  if (containsWord(candidate, "instagram")) {
    return 'instagram';
  }
  if (containsWord(candidate, "linkedin")) {
    return 'linkedin';
  }
  if (containsWord(candidate, "aws") || containsWordSequence(candidate, "amazon web services")) {
    return 'aws';
  }
  if (containsWord(candidate, "amazon")) {
    return 'amazon';
  }
  if (containsWord(candidate, "binance")) {
    return 'binance';
  }
  if (containsWord(candidate, "canva")) {
    return 'canva';
  }
  if (containsWord(candidate, "cloudflare")) {
    return 'cloudflare';
  }
  if (containsWord(candidate, "coinbase")) {
    return 'coinbase';
  }
  if (containsWord(candidate, "paypal")) {
    return 'paypal';
  }
  if (containsWord(candidate, "microsoft") || containsWord(candidate, "outlook") || containsWord(candidate, "azure")) {
    return 'microsoft';
  }
  if (containsWord(candidate, "notion")) {
    return 'notion';
  }
  if (containsWord(candidate, "onedrive")) {
    return 'onedrive';
  }
  if (containsWord(candidate, "reddit")) {
    return 'reddit';
  }
  if (containsWord(candidate, "slack")) {
    return 'slack';
  }
  if (containsWord(candidate, "openai") || containsWord(candidate, "chatgpt")) {
    return 'openai';
  }
  if (containsWord(candidate, "spotify")) {
    return 'spotify';
  }
  if (containsWord(candidate, "steam")) {
    return 'steam';
  }
  if (containsWord(candidate, "stripe")) {
    return 'stripe';
  }
  if (containsWord(candidate, "telegram")) {
    return 'telegram';
  }
  if (containsWord(candidate, "tiktok") || containsWordSequence(candidate, "tik tok") || containsWord(candidate, "douyin")) {
    return 'tiktok';
  }
  if (containsWord(candidate, "twitch")) {
    return 'twitch';
  }
  if (containsWord(candidate, "whatsapp")) {
    return 'whatsapp';
  }
  if (containsWord(candidate, "yahoo")) {
    return 'yahoo';
  }
  if (containsWord(candidate, "zoom")) {
    return 'zoom';
  }
  if (candidate === "x" || containsWord(candidate, "twitter")) {
    return 'x';
  }

  return 'default';
}

function containsWord(text: string, word: string): boolean {
  let index: number = text.indexOf(word);
  while (index >= 0) {
    let before: string = index > 0 ? text.substring(index - 1, index) : '';
    let afterIndex: number = index + word.length;
    let after: string = afterIndex < text.length ? text.substring(afterIndex, afterIndex + 1) : '';
    if (!isWordCharacter(before) && !isWordCharacter(after)) {
      return true;
    }
    index = text.indexOf(word, index + 1);
  }
  return false;
}

function containsWordSequence(text: string, sequence: string): boolean {
  let normalizedText: string = normalizeSeparators(text);
  let normalizedSequence: string = normalizeSeparators(sequence);
  return normalizedText.indexOf(normalizedSequence) >= 0;
}

function normalizeSeparators(text: string): string {
  return text.replace(/[^a-z0-9]+/g, ' ').trim();
}

function isWordCharacter(value: string): boolean {
  return value.length > 0 && /[a-z0-9_]/.test(value);
}
