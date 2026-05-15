import { useEffect, useRef, useState } from 'react';
import { AccountForm } from '../components/forms/AccountForm';
import { IconButton } from '../components/layout/IconButton';
import { PopupShell } from '../components/layout/PopupShell';
import { TopBar } from '../components/layout/TopBar';
import {
  accountService,
  getDefaultAccountFormValues,
  type AccountDraft,
  type AccountFormValues
} from '../../services/account-service';
import { importService } from '../../services/import-service';

interface AddAccountPageProps {
  onBack: () => void;
  onAccountCreated: (accountId: string) => void;
}

export function AddAccountPage({
  onBack,
  onAccountCreated
}: AddAccountPageProps) {
  const [formValues, setFormValues] = useState<AccountFormValues>(getDefaultAccountFormValues);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'error'>('error');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void handleCurrentPageScan({ silentFailure: true, source: 'auto-scan' });
  }, []);

  function updateField(field: keyof AccountFormValues, value: string) {
    setFormValues((current) => ({ ...current, [field]: value }));

    if (field !== 'otpauthUri') {
      return;
    }

    if (!value.trim()) {
      return;
    }

    try {
      const parsed = importService.fromOtpAuthUri(value);
      applyImportedDraft(parsed, '链接解析成功，已自动填充字段。');
    } catch {
      // Ignore partial or invalid otpauth input until the user finishes typing.
    }
  }

  async function handleSave() {
    if (isSubmitting || isImporting) {
      return;
    }

    setMessage('');
    setMessageTone('error');
    setIsSubmitting(true);

    try {
      const draft = importService.fromManualForm(formValues);
      const account = await accountService.addAccount(draft);
      onAccountCreated(account.id);
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : '无法添加账号。');
      setMessageTone('error');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleParseOtpAuthUri() {
    setMessage('');
    setMessageTone('error');

    try {
      const parsed = importService.fromOtpAuthUri(formValues.otpauthUri);
      applyImportedDraft(parsed, '已解析', formValues.otpauthUri);
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : '解析失败');
      setMessageTone('error');
    }
  }

  async function handleCurrentPageScan({
    silentFailure = false,
    source
  }: {
    silentFailure?: boolean;
    source: 'auto-scan' | 'manual-scan';
  }) {
    if (isSubmitting || isImporting) {
      return;
    }

    setIsImporting(true);

    try {
      const draft = await importService.fromCurrentTabQr();
      if (!shouldOverwriteForm(draft)) {
        return;
      }

      applyImportedDraft(
        draft,
        source === 'auto-scan'
          ? '已解析'
          : '已解析',
        buildOtpAuthUri(draft)
      );
    } catch (caughtError) {
      if (!silentFailure) {
        setMessage(
          caughtError instanceof Error
            ? caughtError.message
            : '当前网页未识别到二维码，请改用图片上传或手动填写。'
        );
        setMessageTone('error');
      } else {
        setMessage('未识别到二维码，可上传图片或手动填写。');
        setMessageTone('error');
      }
    } finally {
      setIsImporting(false);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || isSubmitting || isImporting) {
      return;
    }

    setIsImporting(true);

    try {
      const draft = await importService.fromQrFile(file);
      if (!shouldOverwriteForm(draft)) {
        return;
      }

      applyImportedDraft(draft, '已解析', buildOtpAuthUri(draft));
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : '无法识别所选二维码图片。');
      setMessageTone('error');
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  }

  function applyImportedDraft(draft: AccountDraft, nextMessage: string, otpauthUri?: string) {
    setFormValues((current) => ({
      ...current,
      otpauthUri: otpauthUri ?? current.otpauthUri,
      issuer: draft.issuer,
      accountName: draft.accountName,
      secret: draft.secret,
      digits: String(draft.digits),
      period: String(draft.period),
      algorithm: draft.algorithm,
      groupId: draft.groupId ?? current.groupId
    }));
    setMessage(nextMessage);
    setMessageTone('success');
  }

  function shouldOverwriteForm(draft: AccountDraft) {
    if (!hasMeaningfulInput(formValues)) {
      return true;
    }

    const nextSnapshot = JSON.stringify({
      issuer: draft.issuer,
      accountName: draft.accountName,
      secret: draft.secret,
      digits: String(draft.digits),
      period: String(draft.period),
      algorithm: draft.algorithm
    });
    const currentSnapshot = JSON.stringify({
      issuer: formValues.issuer.trim(),
      accountName: formValues.accountName.trim(),
      secret: formValues.secret.trim(),
      digits: formValues.digits.trim(),
      period: formValues.period.trim(),
      algorithm: formValues.algorithm
    });

    if (nextSnapshot === currentSnapshot) {
      return true;
    }

    return window.confirm('当前表单已有内容，是否用新识别到的信息覆盖？');
  }

  return (
    <PopupShell
      topBar={
        <TopBar
          title="添加账号"
          actions={
            <>
              <button
                type="button"
                aria-label="返回"
                onClick={onBack}
                style={backButtonStyle}
              >
                <img src="icons/action_back.svg" alt="" aria-hidden="true" style={{ width: '22px', height: '22px' }} />
              </button>
              <IconButton
                label="上传图片"
                title="上传图片"
                disabled={isSubmitting || isImporting}
                onClick={() => fileInputRef.current?.click()}
                icon="icons/action_photo.svg"
              />
              <IconButton
                label="扫描"
                title="扫描"
                disabled={isSubmitting || isImporting}
                onClick={() => void handleCurrentPageScan({ source: 'manual-scan' })}
                icon="icons/action_scan.svg"
              />
            </>
          }
        />
      }
    >
      <div style={pageLayoutStyle}>
        {message ? (
          <p data-testid="add-account-message" style={messageStyle(messageTone)}>
            {message}
          </p>
        ) : null}
        <div style={formScrollStyle}>
          <input
            ref={fileInputRef}
            aria-label="上传图片"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <section style={panelStyle}>
            <label style={{ display: 'grid', gap: '10px' }}>
              <span style={sectionTitleStyle}>otpauth 链接</span>
              <textarea
                aria-label="otpauth link"
                disabled={isSubmitting || isImporting}
                value={formValues.otpauthUri}
                onChange={(event) => updateField('otpauthUri', event.target.value)}
                placeholder="otpauth://totp/..."
                rows={4}
                style={textAreaStyle}
              />
            </label>
            <button
              type="button"
              onClick={handleParseOtpAuthUri}
              disabled={isSubmitting || isImporting}
              style={{ ...primaryButtonStyle, marginTop: '14px', minHeight: '44px' }}
            >
              解析
            </button>
          </section>
          <section style={panelStyle}>
            <AccountForm
              title="账号信息"
              values={formValues}
              onChange={updateField}
              isSubmitting={isSubmitting || isImporting}
              showSubmitButton={false}
              groups={accountService.getGroups()}
            />
          </section>
        </div>
        <div style={footerStyle}>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSubmitting || isImporting}
            style={primaryButtonStyle}
          >
            {isSubmitting ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </PopupShell>
  );
}

