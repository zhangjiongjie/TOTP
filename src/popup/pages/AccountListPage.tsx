import { useEffect, useState } from 'react';
import { AccountCard, type DemoAccount } from '../components/account/AccountCard';
import { ConfirmDeleteDialog } from '../components/dialogs/ConfirmDeleteDialog';
import { FloatingAddButton } from '../components/layout/FloatingAddButton';
import { PopupShell } from '../components/layout/PopupShell';
import { TopBar } from '../components/layout/TopBar';
import { accountService } from '../../services/account-service';

function TopActionButton({ label }: { label: 'Sync' | 'Settings' }) {
  const icon =
    label === 'Sync' ? (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M4.25 5.5A4.5 4.5 0 0 1 12 7h1.75L11.5 9.25 9.25 7H11a3 3 0 1 0 .58 1.76"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ) : (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M8 5.75A2.25 2.25 0 1 0 8 10.25 2.25 2.25 0 0 0 8 5.75Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M8 1.75V3M8 13V14.25M13 8H14.25M1.75 8H3M11.71 4.29L12.6 3.4M3.4 12.6L4.29 11.71M11.71 11.71L12.6 12.6M3.4 3.4L4.29 4.29"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    );

  return (
    <button
      type="button"
      aria-label={label}
      style={{
        width: '36px',
        height: '36px',
        display: 'grid',
        placeItems: 'center',
        borderRadius: '12px',
        background: 'rgba(238, 244, 249, 0.96)',
        border: '1px solid var(--color-line)',
        color: 'var(--color-brand-strong)',
        cursor: 'pointer'
      }}
    >
      <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center' }}>
        {icon}
      </span>
    </button>
  );
}

export function AccountListPage() {
  const [now, setNow] = useState(() => Date.now());
  const [accounts, setAccounts] = useState(() => accountService.listAccounts());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const unsubscribe = accountService.subscribe(() => {
      setAccounts(accountService.listAccounts());
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
  const pendingDelete = pendingDeleteId ? accountService.getAccount(pendingDeleteId) : null;

  return (
    <PopupShell
      topBar={
        <TopBar
          eyebrow="Authenticator"
          title="TOTP Authenticator"
          subtitle={`${runtimeAccounts.length} 个账号已就绪，点击验证码即可快速复制。`}
          actions={
            <>
              <TopActionButton label="Sync" />
              <TopActionButton label="Settings" />
            </>
          }
        />
      }
      floatingAction={
        <FloatingAddButton
          onClick={() => {
            window.location.hash = '#add';
          }}
        />
      }
    >
      <>
        <div
          style={{
            width: '100%',
            display: 'flex',
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
              onOpenDetails={(accountId) => {
                window.location.hash = `#detail/${accountId}`;
              }}
              onEdit={(accountId) => {
                window.location.hash = `#detail/${accountId}`;
              }}
              onMoveGroup={() => {
                setStatusMessage('Move Group is a placeholder in the demo service for now.');
              }}
              onDelete={(accountId) => {
                setPendingDeleteId(accountId);
              }}
            />
          ))}
          {statusMessage ? (
            <p style={{ margin: 0, color: 'var(--color-ink-soft)', lineHeight: 1.5 }}>
              {statusMessage}
            </p>
          ) : null}
        </div>
        <ConfirmDeleteDialog
          open={Boolean(pendingDelete)}
          accountLabel={
            pendingDelete ? `${pendingDelete.issuer} · ${pendingDelete.accountName}` : ''
          }
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={() => {
            if (pendingDeleteId) {
              accountService.deleteAccount(pendingDeleteId);
            }
            setPendingDeleteId(null);
          }}
        />
      </>
    </PopupShell>
  );
}
