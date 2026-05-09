# TOTP 浏览器插件实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 交付一个可在 Chrome / Edge 中运行的 TOTP 浏览器插件，支持主密码解锁、TOTP 列表、品牌图标、手动 / `otpauth://` / 二维码导入、导入导出与可选 WebDAV 同步。

**架构：** 使用 React + TypeScript + Vite + Manifest V3 构建浏览器插件。项目按 `popup-ui`、`totp-core`、`vault-core`、`sync-core` 四层拆分，核心逻辑保持无框架依赖，UI 仅消费经过封装的应用服务与状态存储。

**技术栈：** React、TypeScript、Vite、Vitest、React Testing Library、Web Crypto API、WebDAV、二维码解析库

---

## 文件结构

### 根目录文件

- 创建：`package.json`
- 创建：`tsconfig.json`
- 创建：`tsconfig.node.json`
- 创建：`vite.config.ts`
- 创建：`manifest.config.ts`
- 创建：`index.html`
- 创建：`public/manifest.json`
- 创建：`public/icons/icon-16.png`
- 创建：`public/icons/icon-32.png`
- 创建：`public/icons/icon-48.png`
- 创建：`public/icons/icon-128.png`
- 创建：`README.md`

### 应用入口

- 创建：`src/main.tsx`
- 创建：`src/popup/App.tsx`
- 创建：`src/popup/bootstrap.ts`
- 创建：`src/popup/routes.tsx`

### UI 与样式

- 创建：`src/popup/styles/tokens.css`
- 创建：`src/popup/styles/global.css`
- 创建：`src/popup/components/layout/PopupShell.tsx`
- 创建：`src/popup/components/layout/TopBar.tsx`
- 创建：`src/popup/components/layout/FloatingAddButton.tsx`
- 创建：`src/popup/components/account/AccountCard.tsx`
- 创建：`src/popup/components/account/AccountMenu.tsx`
- 创建：`src/popup/components/account/CountdownRing.tsx`
- 创建：`src/popup/components/account/CopyButton.tsx`
- 创建：`src/popup/components/forms/UnlockForm.tsx`
- 创建：`src/popup/components/forms/AccountForm.tsx`
- 创建：`src/popup/components/forms/WebDavForm.tsx`
- 创建：`src/popup/components/forms/ImportExportPanel.tsx`
- 创建：`src/popup/components/dialogs/ConfirmDeleteDialog.tsx`
- 创建：`src/popup/components/dialogs/SyncConflictDialog.tsx`
- 创建：`src/popup/components/dialogs/QrImportDialog.tsx`

### 页面

- 创建：`src/popup/pages/UnlockPage.tsx`
- 创建：`src/popup/pages/AccountListPage.tsx`
- 创建：`src/popup/pages/AccountDetailPage.tsx`
- 创建：`src/popup/pages/SettingsPage.tsx`
- 创建：`src/popup/pages/AddAccountPage.tsx`

### 核心领域

- 创建：`src/core/types.ts`
- 创建：`src/core/time.ts`
- 创建：`src/core/errors.ts`
- 创建：`src/core/accounts/account-schema.ts`
- 创建：`src/core/accounts/account-sort.ts`
- 创建：`src/core/icons/icon-registry.ts`
- 创建：`src/core/icons/icon-matchers.ts`
- 创建：`src/core/icons/assets/*.svg`
- 创建：`src/core/totp/totp.ts`
- 创建：`src/core/totp/base32.ts`
- 创建：`src/core/totp/otpauth.ts`
- 创建：`src/core/import/qr-decode.ts`
- 创建：`src/core/vault/crypto.ts`
- 创建：`src/core/vault/password.ts`
- 创建：`src/core/vault/export.ts`
- 创建：`src/core/vault/vault-store.ts`
- 创建：`src/core/sync/webdav-client.ts`
- 创建：`src/core/sync/sync-engine.ts`
- 创建：`src/core/sync/conflict.ts`

### 状态与服务

- 创建：`src/state/app-store.ts`
- 创建：`src/state/session-store.ts`
- 创建：`src/state/sync-store.ts`
- 创建：`src/services/account-service.ts`
- 创建：`src/services/import-service.ts`
- 创建：`src/services/sync-service.ts`
- 创建：`src/services/settings-service.ts`

### 测试

