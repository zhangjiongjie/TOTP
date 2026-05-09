export function App() {
  return (
    <main
      style={{
        minWidth: '360px',
        minHeight: '480px',
        padding: '24px',
        fontFamily: '"Segoe UI", "PingFang SC", sans-serif',
        background:
          'linear-gradient(180deg, #f5f8fc 0%, #e8eef8 100%)',
        color: '#142033',
        boxSizing: 'border-box'
      }}
    >
      <section
        style={{
          padding: '20px',
          borderRadius: '20px',
          background: 'rgba(255, 255, 255, 0.92)',
          boxShadow: '0 16px 40px rgba(20, 32, 51, 0.12)'
        }}
      >
        <p style={{ margin: 0, fontSize: '12px', letterSpacing: '0.08em' }}>
          TOTP Browser Plugin
        </p>
        <h1 style={{ margin: '12px 0 8px', fontSize: '28px' }}>TOTP App</h1>
        <p style={{ margin: 0, lineHeight: 1.6, color: '#41536f' }}>
          React、TypeScript、Vite 与 Manifest V3 脚手架已经就绪，可继续实现
          popup 解锁、列表与同步流程。
        </p>
      </section>
    </main>
  );
}
