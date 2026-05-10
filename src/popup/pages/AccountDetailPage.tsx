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
  const [account, setAccount] = useState(() => accountService.getAccount(accountId));
  const [values, setValues] = useState<AccountFormValues>(() =>
    account
      ? accountService.toFormValues(account)
      : {
          issuer: '',
          accountName: '',
          secret: '',
          digits: '6',
          period: '30',
          algorithm: 'SHA1'
        }
  );
  const [message, setMessage] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setAccount(accountService.getAccount(accountId));

    return accountService.subscribe(() => {
      const nextAccount = accountService.getAccount(accountId);
      setAccount(nextAccount);
    });
  }, [accountId]);

  useEffect(() => {
    if (account) {
      setValues(accountService.toFormValues(account));
    }
  }, [account]);

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

  function handleSave() {
    try {
      accountService.updateAccount(accountId, importService.fromManualForm(values));
      setMessage('Account updated.');
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : 'Unable to update account.');
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
        />
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          style={{
            padding: '12px 16px',
            borderRadius: '999px',
            background: 'rgba(187, 83, 105, 0.12)',
            color: '#a14157',
            cursor: 'pointer'
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
        onConfirm={() => {
          accountService.deleteAccount(accountId);
          setConfirmOpen(false);
          onDeleted();
        }}
      />
    </PopupShell>
  );
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
