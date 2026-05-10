import { useState } from 'react';
import { importService } from '../../../services/import-service';
import type { AccountDraft } from '../../../services/account-service';

interface QrImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: (draft: AccountDraft) => Promise<void> | void;
}

export function QrImportDialog({
  open,
  onClose,
  onImported
}: QrImportDialogProps) {
  const [error, setError] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  if (!open) {
    return null;
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError('');
    setIsImporting(true);

    try {
      const draft = await importService.fromQrFile(file);
      await onImported(draft);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to decode the selected QR image.'
      );
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  }

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(25, 42, 60, 0.32)',
        backdropFilter: 'blur(10px)',
        zIndex: 10
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-import-title"
        style={{
          width: 'min(380px, calc(100vw - 32px))',
          padding: '22px',
          borderRadius: '24px',
          background: 'rgba(255, 255, 255, 0.98)',
          border: '1px solid var(--color-line)',
          boxShadow: '0 28px 50px rgba(30, 54, 82, 0.2)'
        }}
      >
        <h2 id="qr-import-title" style={{ margin: 0, fontSize: '24px' }}>
          Import QR image
        </h2>
        <p style={{ margin: '12px 0 0', lineHeight: 1.6, color: 'var(--color-ink-soft)' }}>
          Select a screenshot or exported QR image. If this browser cannot decode QR
          images, use the otpauth link import instead.
        </p>
        <label
          style={{
            display: 'block',
            marginTop: '18px',
            padding: '16px',
            borderRadius: '18px',
            background: 'var(--color-surface-muted)',
            border: '1px dashed var(--color-line)',
            color: 'var(--color-ink-strong)'
          }}
        >
          <span style={{ display: 'block', marginBottom: '10px', fontWeight: 600 }}>
            Choose image
          </span>
          <input type="file" accept="image/*" onChange={handleFileChange} disabled={isImporting} />
        </label>
        {error ? (
          <p style={{ margin: '12px 0 0', color: '#9d4156', lineHeight: 1.5 }}>{error}</p>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '22px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            style={{
              minWidth: '96px',
              padding: '11px 16px',
              borderRadius: '999px',
              background: 'rgba(238, 244, 249, 0.96)',
              color: 'var(--color-brand-strong)',
              cursor: isImporting ? 'wait' : 'pointer',
              opacity: isImporting ? 0.72 : 1
            }}
          >
            {isImporting ? 'Working...' : 'Close'}
          </button>
        </div>
      </section>
    </div>
  );
}
