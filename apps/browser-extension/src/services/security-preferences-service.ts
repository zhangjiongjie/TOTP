import { getCurrentMasterPassword } from '../state/master-password-store';
import {
  securityPreferencesStore,
  sessionCredentialsStore,
  type SecurityPreferences
} from '../state/security-store';
import { getSessionState } from '../state/session-store';

export async function loadSecurityPreferences(): Promise<SecurityPreferences> {
  return securityPreferencesStore.load();
}

export async function updateRememberSessionUntilBrowserRestart(
  enabled: boolean
): Promise<SecurityPreferences> {
  const next = await securityPreferencesStore.save({
    rememberSessionUntilBrowserRestart: enabled
  });

  if (!enabled) {
    await sessionCredentialsStore.clear();
    return next;
  }

  const currentMasterPassword = getCurrentMasterPassword();
  if (currentMasterPassword && getSessionState().isUnlocked) {
    await sessionCredentialsStore.save({ masterPassword: currentMasterPassword });
  }

  return next;
}
