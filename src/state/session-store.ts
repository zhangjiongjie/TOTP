export interface SessionState {
  isUnlocked: boolean;
  keyMaterial: CryptoKey | null;
  unlockedAt: string | null;
}

type SessionListener = (state: SessionState) => void;

const lockedState: SessionState = {
  isUnlocked: false,
  keyMaterial: null,
  unlockedAt: null
};

let sessionState: SessionState = lockedState;
const listeners = new Set<SessionListener>();

export function getSessionState(): SessionState {
  return sessionState;
}

export function unlockSession(keyMaterial: CryptoKey, unlockedAt = new Date().toISOString()) {
  sessionState = {
    isUnlocked: true,
    keyMaterial,
    unlockedAt
  };

  emit();
}

export function lockSession() {
  sessionState = lockedState;
  emit();
}

export function subscribeSession(listener: SessionListener): () => void {
  listeners.add(listener);
  listener(sessionState);

  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  for (const listener of listeners) {
    listener(sessionState);
  }
}
