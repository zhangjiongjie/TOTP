import { getCurrentMasterPassword } from '../state/master-password-store';
import {
  securityPreferencesStore,
  sessionCredentialsStore,
  type SecurityPreferences
} from '../state/security-store';
import { getSessionState } from '../state/session-store';
import {
  isWebAuthnUnlockSupported,
  registerWebAuthnUnlock,
  verifyWebAuthnUnlock
} from './webauthn-unlock-service';

export async function loadSecurityPreferences(): Promise<SecurityPreferences> {
  return securityPreferencesStore.load();
}

export async function updateRememberSessionUntilBrowserRestart(
  enabled: boolean
): Promise<SecurityPreferences> {
  const next = await securityPreferencesStore.save({
    rememberSessionUntilBrowserRestart: enabled
  });

  if (!enabled && !next.webAuthnUnlockEnabled) {
    await sessionCredentialsStore.clear();
    return next;
  }

  const currentMasterPassword = getCurrentMasterPassword();
  if (currentMasterPassword && getSessionState().isUnlocked) {
    await sessionCredentialsStore.save({ masterPassword: currentMasterPassword });
  }

  return next;
}

export function canRegisterWebAuthnUnlock(): boolean {
  return isWebAuthnUnlockSupported();
}

export async function canUseWebAuthnUnlock(): Promise<boolean> {
  const [preferences, credentials] = await Promise.all([
    securityPreferencesStore.load(),
    sessionCredentialsStore.load()
  ]);

  return (
    preferences.webAuthnUnlockEnabled &&
    Boolean(preferences.webAuthnCredentialId) &&
    Boolean(credentials.masterPassword) &&
    isWebAuthnUnlockSupported()
  );
}

export async function enableWebAuthnUnlock(masterPassword: string): Promise<SecurityPreferences> {
  if (!masterPassword || !getSessionState().isUnlocked) {
    throw new Error('请先解锁');
  }

  const credential = await registerWebAuthnUnlock();
  const next = await securityPreferencesStore.save({
    rememberSessionUntilBrowserRestart: false,
    webAuthnUnlockEnabled: true,
    webAuthnCredentialId: credential.credentialId,
    webAuthnCredentialCreatedAt: credential.createdAt
  });

  await sessionCredentialsStore.save({ masterPassword });
  return next;
}

export async function disableWebAuthnUnlock(): Promise<SecurityPreferences> {
  const next = await securityPreferencesStore.save({
    webAuthnUnlockEnabled: false,
    webAuthnCredentialId: null,
    webAuthnCredentialCreatedAt: null
  });

  if (!next.rememberSessionUntilBrowserRestart) {
    await sessionCredentialsStore.clear();
  }

  return next;
}

export async function verifyWebAuthnUnlockAndReadPassword(): Promise<string> {
  const preferences = await securityPreferencesStore.load();

  if (!preferences.webAuthnUnlockEnabled || !preferences.webAuthnCredentialId) {
    throw new Error('Windows Hello 解锁未开启。');
  }

  const { masterPassword } = await sessionCredentialsStore.load();

  if (!masterPassword) {
    throw new Error('请先输入主密码。');
  }

  await verifyWebAuthnUnlock(preferences.webAuthnCredentialId);
  return masterPassword;
}
