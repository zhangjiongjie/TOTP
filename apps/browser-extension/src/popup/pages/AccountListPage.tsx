import { useEffect, useState, useSyncExternalStore } from 'react';
import { AccountCard, type DemoAccount } from '../components/account/AccountCard';
import { FloatingAddButton } from '../components/layout/FloatingAddButton';
import { IconButton } from '../components/layout/IconButton';
import { PopupShell } from '../components/layout/PopupShell';
import { TopBar } from '../components/layout/TopBar';
import { accountService } from '../../services/account-service';
import { runRuntimeManualSync } from '../../services/runtime-sync-service';
import { getAppState, subscribeApp } from '../../state/app-store';

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
  const [runtimeAccounts, setRuntimeAccounts] = useState<DemoAccount[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'idle' | 'success' | 'error'>('idle');
  const appState = useSyncExternalStore(subscribeApp, getAppState, getAppState);
  const isSyncing = appState.sync.phase === 'syncing';
  const syncBannerMessage = isSyncing
    ? appState.sync.trigger === 'manual'
      ? '同步中...'
      : '正在同步本地变更，请稍候...'
    : statusMessage ?? formatDefaultBanner(appState.sync.isWebDavEnabled);
  const syncBannerTone =
    isSyncing ? 'idle' : statusMessage ? statusTone : 'idle';

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

  useEffect(() => {
    let isCurrent = true;

    async function refreshRuntimeAccounts() {
      const nextRuntimeAccounts = await Promise.all(
        accounts.map((account) => accountService.createRuntime(account, now))
      );

      if (isCurrent) {
        setRuntimeAccounts(nextRuntimeAccounts);
      }
    }

    void refreshRuntimeAccounts();

    return () => {
      isCurrent = false;
    };
  }, [accounts, now]);

  useEffect(() => {
    if (statusTone !== 'success' || !statusMessage) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setStatusMessage(null);
      setStatusTone('idle');
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [statusMessage, statusTone]);

  async function handleManualSync() {
    if (isSyncing) {
      return;
    }

    setStatusTone('idle');
    setStatusMessage('同步中...');

    try {
      const result = await runRuntimeManualSync();

      switch (result.status) {
        case 'disabled':
          setStatusTone('idle');
          setStatusMessage(null);
          break;
        case 'pushed':
          setStatusTone('success');
          setStatusMessage('同步完成，已推送本地最新数据。');
          break;
        case 'pulled':
          setStatusTone('success');
          setStatusMessage('同步完成，已拉取远端最新数据。');
          break;
        case 'noop':
          setStatusTone('success');
          setStatusMessage('同步完成，当前数据已经是最新。');
          break;
        case 'conflict':
          setStatusTone('error');
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
          setStatusMessage(null);
      }
    } catch (error) {
      setStatusTone('error');
      setStatusMessage(error instanceof Error ? error.message : '同步失败，请稍后重试。');
    }
  }

  function handleCopyResult(issuer: string, status: 'success' | 'error') {
    setStatusTone(status);
    setStatusMessage(
      status === 'success'
        ? `已复制${issuer}账号验证码到系统剪切板`
        : `复制${issuer}账号验证码失败`
    );
  }

  return (
    <PopupShell
      topBar={
            <TopBar
              title="身份验证器"
              subtitle={`${runtimeAccounts.length} 个账号 · ${formatLastSyncLabel(
                appState.sync.lastResultStatus,
                appState.sync.lastSyncedAt
              )}`}
              actions={
                <>
                  <IconButton
                    label="Sync"
                    title="同步"
                    icon="icons/nav_sync.svg"
                    disabled={isSyncing}
                    onClick={() => void handleManualSync()}
                  />
                  <IconButton
                    label="Settings"
                    title="设置"
                    icon="icons/nav_settings.svg"
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
          flex: 1,
          gap: '12px',
          minHeight: 0,
          overflow: 'hidden'
        }}
      >
        <p style={bannerStyle(syncBannerTone)}>
          {syncBannerMessage}
        </p>
        <div
          style={{
            width: '100%',
            display: 'flex',
            flex: 1,
            minHeight: 0,
            flexDirection: 'column',
            gap: '14px',
            paddingRight: '12px',
            paddingBottom: '82px',
            overflowY: 'auto',
            scrollbarGutter: 'stable'
          }}
        >
          {runtimeAccounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onCopyResult={handleCopyResult}
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

export function formatLastSyncLabel(status: string | null, lastSyncedAt: string | null) {
  if (lastSyncedAt) {
    return `最新同步：${formatDateLabel(lastSyncedAt)}`;
  }

  switch (status) {
    case 'conflict':
      return '存在冲突';
    case 'download-error':
    case 'upload-error':
    case 'validation-error':
      return '同步失败';
    default:
      return '最新同步：暂无';
  }
}

function formatDefaultBanner(isWebDavEnabled: boolean) {
  return isWebDavEnabled
    ? '本地与 WebDAV 已经是最新版本。'
    : 'WebDAV 同步未开启，本地模式。';
}

function bannerStyle(tone: 'idle' | 'success' | 'error'): React.CSSProperties {
  return {
    margin: 0,
    padding: '14px 16px',
    borderRadius: '22px',
    background: 'var(--color-card)',
    border: '1px solid var(--color-line)',
    color:
      tone === 'success'
        ? 'var(--color-success)'
        : tone === 'error'
          ? 'var(--color-danger)'
          : 'var(--color-ink-soft)',
    lineHeight: 1.5,
    fontSize: '13px',
    flexShrink: 0
  };
}

function formatDateLabel(isoText: string): string {
  const date = new Date(isoText);
  if (Number.isNaN(date.getTime())) {
    return isoText;
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}
