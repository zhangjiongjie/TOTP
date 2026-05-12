import { useEffect, useState, useSyncExternalStore } from 'react';
import { AccountCard, type DemoAccount } from '../components/account/AccountCard';
import { FloatingAddButton } from '../components/layout/FloatingAddButton';
import { PopupShell } from '../components/layout/PopupShell';
import { TopBar } from '../components/layout/TopBar';
import { accountService } from '../../services/account-service';
import { runRuntimeManualSync } from '../../services/runtime-sync-service';
import { getAppState, subscribeApp } from '../../state/app-store';

function TopActionButton({
  label,
  disabled = false,
  onClick
}: {
  label: 'Sync' | 'Settings';
  disabled?: boolean;
  onClick?: () => void;
}) {
  const icon =
    label === 'Sync' ? (
      <svg
        width="18"
        height="18"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M15.97 8.02A6.5 6.5 0 0 0 4.64 5.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M4.64 5.5v3.22h3.22"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4.03 11.98A6.5 6.5 0 0 0 15.36 14.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M15.36 14.5v-3.22h-3.22"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ) : (
      <svg
        width="18"
        height="18"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M10 7.2A2.8 2.8 0 1 0 10 12.8 2.8 2.8 0 0 0 10 7.2Z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M16.22 11.32a1 1 0 0 0 .2 1.1l.04.04a1.2 1.2 0 0 1 0 1.7l-.62.62a1.2 1.2 0 0 1-1.7 0l-.04-.04a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.91V15.8A1.2 1.2 0 0 1 11.2 17h-.88A1.2 1.2 0 0 1 9.12 15.8v-.06a1 1 0 0 0-.6-.91 1 1 0 0 0-1.1.2l-.04.04a1.2 1.2 0 0 1-1.7 0l-.62-.62a1.2 1.2 0 0 1 0-1.7l.04-.04a1 1 0 0 0 .2-1.1 1 1 0 0 0-.91-.6H4.2A1.2 1.2 0 0 1 3 9.8v-.88A1.2 1.2 0 0 1 4.2 7.72h.06a1 1 0 0 0 .91-.6 1 1 0 0 0-.2-1.1l-.04-.04a1.2 1.2 0 0 1 0-1.7l.62-.62a1.2 1.2 0 0 1 1.7 0l.04.04a1 1 0 0 0 1.1.2h.01a1 1 0 0 0 .59-.91V4.2A1.2 1.2 0 0 1 10.32 3h.88a1.2 1.2 0 0 1 1.2 1.2v.06a1 1 0 0 0 .6.91 1 1 0 0 0 1.1-.2l.04-.04a1.2 1.2 0 0 1 1.7 0l.62.62a1.2 1.2 0 0 1 0 1.7l-.04.04a1 1 0 0 0-.2 1.1v.01a1 1 0 0 0 .91.59h.06A1.2 1.2 0 0 1 17 8.92v.88a1.2 1.2 0 0 1-1.2 1.2h-.06a1 1 0 0 0-.91.32Z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );

  return (
    <button
      type="button"
      aria-label={label}
      title={label === 'Sync' ? '同步' : '设置'}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '36px',
        height: '36px',
        display: 'grid',
        placeItems: 'center',
        borderRadius: '12px',
        background: 'rgba(238, 244, 249, 0.96)',
        border: '1px solid var(--color-line)',
        color: 'var(--color-brand-strong)',
        cursor: disabled ? 'wait' : 'pointer',
        opacity: disabled ? 0.66 : 1
      }}
    >
      <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center' }}>
        {icon}
      </span>
    </button>
  );
}

interface AccountListPageProps {
  onOpenAdd?: () => void;
  onOpenSettings?: () => void;
  onOpenDetails?: (accountId: string) => void;
}

