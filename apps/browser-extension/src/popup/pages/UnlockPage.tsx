import { useEffect, useRef, useState } from 'react';
import { PopupShell } from '../components/layout/PopupShell';
import { TopBar } from '../components/layout/TopBar';
import { UnlockForm, type UnlockMode } from '../components/forms/UnlockForm';
import { canUseWebAuthnUnlock } from '../../services/security-preferences-service';

interface UnlockPageProps {
  mode: UnlockMode;
  message?: string | null;
  onSubmit?: (password: string) => void;
  onWebAuthnUnlock?: () => void | Promise<void>;
}

export function UnlockPage({
  mode,
  message = null,
  onSubmit,
  onWebAuthnUnlock
}: UnlockPageProps) {
  const [webAuthnAvailable, setWebAuthnAvailable] = useState(false);
  const [isWebAuthnUnlocking, setIsWebAuthnUnlocking] = useState(false);
  const autoPromptedRef = useRef(false);

  async function handleWebAuthnUnlock() {
    if (!onWebAuthnUnlock || isWebAuthnUnlocking) {
      return;
    }

    setIsWebAuthnUnlocking(true);

    try {
      await onWebAuthnUnlock();
    } finally {
      setIsWebAuthnUnlocking(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    if (mode !== 'unlock') {
      setWebAuthnAvailable(false);
      autoPromptedRef.current = false;
      return () => {
        mounted = false;
      };
    }

    void canUseWebAuthnUnlock().then((available) => {
      if (mounted) {
        setWebAuthnAvailable(available);

        if (available && !autoPromptedRef.current) {
          autoPromptedRef.current = true;
          void handleWebAuthnUnlock();
        }
      }
    });

    return () => {
      mounted = false;
    };
  }, [mode]);

  return (
    <PopupShell
      topBar={<TopBar title="身份验证器" />}
    >
      <div
        style={{
          width: '100%',
          display: 'grid',
          alignContent: 'center'
        }}
      >
        <UnlockForm mode={mode} onSubmit={onSubmit}>
          {webAuthnAvailable ? (
            <button
              type="button"
              disabled={isWebAuthnUnlocking}
              onClick={() => void handleWebAuthnUnlock()}
              style={{
                ...webAuthnButtonStyle,
                opacity: isWebAuthnUnlocking ? 0.74 : 1
              }}
            >
              Windows Hello 解锁
            </button>
          ) : null}
        </UnlockForm>
        {message ? (
          <p style={{ margin: '14px 0 0', color: '#9d4156', lineHeight: 1.5 }}>{message}</p>
        ) : null}
      </div>
    </PopupShell>
  );
}

const webAuthnButtonStyle = {
  height: '48px',
  borderRadius: '999px',
  background: 'var(--color-brand)',
  color: '#f7fbff',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 12px 26px rgba(42, 136, 219, 0.24)'
} satisfies React.CSSProperties;
