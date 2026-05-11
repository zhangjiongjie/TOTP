import { useEffect, useRef, useState } from 'react';
import { AccountForm } from '../components/forms/AccountForm';
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
  const [messageTone, setMessageTone] = useState<'idle' | 'warning' | 'error'>('idle');
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
    setMessageTone('idle');
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
          ? '已识别当前网页二维码，请确认后保存。'
          : '已重新扫描并填充当前网页二维码信息。'
      );
    } catch (caughtError) {
      if (!silentFailure) {
        setMessage(
          caughtError instanceof Error
            ? caughtError.message
            : '当前网页未识别到二维码，请改用图片上传或手动填写。'
        );
        setMessageTone('warning');
      } else {
        setMessage('未识别到二维码，可上传图片或手动填写。');
        setMessageTone('warning');
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

      applyImportedDraft(draft, '图片解析成功，已自动填充字段。');
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : '无法识别所选二维码图片。');
      setMessageTone('error');
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  }

  function applyImportedDraft(draft: AccountDraft, nextMessage: string) {
    setFormValues((current) => ({
      ...current,
      issuer: draft.issuer,
      accountName: draft.accountName,
      secret: draft.secret,
      digits: String(draft.digits),
      period: String(draft.period),
      algorithm: draft.algorithm,
      groupId: draft.groupId ?? current.groupId
    }));
    setMessage(nextMessage);
    setMessageTone('idle');
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
          eyebrow="Account"
          title="添加账号"
          subtitle="进入页面会先尝试扫描当前网页二维码，也可以上传图片或粘贴 otpauth:// 链接。"
          actions={
            <>
              <button
                type="button"
                aria-label="返回"
                onClick={onBack}
                style={secondaryIconButtonStyle}
              >
                返回
              </button>
              <button
                type="button"
                aria-label="上传图片"
                title="上传二维码图片"
                disabled={isSubmitting || isImporting}
                onClick={() => fileInputRef.current?.click()}
                style={iconButtonStyle}
              >
                <UploadIcon />
              </button>
              <button
                type="button"
                aria-label="重新扫码"
                title="重新扫描当前网页"
                disabled={isSubmitting || isImporting}
                onClick={() => void handleCurrentPageScan({ source: 'manual-scan' })}
                style={iconButtonStyle}
              >
                <ScanIcon />
              </button>
            </>
          }
        />
      }
    >
      <div style={pageLayoutStyle}>
        <div style={formScrollStyle}>
          <input
            ref={fileInputRef}
            aria-label="上传二维码图片"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <section style={panelStyle}>
            <label style={{ display: 'grid', gap: '8px' }}>
              <span style={fieldLabelStyle}>otpauth 链接</span>
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
          </section>
          <section style={panelStyle}>
            <AccountForm
              title="账号信息"
              helperText="Issuer、Account 和 Secret 为必填，其他字段会自动带默认值。"
              values={formValues}
              onChange={updateField}
              isSubmitting={isSubmitting || isImporting}
              showSubmitButton={false}
              groups={accountService.getGroups()}
            />
          </section>
          {message ? (
            <p
              style={{
                margin: 0,
                padding: '12px 14px',
                borderRadius: '16px',
                background:
                  messageTone === 'error'
                    ? 'rgba(252, 236, 240, 0.96)'
                    : messageTone === 'warning'
                      ? 'rgba(233, 240, 248, 0.92)'
                      : 'rgba(241, 246, 250, 0.92)',
                color:
                  messageTone === 'error'
                    ? '#9d4156'
                    : messageTone === 'warning'
                      ? 'var(--color-brand-strong)'
                      : 'var(--color-ink-soft)',
                lineHeight: 1.5
              }}
            >
              {message}
            </p>
          ) : null}
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

function UploadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 13V5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7.25 8.3 10 5.5l2.75 2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 13.5v.75A1.25 1.25 0 0 0 5.75 15.5h8.5a1.25 1.25 0 0 0 1.25-1.25v-.75" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 4.5H4.75A1.25 1.25 0 0 0 3.5 5.75V7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14 4.5h1.25A1.25 1.25 0 0 1 16.5 5.75V7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6 15.5H4.75A1.25 1.25 0 0 1 3.5 14.25V13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14 15.5h1.25a1.25 1.25 0 0 0 1.25-1.25V13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6.5 10h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
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
  borderRadius: '22px',
  background: 'rgba(250, 252, 255, 0.92)',
  border: '1px solid var(--color-line)'
} satisfies React.CSSProperties;

const fieldLabelStyle = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-ink-soft)'
} satisfies React.CSSProperties;

const textAreaStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '16px',
  background: 'rgba(248, 251, 254, 0.94)',
  border: '1px solid var(--color-line)',
  color: 'var(--color-ink-strong)',
  resize: 'vertical'
} satisfies React.CSSProperties;

const secondaryIconButtonStyle = {
  minWidth: '74px',
  height: '36px',
  padding: '0 12px',
  borderRadius: '12px',
  background: 'rgba(238, 244, 249, 0.96)',
  border: '1px solid var(--color-line)',
  color: 'var(--color-brand-strong)',
  cursor: 'pointer'
} satisfies React.CSSProperties;

const iconButtonStyle = {
  width: '36px',
  height: '36px',
  display: 'grid',
  placeItems: 'center',
  borderRadius: '12px',
  background: 'rgba(238, 244, 249, 0.96)',
  border: '1px solid var(--color-line)',
  color: 'var(--color-brand-strong)',
  cursor: 'pointer'
} satisfies React.CSSProperties;

const primaryButtonStyle = {
  width: '100%',
  minHeight: '48px',
  padding: '13px 18px',
  borderRadius: '999px',
  background: 'linear-gradient(180deg, #386897 0%, #2c557d 100%)',
  color: '#f8fbff',
  fontWeight: 600,
  cursor: 'pointer'
} satisfies React.CSSProperties;
