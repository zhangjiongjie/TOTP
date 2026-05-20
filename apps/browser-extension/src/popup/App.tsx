import './styles/global.css';
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  getAppState,
  initializeApp,
  navigate,
  reloadStoredVaultAfterRemotePasswordVerified,
  refreshAppSyncSnapshot,
  submitUnlock,
  submitWebAuthnUnlock,
  subscribeApp
} from '../state/app-store';
import { PopupRoutes } from './routes';
import { settingsService } from '../services/settings-service';

export function App() {
  const appState = useSyncExternalStore(subscribeApp, getAppState, getAppState);
  const [remotePasswordDialogDismissed, setRemotePasswordDialogDismissed] = useState(false);

  useEffect(() => {
    void initializeApp();
  }, []);

  useEffect(() => {
    if (appState.sync.phase === 'syncing' || !shouldShowRemotePasswordDialog(appState.sync)) {
      setRemotePasswordDialogDismissed(false);
    }
  }, [appState.sync]);

  if (!appState.isReady) {
    return null;
  }

  return (
    <>
      <PopupRoutes
        route={appState.route}
        unlockMessage={appState.unlockError}
        onNavigate={navigate}
        onUnlock={submitUnlock}
        onWebAuthnUnlock={submitWebAuthnUnlock}
      />
      {appState.sync.phase === 'idle' && shouldShowRemotePasswordDialog(appState.sync) && !remotePasswordDialogDismissed ? (
        <RemotePasswordDialog
          message={appState.sync.lastError}
          onDismiss={() => setRemotePasswordDialogDismissed(true)}
          onVerified={async () => {
            setRemotePasswordDialogDismissed(false);
            await refreshAppSyncSnapshot();
          }}
        />
      ) : null}
    </>
  );
}

function shouldShowRemotePasswordDialog(sync: ReturnType<typeof getAppState>['sync']) {
  if (!sync.isWebDavEnabled) {
    return false;
  }

  if (sync.lastResultStatus === 'blocked') {
    return true;
  }

  return isRemotePasswordError(sync.lastError);
}

function isRemotePasswordError(message: string | null) {
  if (!message) {
    return false;
  }

  return message.includes('远端保管库') ||
    message.includes('远端密码库') ||
    message.includes('Master password is incorrect') ||
    message.includes('主密码');
}

interface RemotePasswordDialogProps {
  message: string | null;
  onDismiss: () => void;
  onVerified: () => Promise<void>;
}

function RemotePasswordDialog({ message, onDismiss, onVerified }: RemotePasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      await settingsService.verifyRemoteMasterPassword(password);
      await reloadStoredVaultAfterRemotePasswordVerified(password);
      setPassword('');
      await onVerified();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '远端密码库验证失败。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={dialogOverlayStyle}>
      <form style={dialogStyle} onSubmit={handleSubmit}>
        <div>
          <h2 style={dialogTitleStyle}>验证远端密码库</h2>
          <p style={dialogTextStyle}>
            {message ?? '远端主密码已变化，请输入新的远端主密码后继续同步。'}
          </p>
          <p style={dialogHintStyle}>
            验证通过后，本地保管库和当前解锁密码会同步更新为远端密码。
          </p>
        </div>
        <input
          aria-label="远端主密码"
          type="password"
          value={password}
          placeholder="远端主密码"
          autoFocus
          disabled={busy}
          style={dialogInputStyle}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error ? <p style={dialogErrorStyle}>{error}</p> : null}
        <div style={dialogActionsStyle}>
          <button type="button" style={dialogSecondaryButtonStyle} disabled={busy} onClick={onDismiss}>
            稍后处理
          </button>
          <button type="submit" style={dialogPrimaryButtonStyle} disabled={busy}>
            {busy ? '验证中...' : '验证'}
          </button>
        </div>
      </form>
    </div>
  );
}

const dialogOverlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  display: 'grid',
  placeItems: 'center',
  padding: '20px',
  background: 'rgba(15, 23, 42, 0.42)'
} satisfies React.CSSProperties;

const dialogStyle = {
  width: '100%',
  maxWidth: '360px',
  display: 'grid',
  gap: '14px',
  padding: '20px',
  borderRadius: '18px',
  background: 'var(--color-card)',
  border: '1px solid var(--color-line)',
  boxShadow: '0 18px 48px rgba(15, 23, 42, 0.24)'
} satisfies React.CSSProperties;

const dialogTitleStyle = {
  margin: 0,
  color: 'var(--color-ink-strong)',
  fontSize: '20px'
} satisfies React.CSSProperties;

const dialogTextStyle = {
  margin: '8px 0 0',
  lineHeight: 1.5,
  color: 'var(--color-ink-soft)'
} satisfies React.CSSProperties;

const dialogHintStyle = {
  margin: '8px 0 0',
  lineHeight: 1.5,
  color: 'var(--color-brand-strong)',
  fontSize: '13px'
} satisfies React.CSSProperties;

const dialogInputStyle = {
  minHeight: '44px',
  borderRadius: '10px',
  border: '1px solid var(--color-line)',
  background: 'var(--color-card-muted)',
  color: 'var(--color-ink-strong)',
  padding: '0 12px',
  fontSize: '15px'
} satisfies React.CSSProperties;

const dialogErrorStyle = {
  margin: 0,
  color: 'var(--color-danger)',
  lineHeight: 1.5
} satisfies React.CSSProperties;

const dialogActionsStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '10px'
} satisfies React.CSSProperties;

const dialogSecondaryButtonStyle = {
  minHeight: '42px',
  borderRadius: '10px',
  border: '1px solid var(--color-line)',
  background: 'var(--color-card-muted)',
  color: 'var(--color-ink-strong)',
  fontWeight: 700,
  cursor: 'pointer'
} satisfies React.CSSProperties;

const dialogPrimaryButtonStyle = {
  minHeight: '42px',
  borderRadius: '10px',
  border: '0',
  background: 'var(--color-brand)',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer'
} satisfies React.CSSProperties;
