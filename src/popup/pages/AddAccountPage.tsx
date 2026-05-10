import { useState } from 'react';
import { AccountForm } from '../components/forms/AccountForm';
import { PopupShell } from '../components/layout/PopupShell';
import { TopBar } from '../components/layout/TopBar';
import {
  accountService,
  getDefaultAccountFormValues,
  type AccountFormValues
} from '../../services/account-service';
import { importService } from '../../services/import-service';
import { QrImportDialog } from '../components/dialogs/QrImportDialog';

type AddMode = 'manual' | 'otpauth' | 'qr';

interface AddAccountPageProps {
  onBack: () => void;
  onAccountCreated: (accountId: string) => void;
}

export function AddAccountPage({
  onBack,
  onAccountCreated
}: AddAccountPageProps) {
  const [mode, setMode] = useState<AddMode>('manual');
  const [formValues, setFormValues] = useState<AccountFormValues>(getDefaultAccountFormValues);
  const [otpauthInput, setOtpauthInput] = useState('');
  const [message, setMessage] = useState('');
  const [qrDialogOpen, setQrDialogOpen] = useState(false);

  function updateField(field: keyof AccountFormValues, value: string) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  function handleManualSubmit() {
    try {
      const draft = importService.fromManualForm(formValues);
      const account = accountService.addAccount(draft);
      onAccountCreated(account.id);
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : 'Unable to add account.');
    }
  }

  function handleOtpAuthImport() {
    try {
      const account = accountService.addAccount(importService.fromOtpAuthUri(otpauthInput));
      onAccountCreated(account.id);
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : 'Unable to import link.');
    }
  }

  return (
    <PopupShell
      topBar={
        <TopBar
          eyebrow="Account"
          title="Add account"
          subtitle="Choose the fastest path now, keep the data shape ready for vault integration later."
          actions={
            <button type="button" aria-label="Back" onClick={onBack} style={topActionStyle}>
              Back
            </button>
          }
        />
      }
    >
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          <ModeButton label="Manual" active={mode === 'manual'} onClick={() => setMode('manual')} />
          <ModeButton
            label="otpauth://"
            active={mode === 'otpauth'}
            onClick={() => setMode('otpauth')}
          />
          <ModeButton label="QR image" active={mode === 'qr'} onClick={() => setQrDialogOpen(true)} />
        </div>
        {mode === 'manual' ? (
          <AccountForm
            title="Manual entry"
            submitLabel="Add account"
            values={formValues}
            onChange={updateField}
            onSubmit={handleManualSubmit}
            helperText="Fill the issuer, account name, secret, digits, period, and algorithm."
          />
        ) : (
          <section
            style={{
              padding: '18px',
              borderRadius: '22px',
              background: 'rgba(250, 252, 255, 0.92)',
              border: '1px solid var(--color-line)'
            }}
          >
            <h2 style={{ margin: 0, fontSize: '20px' }}>Paste otpauth link</h2>
            <p style={{ margin: '8px 0 0', color: 'var(--color-ink-soft)', lineHeight: 1.5 }}>
              Import directly from an `otpauth://totp/...` URI.
            </p>
            <textarea
              aria-label="otpauth link"
              value={otpauthInput}
              onChange={(event) => setOtpauthInput(event.target.value)}
              rows={6}
              style={{
                width: '100%',
                marginTop: '14px',
                padding: '14px',
                borderRadius: '16px',
                background: 'rgba(248, 251, 254, 0.94)',
                border: '1px solid var(--color-line)',
                color: 'var(--color-ink-strong)',
                resize: 'vertical'
              }}
            />
            <button type="button" onClick={handleOtpAuthImport} style={primaryButtonStyle}>
              Import link
            </button>
          </section>
        )}
        {message ? (
          <p style={{ margin: 0, color: '#9d4156', lineHeight: 1.5 }}>{message}</p>
        ) : null}
      </div>
      <QrImportDialog
        open={qrDialogOpen}
        onClose={() => setQrDialogOpen(false)}
        onImported={(draft) => {
          const account = accountService.addAccount(draft);
          setQrDialogOpen(false);
          onAccountCreated(account.id);
        }}
      />
    </PopupShell>
  );
}

function ModeButton({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '12px 10px',
        borderRadius: '16px',
        background: active ? 'rgba(56, 104, 151, 0.14)' : 'rgba(238, 244, 249, 0.92)',
        border: `1px solid ${active ? 'rgba(56, 104, 151, 0.35)' : 'var(--color-line)'}`,
        color: active ? 'var(--color-brand-strong)' : 'var(--color-ink-soft)',
        cursor: 'pointer'
      }}
    >
      {label}
    </button>
  );
}

const topActionStyle = {
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
  marginTop: '14px',
  padding: '13px 18px',
  borderRadius: '999px',
  background: 'linear-gradient(180deg, #386897 0%, #2c557d 100%)',
  color: '#f8fbff',
  fontWeight: 600,
  cursor: 'pointer'
} satisfies React.CSSProperties;