export function AccountListPage({
  onOpenAdd,
  onOpenSettings,
  onOpenDetails
}: AccountListPageProps = {}) {
  const [now, setNow] = useState(() => Date.now());
  const [accounts, setAccounts] = useState<Awaited<ReturnType<typeof accountService.listAccounts>>>(
    []
  );
  const [statusMessage, setStatusMessage] = useState('');
  const [statusTone, setStatusTone] = useState<'idle' | 'success' | 'warning' | 'error'>('idle');
  const appState = useSyncExternalStore(subscribeApp, getAppState, getAppState);
  const isSyncing = appState.sync.phase === 'syncing';
  const syncBannerMessage = isSyncing
    ? appState.sync.trigger === 'manual'
      ? '正在同步，请稍候...'
      : '正在同步本地变更，请稍候...'
    : statusMessage;
  const syncBannerTone =
    isSyncing ? 'idle' : statusTone;

  useEffect(() => {
    async function refreshAccounts() {
      setAccounts(await accountService.listAccounts());
    }

    void refreshAccounts();
    const unsubscribe = accountService.subscribe(() => {
      void refreshAccounts();
    });
    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, []);

  const runtimeAccounts: DemoAccount[] = accounts.map((account) =>
    accountService.createRuntime(account, now)
  );

  async function handleManualSync() {
    if (isSyncing) {
      return;
    }

    setStatusTone('idle');
    setStatusMessage('正在同步...');

    try {
      const result = await runRuntimeManualSync();

      switch (result.status) {
        case 'disabled':
          setStatusTone('warning');
          setStatusMessage('未配置 WebDAV 同步，当前仅使用本地保管库。');
          break;
        case 'pushed':
          setStatusTone('success');
          setStatusMessage('同步成功，已推送本地最新数据。');
          break;
        case 'pulled':
          setStatusTone('success');
          setStatusMessage('同步成功，已拉取远端最新数据。');
          break;
        case 'noop':
          setStatusTone('success');
          setStatusMessage('同步完成，当前数据已经是最新。');
          break;
        case 'conflict':
          setStatusTone('warning');
          setStatusMessage('检测到同步冲突，请前往设置页处理。');
          break;
        case 'download-error':
        case 'upload-error':
        case 'validation-error':
          setStatusTone('error');
          setStatusMessage(result.error?.message ?? '同步失败，请稍后重试。');
          break;
        default:
          setStatusTone('idle');
          setStatusMessage('同步状态已更新。');
      }
    } catch (error) {
      setStatusTone('error');
      setStatusMessage(error instanceof Error ? error.message : '同步失败，请稍后重试。');
    }
  }

  return (
    <PopupShell
      topBar={
            <TopBar
              eyebrow="Authenticator"
              title="TOTP Authenticator"
              subtitle={`${runtimeAccounts.length} 个账号已就绪，点击验证码即可快速复制。`}
              actions={
                <>
                  <TopActionButton
                    label="Sync"
                    disabled={isSyncing}
                    onClick={() => void handleManualSync()}
                  />
                  <TopActionButton
                    label="Settings"
                    onClick={() => {
                      if (onOpenSettings) {
                        onOpenSettings();
                        return;
                      }

                      window.location.hash = '#settings';
                    }}
                  />
                </>
              }
            />
      }
      floatingAction={
        <FloatingAddButton
          onClick={() => {
            if (onOpenAdd) {
              onOpenAdd();
              return;
            }

            window.location.hash = '#add';
          }}
        />
      }
    >
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          minHeight: 0
        }}
      >
        {syncBannerMessage ? (
          <p
            style={{
              margin: 0,
              padding: '10px 14px',
              borderRadius: '16px',
              background:
                syncBannerTone === 'success'
                  ? 'rgba(231, 245, 240, 0.92)'
                  : syncBannerTone === 'warning'
                    ? 'rgba(233, 240, 248, 0.92)'
                    : syncBannerTone === 'error'
                      ? 'rgba(252, 236, 240, 0.96)'
                      : 'rgba(241, 246, 250, 0.92)',
              color:
                syncBannerTone === 'success'
                  ? 'var(--color-success)'
                  : syncBannerTone === 'warning'
                    ? 'var(--color-brand-strong)'
                    : syncBannerTone === 'error'
                      ? '#9d4156'
                      : 'var(--color-ink-soft)',
              lineHeight: 1.5
            }}
          >
            {syncBannerMessage}
          </p>
        ) : null}
        <div
          style={{
            width: '100%',
            display: 'flex',
            flex: 1,
            minHeight: 0,
            flexDirection: 'column',
            gap: '14px',
            paddingBottom: '88px',
            overflowY: 'auto'
          }}
        >
          {runtimeAccounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={(accountId) => {
                if (onOpenDetails) {
                  onOpenDetails(accountId);
                  return;
                }

                window.location.hash = `#detail/${accountId}`;
              }}
            />
          ))}
        </div>
      </div>
    </PopupShell>
  );
}