- 创建：`src/core/totp/totp.test.ts`
- 创建：`src/core/totp/otpauth.test.ts`
- 创建：`src/core/icons/icon-matchers.test.ts`
- 创建：`src/core/vault/crypto.test.ts`
- 创建：`src/core/vault/export.test.ts`
- 创建：`src/core/sync/conflict.test.ts`
- 创建：`src/core/sync/sync-engine.test.ts`
- 创建：`src/popup/components/account/AccountCard.test.tsx`
- 创建：`src/popup/pages/UnlockPage.test.tsx`
- 创建：`src/popup/pages/AccountListPage.test.tsx`
- 创建：`vitest.setup.ts`

## 任务 1：初始化插件工程与测试基础设施

**文件：**
- 创建：`package.json`
- 创建：`tsconfig.json`
- 创建：`tsconfig.node.json`
- 创建：`vite.config.ts`
- 创建：`manifest.config.ts`
- 创建：`index.html`
- 创建：`public/manifest.json`
- 创建：`src/main.tsx`
- 创建：`src/popup/App.tsx`
- 创建：`src/popup/bootstrap.ts`
- 创建：`README.md`
- 测试：`package.json`

- [ ] **步骤 1：编写失败的工程存在性测试**

```json
{
  "scripts": {
    "test:plan-smoke": "node -e \"const fs=require('fs');['package.json','vite.config.ts','src/main.tsx'].forEach((f)=>{if(!fs.existsSync(f)) throw new Error(f+' missing')})\""
  }
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test:plan-smoke`
预期：FAIL，报错缺少 `package.json`、`vite.config.ts` 或 `src/main.tsx`

- [ ] **步骤 3：创建最小可运行脚手架**

```json
{
  "name": "totp-browser-plugin",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:plan-smoke": "node -e \"const fs=require('fs');['package.json','vite.config.ts','src/main.tsx'].forEach((f)=>{if(!fs.existsSync(f)) throw new Error(f+' missing')})\""
  }
}
```

```ts
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './popup/App';

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
```

- [ ] **步骤 4：配置 Manifest V3 与构建出口**

```json
{
  "manifest_version": 3,
  "name": "TOTP App",
  "version": "0.1.0",
  "action": {
    "default_popup": "index.html"
  },
  "permissions": ["storage"],
  "host_permissions": ["<all_urls>"]
}
```

- [ ] **步骤 5：运行测试与构建验证通过**

运行：`npm run test:plan-smoke && npm run build`
预期：PASS，生成 `dist/` 且无 TypeScript 构建错误

- [ ] **步骤 6：Commit**

```bash
git add package.json tsconfig.json tsconfig.node.json vite.config.ts manifest.config.ts index.html public src/main.tsx src/popup/App.tsx src/popup/bootstrap.ts README.md
git commit -m "chore(插件): 初始化浏览器插件脚手架"
```

## 任务 2：建立领域模型、图标注册表与 TOTP 核心

**文件：**
- 创建：`src/core/types.ts`
- 创建：`src/core/errors.ts`
- 创建：`src/core/time.ts`
- 创建：`src/core/accounts/account-schema.ts`
- 创建：`src/core/accounts/account-sort.ts`
- 创建：`src/core/icons/icon-registry.ts`
- 创建：`src/core/icons/icon-matchers.ts`
- 创建：`src/core/icons/assets/*.svg`
- 创建：`src/core/totp/base32.ts`
- 创建：`src/core/totp/totp.ts`
- 创建：`src/core/totp/otpauth.ts`
- 测试：`src/core/totp/totp.test.ts`
- 测试：`src/core/totp/otpauth.test.ts`
- 测试：`src/core/icons/icon-matchers.test.ts`

- [ ] **步骤 1：编写 TOTP、URI 解析与图标映射失败测试**

```ts
// src/core/totp/totp.test.ts
import { describe, expect, it } from 'vitest';
import { generateTotpCode } from './totp';

describe('generateTotpCode', () => {
  it('uses RFC 6238 vector', async () => {
    const code = await generateTotpCode({
      secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
      digits: 8,
      period: 30,
      algorithm: 'SHA1',
      timestamp: 59000
    });

    expect(code).toBe('94287082');
  });
});
```

