import type { AccountGroup } from '../../../services/account-service';

interface MoveGroupDialogProps {
  accountLabel: string;
  groups: AccountGroup[];
  open: boolean;
  onClose: () => void;
  onSelectGroup: (groupId: string) => void;
  isSubmitting?: boolean;
}

export function MoveGroupDialog({
  accountLabel,
  groups,
  open,
  onClose,
  onSelectGroup,
  isSubmitting = false
}: MoveGroupDialogProps) {
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
        aria-labelledby="move-group-title"
        style={{
          width: 'min(360px, calc(100vw - 32px))',
          padding: '22px',
          borderRadius: '24px',
          background: 'rgba(255, 255, 255, 0.98)',
          border: '1px solid var(--color-line)',
          boxShadow: '0 28px 50px rgba(30, 54, 82, 0.2)'
        }}
      >
        <h2 id="move-group-title" style={{ margin: 0, fontSize: '24px' }}>
          Move account to group
        </h2>
        <p style={{ margin: '12px 0 0', color: 'var(--color-ink-soft)', lineHeight: 1.6 }}>
          Choose where this account should live in the local demo vault.
        </p>
        <p style={{ margin: '10px 0 0', color: 'var(--color-ink-strong)', fontWeight: 600 }}>
          {accountLabel}
        </p>
        <div style={{ display: 'grid', gap: '10px', marginTop: '18px' }}>
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelectGroup(group.id)}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '16px',
                background: 'rgba(248, 251, 254, 0.94)',
                border: '1px solid var(--color-line)',
                color: 'var(--color-ink-strong)',
                textAlign: 'left',
                cursor: isSubmitting ? 'wait' : 'pointer',
                opacity: isSubmitting ? 0.72 : 1
              }}
            >
              {group.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              minWidth: '96px',
              padding: '11px 16px',
              borderRadius: '999px',
              background: 'rgba(238, 244, 249, 0.96)',
              color: 'var(--color-brand-strong)',
              cursor: isSubmitting ? 'wait' : 'pointer',
              opacity: isSubmitting ? 0.72 : 1
            }}
          >
            {isSubmitting ? 'Moving...' : 'Cancel'}
          </button>
        </div>
      </section>
    </div>
  );
}
