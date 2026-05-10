import './styles/global.css';
import { useEffect, useSyncExternalStore } from 'react';
import {
  getAppState,
  initializeApp,
  navigate,
  submitUnlock,
  subscribeApp
} from '../state/app-store';
import { PopupRoutes } from './routes';

export function App() {
  const appState = useSyncExternalStore(subscribeApp, getAppState, getAppState);

  useEffect(() => {
    void initializeApp();
  }, []);

  if (!appState.isReady) {
    return null;
  }

  return (
    <PopupRoutes
      route={appState.route}
      unlockMessage={appState.unlockError}
      onNavigate={navigate}
      onUnlock={submitUnlock}
    />
  );
}
