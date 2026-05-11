let currentMasterPassword: string | null = null;

export function getCurrentMasterPassword() {
  return currentMasterPassword;
}

export function setCurrentMasterPassword(password: string) {
  currentMasterPassword = password;
}

export function clearCurrentMasterPassword() {
  currentMasterPassword = null;
}