```ts
// src/core/totp/otpauth.test.ts
import { expect, it } from 'vitest';
import { parseOtpAuthUri } from './otpauth';

it('parses issuer and account name', () => {
  const parsed = parseOtpAuthUri('otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub');
  expect(parsed.issuer).toBe('GitHub');
  expect(parsed.accountName).toBe('alice');
});
```

```ts
// src/core/icons/icon-matchers.test.ts
import { expect, it } from 'vitest';
import { resolveIconKey } from './icon-matchers';

it('matches GitHub issuer to github icon', () => {
  expect(resolveIconKey({ issuer: 'GitHub', accountName: 'alice' })).toBe('github');
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test -- src/core/totp/totp.test.ts src/core/totp/otpauth.test.ts src/core/icons/icon-matchers.test.ts`
预期：FAIL，报错模块不存在或函数未定义

- [ ] **步骤 3：实现基础类型、TOTP 计算与 URI 解析**

```ts
export type TotpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';

export interface AccountRecord {
  id: string;
  issuer: string;
  accountName: string;
  secret: string;
  digits: number;
  period: number;
  algorithm: TotpAlgorithm;
  tags: string[];
  groupId: string | null;
  pinned: boolean;
  iconKey: string | null;
  updatedAt: string;
}
```

```ts
export function parseOtpAuthUri(uri: string) {
  const url = new URL(uri);
  const label = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const [issuerFromLabel, accountName] = label.includes(':') ? label.split(':', 2) : ['', label];
  return {
    issuer: url.searchParams.get('issuer') ?? issuerFromLabel,
    accountName,
    secret: url.searchParams.get('secret') ?? '',
    digits: Number(url.searchParams.get('digits') ?? '6'),
    period: Number(url.searchParams.get('period') ?? '30'),
    algorithm: (url.searchParams.get('algorithm') ?? 'SHA1').toUpperCase()
  };
}
```

- [ ] **步骤 4：实现图标注册表与首批品牌资源**

```ts
export const iconRegistry = {
  github: githubSvg,
  google: googleSvg,
  microsoft: microsoftSvg,
  slack: slackSvg,
  openai: openaiSvg
} as const;

export function resolveIconKey(input: { issuer: string; accountName: string }) {
  const normalized = input.issuer.trim().toLowerCase();
  if (normalized.includes('github')) return 'github';
  if (normalized.includes('microsoft')) return 'microsoft';
  return null;
}
```

- [ ] **步骤 5：运行测试验证通过**

运行：`npm run test -- src/core/totp/totp.test.ts src/core/totp/otpauth.test.ts src/core/icons/icon-matchers.test.ts`
预期：PASS

- [ ] **步骤 6：Commit**

```bash
git add src/core/types.ts src/core/errors.ts src/core/time.ts src/core/accounts src/core/icons src/core/totp
git commit -m "feat(核心): 添加 TOTP 计算与图标映射"
```

## 任务 3：实现主密码、加密存储与导入导出格式

**文件：**
- 创建：`src/core/vault/password.ts`
- 创建：`src/core/vault/crypto.ts`
- 创建：`src/core/vault/export.ts`
- 创建：`src/core/vault/vault-store.ts`
- 创建：`src/state/session-store.ts`
- 测试：`src/core/vault/crypto.test.ts`
- 测试：`src/core/vault/export.test.ts`

- [ ] **步骤 1：编写加密与导入导出失败测试**

```ts
import { expect, it } from 'vitest';
import { encryptVault, decryptVault } from './crypto';

it('round-trips encrypted vault payload', async () => {
  const encrypted = await encryptVault({ version: 1, accounts: [] }, 'pass123456');
  const decrypted = await decryptVault(encrypted, 'pass123456');
  expect(decrypted.version).toBe(1);
});
```

```ts
import { expect, it } from 'vitest';
import { exportVaultBundle, importVaultBundle } from './export';

it('exports and imports encrypted bundle', async () => {
  const exported = await exportVaultBundle({ version: 1, accounts: [] }, 'secret');
  const imported = await importVaultBundle(exported, 'secret');
  expect(imported.accounts).toEqual([]);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test -- src/core/vault/crypto.test.ts src/core/vault/export.test.ts`
预期：FAIL，报错模块缺失或函数不存在

- [ ] **步骤 3：实现主密码派生与 Vault 加解密**

