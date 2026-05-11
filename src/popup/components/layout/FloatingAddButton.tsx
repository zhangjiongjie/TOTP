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
        right: '32px',
        bottom: '32px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        padding: '14px 18px',
        borderRadius: 'var(--radius-pill)',
        background: 'linear-gradient(180deg, #386897 0%, #2c557d 100%)',
        color: '#f8fbff',
        boxShadow: '0 14px 28px rgba(28, 70, 110, 0.28)',
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
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.16)',
          fontSize: '20px',
          lineHeight: 1
        }}
      >
        +
      </span>
      <span style={{ fontWeight: 600 }}>Add</span>
    </button>
  );
}
