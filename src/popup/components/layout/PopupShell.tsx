import type { PropsWithChildren, ReactNode } from 'react';

interface PopupShellProps extends PropsWithChildren {
  topBar?: ReactNode;
  floatingAction?: ReactNode;
}

export function PopupShell({
  topBar,
  floatingAction,
  children
}: PopupShellProps) {
  return (
    <main
      style={{
        position: 'relative',
        minWidth: 'var(--popup-width)',
        minHeight: 'var(--popup-height)',
        padding: '20px',
        color: 'var(--color-ink)'
      }}
    >
      <section
        style={{
          minHeight: 'calc(var(--popup-height) - 40px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          padding: '18px',
          borderRadius: 'var(--radius-shell)',
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(244, 248, 251, 0.94))',
          boxShadow: 'var(--shadow-shell)',
          border: '1px solid rgba(255, 255, 255, 0.82)',
          backdropFilter: 'blur(14px)'
        }}
      >
        {topBar}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>{children}</div>
      </section>
      {floatingAction}
    </main>
  );
}