```ts
export async function deriveAesKey(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
```

- [ ] **步骤 4：实现持久化存储与会话解锁状态**

```ts
export interface SessionState {
  isUnlocked: boolean;
  keyMaterial: CryptoKey | null;
  unlockedAt: string | null;
}
```

```ts
export async function loadEncryptedVault() {
  const result = await chrome.storage.local.get(['vault']);
  return result.vault ?? null;
}
```

- [ ] **步骤 5：实现明文 / 加密导入导出格式**

```ts
export type ExportBundle =
  | { mode: 'plain'; vault: VaultPayload }
  | { mode: 'encrypted'; encryptedVault: EncryptedVaultBlob };
```

- [ ] **步骤 6：运行测试验证通过**

运行：`npm run test -- src/core/vault/crypto.test.ts src/core/vault/export.test.ts`
预期：PASS

- [ ] **步骤 7：Commit**

```bash
git add src/core/vault src/state/session-store.ts
git commit -m "feat(存储): 添加主密码与加密 Vault"
```

## 任务 4：实现 WebDAV 同步引擎、冲突检测与离线容错

**文件：**
- 创建：`src/core/sync/webdav-client.ts`
- 创建：`src/core/sync/conflict.ts`
- 创建：`src/core/sync/sync-engine.ts`
- 创建：`src/state/sync-store.ts`
- 创建：`src/services/sync-service.ts`
- 测试：`src/core/sync/conflict.test.ts`
- 测试：`src/core/sync/sync-engine.test.ts`

- [ ] **步骤 1：编写同步与冲突失败测试**

```ts
import { expect, it } from 'vitest';
import { detectVaultConflict } from './conflict';

it('flags conflict when local and remote changed after base revision', () => {
  const result = detectVaultConflict({
    baseRevision: 'r1',
    localRevision: 'r2',
    remoteRevision: 'r3',
    localUpdatedAt: '2026-05-10T10:00:00Z',
    remoteUpdatedAt: '2026-05-10T10:01:00Z'
  });

  expect(result.type).toBe('conflict');
});
```

```ts
import { expect, it, vi } from 'vitest';
import { createSyncEngine } from './sync-engine';

it('returns local cache when remote fetch fails', async () => {
  const engine = createSyncEngine({
    fetchRemote: vi.fn().mockRejectedValue(new Error('offline')),
    pushRemote: vi.fn(),
    loadLocal: vi.fn().mockResolvedValue({ version: 1, accounts: [] }),
    saveLocal: vi.fn()
  });

  const result = await engine.syncOnOpen();
  expect(result.source).toBe('local-cache');
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test -- src/core/sync/conflict.test.ts src/core/sync/sync-engine.test.ts`
预期：FAIL

- [ ] **步骤 3：实现 WebDAV 客户端与同步元信息模型**

```ts
export interface WebDavProfile {
  enabled: boolean;
  url: string;
  username: string;
  encryptedCredential: string;
  remotePath: string;
}
```

```ts
export async function readRemoteVault(profile: WebDavProfile, credential: string) {
  const response = await fetch(profile.remotePath, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${btoa(`${profile.username}:${credential}`)}`
    }
  });
  if (!response.ok) throw new Error(`webdav-read-${response.status}`);
  return response.text();
}
```

- [ ] **步骤 4：实现打开即拉取、手动同步、定时同步策略**

```ts
export function createSyncEngine(deps: SyncEngineDeps) {
  return {
    async syncOnOpen() {
      const local = await deps.loadLocal();
      try {
        const remote = await deps.fetchRemote();
        return reconcileVaults(local, remote);
      } catch {
        return { source: 'local-cache', vault: local };
      }
    }
  };
}
```

- [ ] **步骤 5：实现冲突对话框所需的数据结构**

```ts
export type SyncDecision =
  | { type: 'apply-local' }
  | { type: 'apply-remote' }
  | { type: 'no-conflict' };
