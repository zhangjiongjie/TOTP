export interface SessionState {
  isUnlocked: boolean;
  keyMaterial: CryptoKey | null;
  unlockedAt: string | null;
}

export type SessionSnapshot = Readonly<SessionState>;

type SessionListener = (state: SessionSnapshot) => void;

const lockedState: SessionState = {
  isUnlocked: false,
  keyMaterial: null,
  unlockedAt: null
};

let sessionState: SessionState = lockedState;
const listeners = new Set<SessionListener>();

export function getSessionState(): SessionSnapshot {
  return createSnapshot(sessionState);
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
  listener(createSnapshot(sessionState));

  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  for (const listener of listeners) {
    listener(createSnapshot(sessionState));
  }
}

function createSnapshot(state: SessionState): SessionSnapshot {
  return Object.freeze({
    isUnlocked: state.isUnlocked,
    keyMaterial: state.keyMaterial,
    unlockedAt: state.unlockedAt
  });
}
