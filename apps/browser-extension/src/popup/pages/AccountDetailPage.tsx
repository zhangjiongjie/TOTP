import { useEffect, useState } from 'react';
import { AccountForm } from '../components/forms/AccountForm';
import { ConfirmDeleteDialog } from '../components/dialogs/ConfirmDeleteDialog';
import { PopupShell } from '../components/layout/PopupShell';
import { TopBar } from '../components/layout/TopBar';
import { accountService, type AccountFormValues } from '../../services/account-service';
import { importService } from '../../services/import-service';

interface AccountDetailPageProps {
  accountId: string;
  onBack: () => void;
  onDeleted: () => void;
}

export function AccountDetailPage({
  accountId,
  onBack,
  onDeleted
}: AccountDetailPageProps) {
  const [account, setAccount] = useState<Awaited<ReturnType<typeof accountService.getAccount>>>(null);
  const [values, setValues] = useState<AccountFormValues>(() => getEmptyFormValues());
  const [message, setMessage] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function refreshAccount() {
      setIsLoading(true);
      const nextAccount = await accountService.getAccount(accountId);
      setAccount(nextAccount);
      setIsLoading(false);
    }

    void refreshAccount();
    const unsubscribe = accountService.subscribe(() => {
      void refreshAccount();
    });

    return () => {
      unsubscribe();
    };
  }, [accountId]);

  useEffect(() => {
    if (account) {
      setValues(accountService.toFormValues(account));
    }
  }, [account]);

  if (isLoading) {
    return (
      <PopupShell topBar={<TopBar eyebrow="Account" title="Loading account" actions={null} />}>
        <div style={{ width: '100%' }}>
          <p style={{ color: 'var(--color-ink-soft)' }}>Loading local account details...</p>
        </div>
      </PopupShell>
    );
  }

  if (!account) {
    return (
      <PopupShell
        topBar={<TopBar eyebrow="Account" title="Missing account" actions={null} />}
      >
        <div style={{ width: '100%' }}>
          <p style={{ color: 'var(--color-ink-soft)' }}>
            This account is no longer available.
          </p>
          <button type="button" onClick={onBack} style={secondaryButtonStyle}>
            Back to accounts
          </button>
        </div>
      </PopupShell>
    );
  }

  function updateField(field: keyof AccountFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSave() {
    if (isSaving || isDeleting) {
      return;
    }

    setMessage('');
    setIsSaving(true);

    try {
      await accountService.updateAccount(accountId, importService.fromManualForm(values));
      onBack();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : 'Unable to update account.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PopupShell
      topBar={
        <TopBar
          eyebrow="Account"
          title="编辑账号"
          subtitle="修改账号信息与分组，保存后会返回主列表。"
          actions={
            <button type="button" aria-label="返回" onClick={onBack} style={secondaryButtonStyle}>
              返回
            </button>
          }
        />
      }
    >
      <div style={pageLayoutStyle}>
        <div style={scrollAreaStyle}>
          <section style={panelStyle}>
            <AccountForm
              title={`${account.issuer} · ${account.accountName}`}
              helperText="Group 会在保存时一起提交，删除操作也统一放在底部。"
              values={values}
              onChange={updateField}
              isSubmitting={isSaving || isDeleting}
              showSubmitButton={false}
              groups={accountService.getGroups()}
            />
          </section>
          {message ? <p style={messageStyle}>{message}</p> : null}
        </div>
        <div style={footerStyle}>
          <button
            type="button"
            disabled={isSaving || isDeleting}
            onClick={() => setConfirmOpen(true)}
            style={dangerButtonStyle}
          >
            {isDeleting ? '删除中...' : '删除'}
          </button>
          <button
            type="button"
            disabled={isSaving || isDeleting}
            onClick={() => void handleSave()}
            style={primaryButtonStyle}
          >
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
      <ConfirmDeleteDialog
        open={confirmOpen}
        accountLabel={`${account.issuer} · ${account.accountName}`}
        onCancel={() => setConfirmOpen(false)}
        isSubmitting={isSaving || isDeleting}
        onConfirm={async () => {
          if (isSaving || isDeleting) {
            return;
          }

          setIsDeleting(true);
          try {
            await accountService.deleteAccount(accountId);
            setConfirmOpen(false);
            onDeleted();
          } catch (caughtError) {
            setConfirmOpen(false);
            setMessage(
              caughtError instanceof Error ? caughtError.message : 'Unable to delete account.'
            );
          } finally {
            setIsDeleting(false);
          }
        }}
      />
    </PopupShell>
  );
}

function getEmptyFormValues(): AccountFormValues {
  return {
    otpauthUri: '',
    issuer: '',
    accountName: '',
    secret: '',
    digits: '6',
    period: '30',
    algorithm: 'SHA1',
    groupId: 'default'
  };
}

const pageLayoutStyle = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  gap: '14px'
} satisfies React.CSSProperties;

const scrollAreaStyle = {
  display: 'grid',
  gap: '14px',
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  paddingRight: '4px'
} satisfies React.CSSProperties;

const panelStyle = {
  padding: '18px',
  borderRadius: '22px',
  background: 'rgba(250, 252, 255, 0.92)',
  border: '1px solid var(--color-line)'
} satisfies React.CSSProperties;

const footerStyle = {
  display: 'grid',
  gridTemplateColumns: '132px 1fr',
  gap: '12px',
  paddingTop: '6px'
} satisfies React.CSSProperties;

const secondaryButtonStyle = {
  minWidth: '74px',
  height: '36px',
  padding: '0 12px',
  borderRadius: '12px',
  background: 'rgba(238, 244, 249, 0.96)',
  border: '1px solid var(--color-line)',
  color: 'var(--color-brand-strong)',
  cursor: 'pointer'
} satisfies React.CSSProperties;

const primaryButtonStyle = {
  minHeight: '48px',
  padding: '13px 18px',
  borderRadius: '999px',
  background: 'linear-gradient(180deg, #386897 0%, #2c557d 100%)',
  color: '#f8fbff',
  fontWeight: 600,
  cursor: 'pointer'
} satisfies React.CSSProperties;

const dangerButtonStyle = {
  minHeight: '48px',
  padding: '13px 18px',
  borderRadius: '999px',
  background: 'rgba(187, 83, 105, 0.12)',
  color: '#a14157',
  fontWeight: 600,
  cursor: 'pointer'
} satisfies React.CSSProperties;

const messageStyle = {
  margin: 0,
  padding: '12px 14px',
  borderRadius: '16px',
  background: 'rgba(252, 236, 240, 0.96)',
  color: '#9d4156',
  lineHeight: 1.5
} satisfies React.CSSProperties;