```

- [ ] **步骤 6：运行测试验证通过**

运行：`npm run test -- src/core/sync/conflict.test.ts src/core/sync/sync-engine.test.ts`
预期：PASS

- [ ] **步骤 7：Commit**

```bash
git add src/core/sync src/state/sync-store.ts src/services/sync-service.ts
git commit -m "feat(同步): 添加 WebDAV 同步与冲突检测"
```

## 任务 5：实现解锁页、列表页与微软风扁平 UI 骨架

**文件：**
- 创建：`src/popup/styles/tokens.css`
- 创建：`src/popup/styles/global.css`
- 创建：`src/popup/routes.tsx`
- 创建：`src/popup/components/layout/PopupShell.tsx`
- 创建：`src/popup/components/layout/TopBar.tsx`
- 创建：`src/popup/components/layout/FloatingAddButton.tsx`
- 创建：`src/popup/components/forms/UnlockForm.tsx`
- 创建：`src/popup/pages/UnlockPage.tsx`
- 创建：`src/popup/pages/AccountListPage.tsx`
- 创建：`src/popup/components/account/CountdownRing.tsx`
- 创建：`src/popup/components/account/CopyButton.tsx`
- 创建：`src/popup/components/account/AccountCard.tsx`
- 测试：`src/popup/pages/UnlockPage.test.tsx`
- 测试：`src/popup/pages/AccountListPage.test.tsx`
- 测试：`src/popup/components/account/AccountCard.test.tsx`

- [ ] **步骤 1：编写 UI 交互失败测试**

```tsx
import { render, screen } from '@testing-library/react';
import { UnlockPage } from './UnlockPage';

it('shows create-password mode when vault is not initialized', () => {
  render(<UnlockPage mode="setup" onSubmit={async () => {}} />);
  expect(screen.getByText('创建主密码')).toBeInTheDocument();
});
```

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { AccountCard } from './AccountCard';

it('copies code when code area is clicked', async () => {
  render(<AccountCard account={mockAccount} code="123456" remainingSeconds={18} onCopy={async () => {}} />);
  fireEvent.click(screen.getByText('123456'));
  expect(screen.getByText('Copied')).toBeInTheDocument();
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test -- src/popup/pages/UnlockPage.test.tsx src/popup/pages/AccountListPage.test.tsx src/popup/components/account/AccountCard.test.tsx`
预期：FAIL

- [ ] **步骤 3：搭建全局设计令牌与布局壳**

```css
:root {
  --bg-shell: #e6edf6;
  --bg-card: rgba(248, 251, 255, 0.88);
  --text-primary: #0b1d39;
  --text-secondary: #5d718a;
  --accent-muted: #7b97b7;
  --shadow-soft: 10px 12px 22px rgba(176, 191, 211, 0.28);
  --radius-card: 22px;
}
```

```tsx
export function PopupShell({ children }: { children: React.ReactNode }) {
  return <main className="popup-shell">{children}</main>;
}
```

- [ ] **步骤 4：实现解锁页与列表页骨架**

```tsx
export function UnlockPage({ mode, onSubmit }: UnlockPageProps) {
  return (
    <PopupShell>
      <h1>{mode === 'setup' ? '创建主密码' : '解锁 TOTP App'}</h1>
      <UnlockForm mode={mode} onSubmit={onSubmit} />
    </PopupShell>
  );
}
```

```tsx
export function AccountListPage() {
  return (
    <PopupShell>
      <TopBar title="TOTP App" actions={['sync', 'settings']} />
      <FloatingAddButton />
    </PopupShell>
  );
}
```

- [ ] **步骤 5：实现账号卡片、复制反馈与倒计时圆环**

```tsx
export function AccountCard({ account, code, remainingSeconds, onCopy }: AccountCardProps) {
  return (
    <article className="account-card">
      <div className="account-card__main">
        <img src={account.iconSvg} alt="" />
        <div>
          <p>{account.issuer}</p>
          <button onClick={() => void onCopy(account.id, code)}>{code}</button>
        </div>
      </div>
      <CountdownRing remainingSeconds={remainingSeconds} period={account.period} />
    </article>
  );
}
```

- [ ] **步骤 6：运行测试验证通过**

运行：`npm run test -- src/popup/pages/UnlockPage.test.tsx src/popup/pages/AccountListPage.test.tsx src/popup/components/account/AccountCard.test.tsx`
预期：PASS

- [ ] **步骤 7：Commit**

```bash
git add src/popup/styles src/popup/routes.tsx src/popup/components src/popup/pages
git commit -m "feat(UI): 添加解锁页与列表页骨架"
```

## 任务 6：实现账号添加、编辑、删除与导入流程

