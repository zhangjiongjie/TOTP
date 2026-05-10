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
          <button type="button" onClick={onBack} style={actionStyle}>
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
      setMessage('Account updated.');
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
          title={`${account.issuer} details`}
          subtitle="Edit the local demo record. The service API stays compatible with a later vault-backed implementation."
          actions={
            <button type="button" aria-label="Back" onClick={onBack} style={actionStyle}>
              Back
            </button>
          }
        />
      }
    >
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <AccountForm
          title="Edit account"
          submitLabel="Save changes"
          values={values}
          onChange={updateField}
          onSubmit={handleSave}
          helperText="The code preview on the list will refresh from this data."
          isSubmitting={isSaving || isDeleting}
        />
        <button
          type="button"
          disabled={isSaving || isDeleting}
          onClick={() => setConfirmOpen(true)}
          style={{
            padding: '12px 16px',
            borderRadius: '999px',
            background: 'rgba(187, 83, 105, 0.12)',
            color: '#a14157',
            cursor: isSaving || isDeleting ? 'wait' : 'pointer',
            opacity: isSaving || isDeleting ? 0.72 : 1
          }}
        >
          Delete account
        </button>
        {message ? <p style={{ margin: 0, color: 'var(--color-ink-soft)' }}>{message}</p> : null}
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
    issuer: '',
    accountName: '',
    secret: '',
    digits: '6',
    period: '30',
    algorithm: 'SHA1'
  };
}

const actionStyle = {
  minWidth: '74px',
  height: '36px',
  padding: '0 12px',
  borderRadius: '12px',
  background: 'rgba(238, 244, 249, 0.96)',
  border: '1px solid var(--color-line)',
  color: 'var(--color-brand-strong)',
  cursor: 'pointer'
} satisfies React.CSSProperties;
