interface IconButtonProps {
  label: string;
  icon: string;
  title?: string;
  disabled?: boolean;
  onClick?: () => void;
}

export function IconButton({
  label,
  icon,
  title,
  disabled = false,
  onClick
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: '42px',
        height: '42px',
        display: 'grid',
        placeItems: 'center',
        borderRadius: '50%',
        background: 'var(--color-card-muted)',
        border: '1px solid var(--color-line)',
        color: 'var(--color-brand-strong)',
        cursor: disabled ? 'wait' : 'pointer',
        opacity: disabled ? 0.54 : 1
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '22px',
          height: '22px',
          background: 'var(--color-brand)',
          maskImage: `url(${icon})`,
          maskRepeat: 'no-repeat',
          maskPosition: 'center',
          maskSize: 'contain',
          WebkitMaskImage: `url(${icon})`,
          WebkitMaskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          WebkitMaskSize: 'contain'
        }}
      />
    </button>
  );
}