**文件：**
- 创建：`src/popup/components/forms/AccountForm.tsx`
- 创建：`src/popup/components/dialogs/ConfirmDeleteDialog.tsx`
- 创建：`src/popup/components/dialogs/QrImportDialog.tsx`
- 创建：`src/popup/pages/AddAccountPage.tsx`
- 创建：`src/popup/pages/AccountDetailPage.tsx`
- 创建：`src/services/account-service.ts`
- 创建：`src/services/import-service.ts`
- 创建：`src/core/import/qr-decode.ts`
- 创建：`src/popup/components/account/AccountMenu.tsx`
- 测试：`src/popup/pages/AccountListPage.test.tsx`

- [ ] **步骤 1：扩展失败测试，覆盖复制、编辑与删除入口**

```tsx
it('opens menu actions for edit and delete', async () => {
  render(<AccountCard account={mockAccount} code="123456" remainingSeconds={20} onCopy={async () => {}} />);
  await userEvent.click(screen.getByRole('button', { name: '更多操作' }));
  expect(screen.getByText('Edit')).toBeInTheDocument();
  expect(screen.getByText('Delete')).toBeInTheDocument();
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test -- src/popup/pages/AccountListPage.test.tsx src/popup/components/account/AccountCard.test.tsx`
预期：FAIL，缺少菜单或新增流程组件

- [ ] **步骤 3：实现手动添加与详情编辑页**

```tsx
export function AccountForm({ initialValue, onSubmit }: AccountFormProps) {
  return (
    <form onSubmit={handleSubmit}>
      <input name="issuer" defaultValue={initialValue?.issuer ?? ''} />
      <input name="accountName" defaultValue={initialValue?.accountName ?? ''} />
      <input name="secret" defaultValue={initialValue?.secret ?? ''} />
    </form>
  );
}
```

- [ ] **步骤 4：实现 `otpauth://` 粘贴导入与二维码图片导入**

```ts
export async function importFromQrFile(file: File) {
  const otpauth = await decodeQrImage(file);
  return parseOtpAuthUri(otpauth);
}
```

- [ ] **步骤 5：实现删除确认与移动分组**

```tsx
export function ConfirmDeleteDialog({ issuer, onConfirm, onCancel }: ConfirmDeleteDialogProps) {
  return (
    <dialog open>
      <p>确认删除 {issuer} 吗？</p>
      <button onClick={onCancel}>取消</button>
      <button onClick={onConfirm}>删除</button>
    </dialog>
  );
}
```

- [ ] **步骤 6：运行测试验证通过**

运行：`npm run test -- src/popup/pages/AccountListPage.test.tsx src/popup/components/account/AccountCard.test.tsx`
预期：PASS

- [ ] **步骤 7：Commit**

```bash
git add src/popup/components/forms/AccountForm.tsx src/popup/components/dialogs src/popup/pages/AddAccountPage.tsx src/popup/pages/AccountDetailPage.tsx src/services/account-service.ts src/services/import-service.ts src/core/import/qr-decode.ts src/popup/components/account/AccountMenu.tsx
git commit -m "feat(账号): 添加新增编辑删除与导入流程"
```

## 任务 7：实现设置页、导入导出面板与同步配置界面

**文件：**
- 创建：`src/popup/pages/SettingsPage.tsx`
- 创建：`src/popup/components/forms/WebDavForm.tsx`
- 创建：`src/popup/components/forms/ImportExportPanel.tsx`
- 创建：`src/popup/components/dialogs/SyncConflictDialog.tsx`
- 创建：`src/services/settings-service.ts`
- 测试：`src/popup/pages/SettingsPage.test.tsx`

- [ ] **步骤 1：编写设置页失败测试**

```tsx
import { render, screen } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';

it('shows webdav and import-export sections', () => {
  render(<SettingsPage />);
  expect(screen.getByText('WebDAV 同步')).toBeInTheDocument();
  expect(screen.getByText('导入与导出')).toBeInTheDocument();
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test -- src/popup/pages/SettingsPage.test.tsx`
预期：FAIL

- [ ] **步骤 3：实现 WebDAV 配置表单与状态展示**

