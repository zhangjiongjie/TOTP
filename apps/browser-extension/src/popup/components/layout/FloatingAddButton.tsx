interface FloatingAddButtonProps {
  onClick?: () => void;
}

export function FloatingAddButton({ onClick }: FloatingAddButtonProps) {
  return (
    <button
      type="button"
      aria-label="Add account"
      onClick={onClick}
      style={{
        position: 'absolute',
        right: '24px',
        bottom: '24px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '0 16px',
        minWidth: '58px',
        height: '48px',
        borderRadius: 'var(--radius-pill)',
        background: 'var(--color-brand)',
        color: '#f8fbff',
        boxShadow: '0 12px 24px rgba(28, 70, 110, 0.3)',
        cursor: 'pointer'
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px',
          borderRadius: '50%'
        }}
      >
        <img src="icons/nav_add.svg" alt="" aria-hidden="true" style={{ width: '22px', height: '22px' }} />
      </span>
    </button>
  );
}
