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
  const icon =
    label === 'Sync' ? (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M4.25 5.5A4.5 4.5 0 0 1 12 7h1.75L11.5 9.25 9.25 7H11a3 3 0 1 0 .58 1.76"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ) : (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M8 5.75A2.25 2.25 0 1 0 8 10.25 2.25 2.25 0 0 0 8 5.75Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M8 1.75V3M8 13V14.25M13 8H14.25M1.75 8H3M11.71 4.29L12.6 3.4M3.4 12.6L4.29 11.71M11.71 11.71L12.6 12.6M3.4 3.4L4.29 4.29"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    );

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
      <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center' }}>
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
          eyebrow="Authenticator"
          title="TOTP Authenticator"
          subtitle={`${demoAccounts.length} 个账号已就绪，点击验证码即可快速复制。`}
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