```tsx
export function WebDavForm({ profile, onSave }: WebDavFormProps) {
  return (
    <form onSubmit={handleSubmit}>
      <input name="url" defaultValue={profile?.url ?? ''} />
      <input name="username" defaultValue={profile?.username ?? ''} />
      <input name="credential" type="password" />
    </form>
  );
}
```

- [ ] **步骤 4：实现导入导出面板与冲突对话框**

```tsx
export function ImportExportPanel({ onExportEncrypted, onExportPlain, onImport }: ImportExportPanelProps) {
  return (
    <section>
      <button onClick={onExportEncrypted}>导出加密配置</button>
      <button onClick={onExportPlain}>导出明文配置</button>
      <button onClick={onImport}>导入配置</button>
    </section>
  );
}
```

- [ ] **步骤 5：运行测试验证通过**

运行：`npm run test -- src/popup/pages/SettingsPage.test.tsx`
预期：PASS

- [ ] **步骤 6：Commit**

```bash
git add src/popup/pages/SettingsPage.tsx src/popup/components/forms/WebDavForm.tsx src/popup/components/forms/ImportExportPanel.tsx src/popup/components/dialogs/SyncConflictDialog.tsx src/services/settings-service.ts src/popup/pages/SettingsPage.test.tsx
git commit -m "feat(设置): 添加同步配置与导入导出界面"
```

## 任务 8：集成应用状态、联调主流程并完成验证

**文件：**
- 创建：`src/state/app-store.ts`
- 修改：`src/popup/App.tsx`
- 修改：`src/popup/bootstrap.ts`
- 修改：`src/popup/routes.tsx`
- 修改：`src/popup/pages/*.tsx`
- 测试：`vitest.setup.ts`

- [ ] **步骤 1：编写流程级失败测试**

```tsx
import { render, screen } from '@testing-library/react';
import { App } from './App';

it('routes to unlock page before session is available', () => {
  render(<App />);
  expect(screen.getByText(/解锁|创建主密码/)).toBeInTheDocument();
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test`
预期：FAIL，至少存在应用状态或页面集成相关失败

- [ ] **步骤 3：实现应用状态编排与页面跳转**

```ts
export interface AppStoreState {
  sessionMode: 'setup' | 'locked' | 'unlocked';
  selectedAccountId: string | null;
  route: 'unlock' | 'list' | 'add' | 'detail' | 'settings';
}
```

```tsx
export function App() {
  const state = useAppStore();
  return <AppRoutes state={state} />;
}
```

- [ ] **步骤 4：完成端到端联调验证**

运行：`npm run test && npm run build`
预期：PASS，全部单元测试通过且插件构建成功

- [ ] **步骤 5：手动烟雾验证**

运行：

```bash
npm install
npm run build
```

在 Chrome / Edge 中加载 `dist/` 目录，逐项手动确认：

- 首次进入创建主密码
- 再次进入解锁
- 手动添加账号
- 粘贴 `otpauth://` 导入
- 二维码图片导入
- 复制验证码
- 进入详情编辑
- 删除确认
- 配置 WebDAV
- 打开插件触发同步
- 无网时使用本地缓存

预期：全部通过

- [ ] **步骤 6：Commit**

```bash
git add src/state/app-store.ts src/popup/App.tsx src/popup/bootstrap.ts src/popup/routes.tsx src/popup/pages src/popup/components vitest.setup.ts
git commit -m "feat(集成): 打通插件主流程"
```

## 自检

### 规格覆盖度

- 主密码与加密存储：任务 3
- TOTP 生成与倒计时：任务 2、任务 5
- 品牌图标与匹配：任务 2
- 手动 / `otpauth://` / 二维码导入：任务 6
- 搜索、置顶、分组、列表卡片：任务 5、任务 6
- 删除 / 编辑 / 移动分组：任务 6
- WebDAV 打开即拉取、定时同步、手动同步、冲突处理：任务 4、任务 7
- 导入导出：任务 3、任务 7
- 顶部扁平图标与右下角悬浮添加按钮：任务 5

### 占位符扫描

- 已避免使用模糊占位描述。
- 每个任务均给出明确文件路径、验证命令与提交建议。

### 类型一致性

- 核心实体统一使用 `AccountRecord`、`VaultPayload`、`WebDavProfile`、`SessionState`。
- 同步决策统一使用 `SyncDecision`。
- 页面路由统一使用 `unlock`、`list`、`add`、`detail`、`settings`。
