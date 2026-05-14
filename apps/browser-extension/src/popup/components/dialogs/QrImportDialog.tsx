import { useEffect, useState } from 'react';
import { importService } from '../../../services/import-service';
import type { AccountDraft } from '../../../services/account-service';

interface QrImportDialogProps {
  open: boolean;
  preferredSource?: 'current-page' | 'upload';
  onClose: () => void;
  onImported: (draft: AccountDraft) => Promise<void> | void;
}

export function QrImportDialog({
  open,
  preferredSource = 'current-page',
  onClose,
  onImported
}: QrImportDialogProps) {
  const [error, setError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isScanningCurrentPage, setIsScanningCurrentPage] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setError('');
    if (preferredSource === 'current-page') {
      void handleCurrentPageScan();
    }
  }, [open, preferredSource]);

  if (!open) {
    return null;
  }

  async function handleCurrentPageScan() {
    if (isImporting || isScanningCurrentPage) {
      return;
    }

    setError('');
    setIsScanningCurrentPage(true);

    try {
      const draft = await importService.fromCurrentTabQr();
      await onImported(draft);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : '无法扫描当前网页二维码，请改用图片上传。'
      );
    } finally {
      setIsScanningCurrentPage(false);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError('');
    setIsImporting(true);

    try {
      const draft = await importService.fromQrFile(file);
      await onImported(draft);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : '无法识别所选二维码图片。'
      );
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  }

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(25, 42, 60, 0.32)',
        backdropFilter: 'blur(10px)',
        zIndex: 10
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-import-title"
        style={{
          width: 'min(380px, calc(100vw - 32px))',
          padding: '22px',
          borderRadius: '24px',
          background: 'rgba(255, 255, 255, 0.98)',
          border: '1px solid var(--color-line)',
          boxShadow: '0 28px 50px rgba(30, 54, 82, 0.2)'
        }}
      >
        <h2 id="qr-import-title" style={{ margin: 0, fontSize: '24px' }}>
          扫描二维码
        </h2>
        <p style={{ margin: '12px 0 0', lineHeight: 1.6, color: 'var(--color-ink-soft)' }}>
          默认会先扫描当前网页中的二维码；如果当前页面无法识别，再手动上传图片。
        </p>
        <div
          style={{
            display: 'grid',
            gap: '12px',
            marginTop: '18px',
          }}
        >
          <button
            type="button"
            onClick={() => void handleCurrentPageScan()}
            disabled={isImporting || isScanningCurrentPage}
            style={{
              minHeight: '46px',
              padding: '0 16px',
              borderRadius: '14px',
              background: 'linear-gradient(180deg, #386897 0%, #2c557d 100%)',
              color: '#f8fbff',
              fontWeight: 600,
              cursor: isImporting || isScanningCurrentPage ? 'wait' : 'pointer',
              opacity: isImporting || isScanningCurrentPage ? 0.72 : 1
            }}
          >
            {isScanningCurrentPage ? '正在扫描当前网页...' : '重新扫描当前网页'}
          </button>
          <label
            style={{
              display: 'block',
              padding: '16px',
              borderRadius: '18px',
              background: 'var(--color-surface-muted)',
              border: '1px dashed var(--color-line)',
              color: 'var(--color-ink-strong)'
            }}
          >
            <span style={{ display: 'block', marginBottom: '10px', fontWeight: 600 }}>
              上传二维码图片
            </span>
            <input
              aria-label="上传二维码图片"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={isImporting || isScanningCurrentPage}
            />
          </label>
        </div>
        {error ? (
          <p style={{ margin: '12px 0 0', color: '#9d4156', lineHeight: 1.5 }}>{error}</p>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '22px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            style={{
              minWidth: '96px',
              padding: '11px 16px',
              borderRadius: '999px',
              background: 'rgba(238, 244, 249, 0.96)',
              color: 'var(--color-brand-strong)',
              cursor: isImporting || isScanningCurrentPage ? 'wait' : 'pointer',
              opacity: isImporting || isScanningCurrentPage ? 0.72 : 1
            }}
          >
            {isImporting || isScanningCurrentPage ? '处理中...' : '关闭'}
          </button>
        </div>
      </section>
    </div>
  );
}
