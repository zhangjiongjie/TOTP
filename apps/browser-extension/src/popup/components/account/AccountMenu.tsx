interface AccountMenuProps {
  open: boolean;
  placement?: 'top' | 'bottom';
  onEdit: () => void;
  onMoveGroup: () => void;
  onDelete: () => void;
}

export function AccountMenu({
  open,
  placement = 'bottom',
  onEdit,
  onMoveGroup,
  onDelete
}: AccountMenuProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      aria-label="Account actions"
      style={{
        position: 'absolute',
        ...(placement === 'top' ? { bottom: '44px' } : { top: '44px' }),
        right: 0,
        width: '172px',
        padding: '8px',
        borderRadius: '18px',
        background: 'rgba(255, 255, 255, 0.98)',
        border: '1px solid var(--color-line)',
        boxShadow: '0 18px 34px rgba(41, 71, 100, 0.18)',
        zIndex: 6
      }}
    >
      <MenuAction label="Edit" onClick={onEdit} />
      <MenuAction label="Move Group" onClick={onMoveGroup} />
      <MenuAction label="Delete" onClick={onDelete} tone="danger" />
    </div>
  );
}

function MenuAction({
  label,
  onClick,
  tone = 'default'
}: {
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: '11px 12px',
        borderRadius: '12px',
        color: tone === 'danger' ? '#a03f54' : 'var(--color-ink-strong)',
        cursor: 'pointer',
        textAlign: 'left'
      }}
    >
      {label}
    </button>
  );
}
