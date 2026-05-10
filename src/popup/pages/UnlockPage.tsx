import { PopupShell } from '../components/layout/PopupShell';
import { TopBar } from '../components/layout/TopBar';
import { UnlockForm, type UnlockMode } from '../components/forms/UnlockForm';

interface UnlockPageProps {
  mode: UnlockMode;
  onSubmit?: (password: string) => void;
}

export function UnlockPage({ mode, onSubmit }: UnlockPageProps) {
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
      </div>
    </PopupShell>
  );
}
