interface CopyButtonProps {
  code: string;
  copied: boolean;
  onCopy: () => void;
}

export function CopyButton({ code, copied, onCopy }: CopyButtonProps) {
  return (
    <button
      type="button"
      aria-label={code}
      onClick={onCopy}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '16px 18px',
        borderRadius: '18px',
        background: copied ? 'rgba(215, 233, 228, 0.92)' : 'var(--color-surface-muted)',
        border: `1px solid ${copied ? 'rgba(47, 110, 98, 0.22)' : 'var(--color-line)'}`,
        cursor: 'pointer',
        transition: 'background 120ms ease, border-color 120ms ease'
      }}
    >
      <span
        style={{
          fontSize: '30px',
          letterSpacing: '0.12em',
          fontWeight: 700,
          color: 'var(--color-ink-strong)'
        }}
      >
        {code}
      </span>
      <span
        style={{
          padding: '8px 12px',
          borderRadius: 'var(--radius-pill)',
          background: copied ? 'rgba(47, 110, 98, 0.14)' : '#fff',
          color: copied ? 'var(--color-success)' : 'var(--color-brand-strong)',
          fontSize: '13px',
          fontWeight: 600
        }}
      >
        {copied ? '已复制' : '复制'}
      </span>
    </button>
  );
}
