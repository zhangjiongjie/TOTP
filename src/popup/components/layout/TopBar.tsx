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
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '16px'
      }}
    >
      <div>
        {eyebrow ? (
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-soft)'
            }}
          >
            {eyebrow}
          </p>
        ) : null}
        <h1
          style={{
            margin: eyebrow ? '6px 0 0' : 0,
            fontSize: '30px',
            fontWeight: 600,
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
              fontSize: '14px',
              lineHeight: 1.5,
              color: 'var(--color-ink-soft)'
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
