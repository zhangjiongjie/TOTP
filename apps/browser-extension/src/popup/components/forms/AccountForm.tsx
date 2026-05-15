import type { FormEvent } from 'react';
import type { AccountFormValues } from '../../../services/account-service';

interface AccountFormProps {
  title?: string;
  submitLabel?: string;
  values: AccountFormValues;
  onChange: (field: keyof AccountFormValues, value: string) => void;
  onSubmit?: () => void;
  helperText?: string;
  isSubmitting?: boolean;
  showSubmitButton?: boolean;
  groups?: Array<{ id: string; label: string }>;
}

export function AccountForm({
  title,
  values,
  onChange,
  onSubmit,
  helperText,
  isSubmitting = false,
  submitLabel = '保存',
  showSubmitButton = true,
  groups = []
}: AccountFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit?.();
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}
    >
      {title || helperText ? (
        <div>
          {title ? (
            <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--color-ink-strong)' }}>
              {title}
            </h2>
          ) : null}
          {helperText ? (
            <p style={{ margin: title ? '8px 0 0' : 0, color: 'var(--color-ink-soft)', lineHeight: 1.5 }}>
              {helperText}
            </p>
          ) : null}
        </div>
      ) : null}
      <Field
        label="发行方"
        ariaLabel="Issuer"
        value={values.issuer}
        onChange={(value) => onChange('issuer', value)}
        placeholder="例如 GitHub / Google"
        disabled={isSubmitting}
      />
      <Field
        label="账号名称"
        ariaLabel="Account name"
        value={values.accountName}
        onChange={(value) => onChange('accountName', value)}
        placeholder="例如 name@example.com"
        disabled={isSubmitting}
      />
      <Field
        label="密钥"
        ariaLabel="Secret"
        value={values.secret}
        onChange={(value) => onChange('secret', value)}
        placeholder="Base32 密钥"
        disabled={isSubmitting}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Field
          label="位数"
          ariaLabel="Digits"
          value={values.digits}
          onChange={(value) => onChange('digits', value)}
          placeholder="6"
          disabled={isSubmitting}
        />
        <Field
          label="周期"
          ariaLabel="Period"
          value={values.period}
          onChange={(value) => onChange('period', value)}
          placeholder="30"
          disabled={isSubmitting}
        />
      </div>
      <label style={{ display: 'grid', gap: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink-soft)' }}>
          算法
        </span>
        <select
          aria-label="Algorithm"
          disabled={isSubmitting}
          value={values.algorithm}
          onChange={(event) => onChange('algorithm', event.target.value)}
          style={fieldStyle}
        >
          <option value="SHA1">SHA1</option>
          <option value="SHA256">SHA256</option>
          <option value="SHA512">SHA512</option>
        </select>
      </label>
      <label style={{ display: 'grid', gap: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink-soft)' }}>
          分组
        </span>
        <select
          aria-label="Group"
          disabled={isSubmitting}
          value={values.groupId}
          onChange={(event) => onChange('groupId', event.target.value)}
          style={fieldStyle}
        >
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.label}
            </option>
          ))}
        </select>
      </label>
      {showSubmitButton ? (
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            marginTop: '4px',
            padding: '13px 18px',
            borderRadius: '999px',
            background: 'var(--color-brand)',
            color: '#f8fbff',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          {isSubmitting ? 'Working...' : submitLabel}
        </button>
      ) : null}
    </form>
  );
}

function Field({
  label,
  ariaLabel,
  value,
  onChange,
  placeholder,
  disabled = false
}: {
  label: string;
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <label style={{ display: 'grid', gap: '8px' }}>
      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink-soft)' }}>
        {label}
      </span>
      <input
        aria-label={ariaLabel ?? label}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        style={fieldStyle}
      />
    </label>
  );
}

const fieldStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '16px',
  background: 'var(--color-input)',
  border: '1px solid var(--color-line)',
  color: 'var(--color-ink-strong)',
  outline: 'none'
} satisfies React.CSSProperties;