function hasMeaningfulInput(values: AccountFormValues) {
  return Boolean(values.issuer.trim() || values.accountName.trim() || values.secret.trim());
}

function buildOtpAuthUri(draft: AccountDraft): string {
  const label = `${draft.issuer}:${draft.accountName}`;
  const params = new URLSearchParams({
    secret: draft.secret,
    issuer: draft.issuer,
    algorithm: draft.algorithm,
    digits: String(draft.digits),
    period: String(draft.period)
  });

  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

function messageStyle(tone: 'success' | 'error'): React.CSSProperties {
  return {
    margin: 0,
    padding: '12px 14px',
    borderRadius: '22px',
    background: 'var(--color-card)',
    border: '1px solid var(--color-line)',
    color: tone === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
    lineHeight: 1.45,
    fontSize: '13px'
  };
}

const pageLayoutStyle = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  gap: '14px'
} satisfies React.CSSProperties;

const formScrollStyle = {
  display: 'grid',
  gap: '14px',
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  paddingRight: '4px'
} satisfies React.CSSProperties;

const footerStyle = {
  display: 'flex',
  justifyContent: 'stretch',
  paddingTop: '6px'
} satisfies React.CSSProperties;

const panelStyle = {
  padding: '18px',
  borderRadius: 'var(--radius-card)',
  background: 'var(--color-card)',
  border: '1px solid var(--color-line)'
} satisfies React.CSSProperties;

const sectionTitleStyle = {
  fontSize: '20px',
  fontWeight: 700,
  color: 'var(--color-ink-strong)'
} satisfies React.CSSProperties;

const textAreaStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '16px',
  background: 'var(--color-input)',
  border: '1px solid var(--color-line)',
  color: 'var(--color-ink-strong)',
  resize: 'vertical'
} satisfies React.CSSProperties;

const backButtonStyle = {
  width: '42px',
  height: '42px',
  display: 'grid',
  placeItems: 'center',
  borderRadius: '50%',
  background: 'var(--color-card-muted)',
  border: '1px solid var(--color-line)',
  cursor: 'pointer'
} satisfies React.CSSProperties;

const primaryButtonStyle = {
  width: '100%',
  minHeight: '48px',
  padding: '13px 18px',
  borderRadius: '999px',
  background: 'var(--color-brand)',
  color: '#f8fbff',
  fontWeight: 600,
  cursor: 'pointer'
} satisfies React.CSSProperties;
