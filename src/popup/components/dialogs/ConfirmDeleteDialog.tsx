interface ConfirmDeleteDialogProps {
  accountLabel: string;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export function ConfirmDeleteDialog({
  accountLabel,
  open,
  onCancel,
  onConfirm,
  isSubmitting = false
}: ConfirmDeleteDialogProps) {
  if (!open) {
    return null;
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
        aria-labelledby="delete-account-title"
        style={{
          width: 'min(360px, calc(100vw - 32px))',
          padding: '22px',
          borderRadius: '24px',
          background: 'rgba(255, 255, 255, 0.98)',
          border: '1px solid var(--color-line)',
          boxShadow: '0 28px 50px rgba(30, 54, 82, 0.2)'
        }}
      >
        <h2
          id="delete-account-title"
          style={{ margin: 0, fontSize: '24px', color: 'var(--color-ink-strong)' }}
        >
          Delete account?
        </h2>
        <p
          style={{
            margin: '12px 0 0',
            color: 'var(--color-ink-soft)',
            lineHeight: 1.6
          }}
        >
          This action removes the account from the local vault.
        </p>
        <p
          style={{
            margin: '10px 0 0',
            color: 'var(--color-ink-strong)',
            fontWeight: 600
          }}
        >
          {accountLabel}
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '22px'
          }}
        >
          <DialogButton label="Cancel" onClick={onCancel} disabled={isSubmitting} />
          <DialogButton
            label={isSubmitting ? 'Deleting...' : 'Delete'}
            onClick={onConfirm}
            tone="danger"
            disabled={isSubmitting}
          />
        </div>
      </section>
    </div>
  );
}

function DialogButton({
  label,
  onClick,
  tone = 'default',
  disabled = false
}: {
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: '96px',
        padding: '11px 16px',
        borderRadius: '999px',
        background:
          tone === 'danger'
            ? 'linear-gradient(180deg, #bb5369 0%, #a14157 100%)'
            : 'rgba(238, 244, 249, 0.96)',
        color: tone === 'danger' ? '#fff' : 'var(--color-brand-strong)',
        cursor: disabled ? 'wait' : 'pointer',
        opacity: disabled ? 0.72 : 1
      }}
    >
      {label}
    </button>
  );
}
