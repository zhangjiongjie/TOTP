import { PopupShell } from '../components/layout/PopupShell';
import { TopBar } from '../components/layout/TopBar';
import { UnlockForm, type UnlockMode } from '../components/forms/UnlockForm';

interface UnlockPageProps {
  mode: UnlockMode;
  message?: string | null;
  onSubmit?: (password: string) => void;
}

export function UnlockPage({ mode, message = null, onSubmit }: UnlockPageProps) {
  const subtitle =
    mode === 'setup'
      ? '首次打开时先创建本地主密码，之后才能查看和同步验证码。'
      : '你的账号数据已经就绪，输入主密码即可安全解锁。';

  return (
    <PopupShell
      topBar={<TopBar eyebrow="Security" title="TOTP 保管库" subtitle={subtitle} />}
    >
      <div
        style={{
          width: '100%',
          display: 'grid',
          alignContent: 'center'
        }}
      >
        <UnlockForm mode={mode} onSubmit={onSubmit} />
        {message ? (
          <p style={{ margin: '14px 0 0', color: '#9d4156', lineHeight: 1.5 }}>{message}</p>
        ) : null}
      </div>
    </PopupShell>
  );
}
