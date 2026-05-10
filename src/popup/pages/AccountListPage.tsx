import { AccountCard, type DemoAccount } from '../components/account/AccountCard';
import { FloatingAddButton } from '../components/layout/FloatingAddButton';
import { PopupShell } from '../components/layout/PopupShell';
import { TopBar } from '../components/layout/TopBar';

const demoAccounts: DemoAccount[] = [
  {
    id: 'github-alice',
    issuer: 'GitHub',
    accountName: 'alice@company.com',
    code: '123 456',
    period: 30,
    secondsRemaining: 18
  },
  {
    id: 'google-mail',
    issuer: 'Google',
    accountName: 'product.team@gmail.com',
    code: '528 019',
    period: 30,
    secondsRemaining: 11
  },
  {
    id: 'microsoft-dev',
    issuer: 'Microsoft',
    accountName: 'contoso.dev@outlook.com',
    code: '881 204',
    period: 30,
    secondsRemaining: 24
  },
  {
    id: 'openai-workspace',
    issuer: 'OpenAI',
    accountName: 'workspace-owner',
    code: '402 933',
    period: 30,
    secondsRemaining: 7
  },
  {
    id: 'slack-team',
    issuer: 'Slack',
    accountName: 'design-ops',
    code: '750 811',
    period: 30,
    secondsRemaining: 29
  }
];

function TopActionButton({ label }: { label: 'Sync' | 'Settings' }) {
  const icon = label === 'Sync' ? '↻' : '⚙';

  return (
    <button
      type="button"
      aria-label={label}
      style={{
        width: '36px',
        height: '36px',
        display: 'grid',
        placeItems: 'center',
        borderRadius: '12px',
        background: 'rgba(238, 244, 249, 0.96)',
        border: '1px solid var(--color-line)',
        color: 'var(--color-brand-strong)',
        cursor: 'pointer'
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '16px' }}>
        {icon}
      </span>
    </button>
  );
}

export function AccountListPage() {
  return (
    <PopupShell
      topBar={
        <TopBar
          title="验证码"
          subtitle="你最近使用的账号会保持在上方，卡片主体预留了进入详情的点击区。"
          actions={
            <>
              <TopActionButton label="Sync" />
              <TopActionButton label="Settings" />
            </>
          }
        />
      }
      floatingAction={<FloatingAddButton />}
    >
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          paddingBottom: '88px',
          overflowY: 'auto'
        }}
      >
        {demoAccounts.map((account) => (
          <AccountCard key={account.id} account={account} />
        ))}
      </div>
    </PopupShell>
  );
}
