import type { ReactNode } from 'react';

interface TopBarProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function TopBar({ eyebrow, title, subtitle, actions }: TopBarProps) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        minHeight: '58px',
        padding: '0 6px',
        flexShrink: 0
      }}
    >
      <div style={{ minWidth: 0 }}>
        {eyebrow ? (
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              color: 'var(--color-ink-soft)'
            }}
          >
            {eyebrow}
          </p>
        ) : null}
        <h1
          style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: 800,
            lineHeight: 1.15,
            color: 'var(--color-ink-strong)'
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p
            style={{
              margin: '8px 0 0',
              fontSize: '12px',
              lineHeight: 1.35,
              color: 'var(--color-ink-soft)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>{actions}</div>
      ) : null}
    </header>
  );
}
