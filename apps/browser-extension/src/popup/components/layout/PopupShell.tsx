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
        width: 'var(--popup-width)',
        height: 'var(--popup-height)',
        padding: '16px',
        color: 'var(--color-ink)',
        background: 'var(--color-shell)',
        overflow: 'hidden'
      }}
    >
      <section
        style={{
          height: 'calc(var(--popup-height) - 32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          padding: '12px 10px 0',
          borderRadius: 'var(--radius-shell)',
          background: 'var(--color-shell)',
          boxShadow: 'var(--shadow-shell)',
          overflow: 'hidden'
        }}
      >
        {topBar}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>{children}</div>
      </section>
      {floatingAction}
    </main>
  );
}
