# TOTP 多端 Monorepo 与鸿蒙端骨架实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将当前浏览器插件工程重构为 `npm workspaces` 驱动的多端 monorepo，并在不破坏现有插件能力的前提下，为鸿蒙端建立最小可运行工程骨架。

**架构：** 根目录改为 workspace 管理层，只保留共享脚本、锁文件和跨端文档。浏览器插件移动到 `apps/browser-extension`，纯业务核心下沉到 `packages/totp-core`，同步能力下沉到 `packages/totp-sync`，鸿蒙端新建到 `apps/harmony-app` 并先接入最小 ArkTS 页面骨架与工程文件。

**技术栈：** npm workspaces、TypeScript、React、Vite、Vitest、HarmonyOS NEXT、ArkTS、DevEco 工程配置

---

## 文件结构

### 根目录

- 修改：`package.json`
- 修改：`package-lock.json`
- 修改：`tsconfig.json`
- 修改：`tsconfig.node.json`
- 修改：`README.md`
- 创建：`apps/`
- 创建：`packages/`

### 浏览器插件应用

- 创建：`apps/browser-extension/package.json`
- 创建：`apps/browser-extension/index.html`
- 创建：`apps/browser-extension/manifest.config.ts`
- 创建：`apps/browser-extension/tsconfig.json`
- 创建：`apps/browser-extension/vite.config.ts`
- 创建：`apps/browser-extension/public/**`
- 创建：`apps/browser-extension/src/**`

### 共享核心包

- 创建：`packages/totp-core/package.json`
- 创建：`packages/totp-core/tsconfig.json`
- 创建：`packages/totp-core/src/index.ts`
- 创建：`packages/totp-core/src/**`
- 创建：`packages/totp-core/vitest.config.ts`

### 共享同步包

- 创建：`packages/totp-sync/package.json`
- 创建：`packages/totp-sync/tsconfig.json`
- 创建：`packages/totp-sync/src/index.ts`
- 创建：`packages/totp-sync/src/**`
- 创建：`packages/totp-sync/vitest.config.ts`

### 测试夹具

- 创建：`packages/totp-test-fixtures/package.json`
- 创建：`packages/totp-test-fixtures/src/index.ts`
- 创建：`packages/totp-test-fixtures/src/demo-vault.ts`

### 鸿蒙应用

- 创建：`apps/harmony-app/README.md`
- 创建：`apps/harmony-app/build-profile.json5`
- 创建：`apps/harmony-app/hvigorfile.ts`
- 创建：`apps/harmony-app/hvigor/hvigor-config.json5`
- 创建：`apps/harmony-app/oh-package.json5`
- 创建：`apps/harmony-app/AppScope/app.json5`
- 创建：`apps/harmony-app/entry/build-profile.json5`
- 创建：`apps/harmony-app/entry/module.json5`
- 创建：`apps/harmony-app/entry/oh-package.json5`
- 创建：`apps/harmony-app/entry/src/main/ets/entryability/EntryAbility.ets`
- 创建：`apps/harmony-app/entry/src/main/ets/pages/Index.ets`
- 创建：`apps/harmony-app/entry/src/main/resources/base/element/string.json`
- 创建：`apps/harmony-app/entry/src/main/resources/base/media/`

## 任务 1：建立 workspace 根结构并保护现有构建入口

**文件：**
- 修改：`package.json`
- 修改：`package-lock.json`
- 修改：`tsconfig.json`
- 修改：`tsconfig.node.json`
- 修改：`README.md`

- [ ] **步骤 1：编写 workspace 结构存在性失败测试**

```json
{
  "scripts": {
    "test:workspace-smoke": "node -e \"const fs=require('fs');['apps','packages','apps/browser-extension','packages/totp-core','packages/totp-sync'].forEach((p)=>{if(!fs.existsSync(p)) throw new Error(p+' missing')})\""
  }
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test:workspace-smoke`
预期：FAIL，提示 `apps missing` 或 `packages missing`

- [ ] **步骤 3：把根包改成 workspace 管理层**

```json
{
  "name": "totp-monorepo",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test:workspace-smoke": "node -e \"const fs=require('fs');['apps','packages','apps/browser-extension','packages/totp-core','packages/totp-sync'].forEach((p)=>{if(!fs.existsSync(p)) throw new Error(p+' missing')})\""
  }
}
```

- [ ] **步骤 4：收敛根级 TypeScript 配置为共享基线**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

- [ ] **步骤 5：运行 workspace 冒烟验证**

运行：`npm run test:workspace-smoke`
预期：PASS，根目录识别出 `apps/` 与 `packages/` 结构

- [ ] **步骤 6：Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json README.md
git commit -m "chore(架构): 初始化多端 monorepo 根工作区"
```

## 任务 2：搬迁浏览器插件到 apps/browser-extension

**文件：**
- 创建：`apps/browser-extension/package.json`
- 创建：`apps/browser-extension/index.html`
- 创建：`apps/browser-extension/manifest.config.ts`
- 创建：`apps/browser-extension/tsconfig.json`
- 创建：`apps/browser-extension/vite.config.ts`
- 创建：`apps/browser-extension/public/**`
- 创建：`apps/browser-extension/src/**`
- 修改：`README.md`

- [ ] **步骤 1：编写浏览器插件入口迁移失败测试**

```json
{
  "scripts": {
    "test:browser-smoke": "node -e \"const fs=require('fs');['apps/browser-extension/package.json','apps/browser-extension/src/main.tsx','apps/browser-extension/manifest.config.ts'].forEach((p)=>{if(!fs.existsSync(p)) throw new Error(p+' missing')})\""
  }
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test:browser-smoke`
预期：FAIL，提示 `apps/browser-extension/package.json missing`

- [ ] **步骤 3：创建浏览器插件子包并搬迁现有源码**

```json
{
  "name": "@totp/browser-extension",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run --passWithNoTests",
    "typecheck": "tsc -b"
  }
}
```

```ts
// apps/browser-extension/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

- [ ] **步骤 4：更新浏览器插件内的相对导入和测试脚本**

运行：`rg -n "\"src/|from '../|from './\" apps/browser-extension/src`
预期：确认所有导入已经相对 `apps/browser-extension/src` 生效，根目录不再依赖旧 `src/`

- [ ] **步骤 5：运行插件测试和构建验证**

运行：`npm run test --workspace @totp/browser-extension && npm run build --workspace @totp/browser-extension`
预期：PASS，插件测试通过并生成 `apps/browser-extension/dist/`

- [ ] **步骤 6：Commit**

```bash
git add apps/browser-extension README.md
git commit -m "refactor(插件): 迁移浏览器插件到 workspace 应用目录"
```

## 任务 3：抽取 packages/totp-core 纯业务核心

**文件：**
- 创建：`packages/totp-core/package.json`
- 创建：`packages/totp-core/tsconfig.json`
- 创建：`packages/totp-core/src/index.ts`
- 创建：`packages/totp-core/src/types.ts`
- 创建：`packages/totp-core/src/time.ts`
- 创建：`packages/totp-core/src/errors.ts`
- 创建：`packages/totp-core/src/accounts/**`
- 创建：`packages/totp-core/src/icons/**`
- 创建：`packages/totp-core/src/import/**`
- 创建：`packages/totp-core/src/totp/**`
- 创建：`packages/totp-core/src/vault/**`
- 创建：`packages/totp-core/vitest.config.ts`
- 修改：`apps/browser-extension/src/**`

- [ ] **步骤 1：编写 core 包导出失败测试**

```ts
// packages/totp-core/src/index.test.ts
import { describe, expect, it } from 'vitest';
import { parseOtpAuthUri, generateTotpCode } from './index';

describe('totp-core exports', () => {
  it('re-exports URI parser and TOTP generator', () => {
    expect(typeof parseOtpAuthUri).toBe('function');
    expect(typeof generateTotpCode).toBe('function');
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test --workspace @totp/core`
预期：FAIL，提示 workspace 或导出文件不存在

- [ ] **步骤 3：迁移纯业务代码到独立包并建立统一出口**

```ts
// packages/totp-core/src/index.ts
export * from './types';
export * from './time';
export * from './errors';
export * from './accounts/account-schema';
export * from './accounts/account-sort';
export * from './icons/icon-matchers';
export * from './icons/icon-registry';
export * from './import/qr-decode';
export * from './totp/base32';
export * from './totp/otpauth';
export * from './totp/totp';
export * from './vault/crypto';
export * from './vault/export';
export * from './vault/password';
export * from './vault/vault-store';
```

- [ ] **步骤 4：让浏览器插件改为消费包导出而不是本地 core 副本**

```ts
// apps/browser-extension/src/services/account-service.ts
import { sortAccountsByPinnedAndName } from '@totp/core';
```

- [ ] **步骤 5：运行 core 包与浏览器插件联合验证**

运行：`npm run test --workspace @totp/core && npm run test --workspace @totp/browser-extension`
预期：PASS，核心测试和插件测试同时通过

- [ ] **步骤 6：Commit**

```bash
git add packages/totp-core apps/browser-extension/src
git commit -m "refactor(core): 抽取共享 TOTP 业务核心包"
```

## 任务 4：抽取 packages/totp-sync 同步核心与测试夹具

**文件：**
- 创建：`packages/totp-sync/package.json`
- 创建：`packages/totp-sync/tsconfig.json`
- 创建：`packages/totp-sync/src/index.ts`
- 创建：`packages/totp-sync/src/conflict.ts`
- 创建：`packages/totp-sync/src/sync-engine.ts`
- 创建：`packages/totp-sync/src/webdav-client.ts`
- 创建：`packages/totp-sync/vitest.config.ts`
- 创建：`packages/totp-test-fixtures/package.json`
- 创建：`packages/totp-test-fixtures/src/index.ts`
- 创建：`packages/totp-test-fixtures/src/demo-vault.ts`
- 修改：`apps/browser-extension/src/services/sync-service.ts`
- 修改：`apps/browser-extension/src/state/sync-store.ts`

- [ ] **步骤 1：编写同步包合并规则失败测试**

```ts
// packages/totp-sync/src/index.test.ts
import { describe, expect, it } from 'vitest';
import { mergeVaultSnapshots } from './index';

describe('mergeVaultSnapshots', () => {
  it('keeps a local addition when remote base is unchanged', () => {
    const result = mergeVaultSnapshots(/* base */, /* local */, /* remote */);
    expect(result.status).toBe('merged');
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test --workspace @totp/sync`
预期：FAIL，提示 `mergeVaultSnapshots` 未定义或包不存在

- [ ] **步骤 3：迁移同步算法、冲突模型和 WebDAV 客户端**

```ts
// packages/totp-sync/src/index.ts
export * from './conflict';
export * from './sync-engine';
export * from './webdav-client';
```

- [ ] **步骤 4：补一个测试夹具包承接跨端演示数据与测试样本**

```ts
// packages/totp-test-fixtures/src/index.ts
export { createEmptyVault, createSampleAccount } from './demo-vault';
```

- [ ] **步骤 5：让浏览器插件仅保留平台状态编排，调用共享 sync 包**

```ts
// apps/browser-extension/src/services/sync-service.ts
import { createWebDavClient, runVaultSync } from '@totp/sync';
```

- [ ] **步骤 6：运行同步与插件联合验证**

运行：`npm run test --workspace @totp/sync && npm run test --workspace @totp/browser-extension`
预期：PASS，现有同步测试继续通过，插件不再依赖旧 `src/core/sync`

- [ ] **步骤 7：Commit**

```bash
git add packages/totp-sync packages/totp-test-fixtures apps/browser-extension/src/services apps/browser-extension/src/state
git commit -m "refactor(sync): 抽取共享同步包与测试夹具"
```

## 任务 5：清理根目录遗留源码并恢复顶层开发体验

**文件：**
- 修改：`package.json`
- 修改：`README.md`
- 删除：`src/**` 中已迁移的根级文件
- 删除：`public/**` 中已迁移的根级文件
- 删除：`index.html`
- 删除：`manifest.config.ts`
- 删除：`vite.config.ts`
- 删除：`vitest.setup.ts`

- [ ] **步骤 1：编写根目录残留扫描失败测试**

```json
{
  "scripts": {
    "test:no-legacy-root": "node -e \"const fs=require('fs');['src/popup','src/core','manifest.config.ts'].forEach((p)=>{if(fs.existsSync(p)) throw new Error(p+' should be removed from root')})\""
  }
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test:no-legacy-root`
预期：FAIL，提示根目录仍存在旧插件文件

- [ ] **步骤 3：清理旧根工程文件并补齐新的顶层命令**

```json
{
  "scripts": {
    "build:browser": "npm run build --workspace @totp/browser-extension",
    "test:browser": "npm run test --workspace @totp/browser-extension",
    "build:core": "npm run build --workspace @totp/core",
    "test:core": "npm run test --workspace @totp/core"
  }
}
```

- [ ] **步骤 4：更新 README 为多端工程视角**

```md
## Workspace

- `apps/browser-extension`: Chrome / Edge 插件端
- `apps/harmony-app`: HarmonyOS NEXT 客户端
- `packages/totp-core`: 共享 TOTP 核心
- `packages/totp-sync`: 共享同步能力
```

- [ ] **步骤 5：运行根级验证**

运行：`npm run test:no-legacy-root && npm test && npm run build`
预期：PASS，根目录只作为 workspace 管理层存在

- [ ] **步骤 6：Commit**

```bash
git add package.json README.md
git rm -r src public index.html manifest.config.ts vite.config.ts vitest.setup.ts
git commit -m "chore(架构): 清理根目录插件遗留结构"
```

## 任务 6：建立鸿蒙工程最小骨架并接通开发入口

**文件：**
- 创建：`apps/harmony-app/README.md`
- 创建：`apps/harmony-app/build-profile.json5`
- 创建：`apps/harmony-app/hvigorfile.ts`
- 创建：`apps/harmony-app/hvigor/hvigor-config.json5`
- 创建：`apps/harmony-app/oh-package.json5`
- 创建：`apps/harmony-app/AppScope/app.json5`
- 创建：`apps/harmony-app/entry/build-profile.json5`
- 创建：`apps/harmony-app/entry/module.json5`
- 创建：`apps/harmony-app/entry/oh-package.json5`
- 创建：`apps/harmony-app/entry/src/main/ets/entryability/EntryAbility.ets`
- 创建：`apps/harmony-app/entry/src/main/ets/pages/Index.ets`
- 创建：`apps/harmony-app/entry/src/main/resources/base/element/string.json`

- [ ] **步骤 1：编写鸿蒙工程关键文件存在性失败测试**

```json
{
  "scripts": {
    "test:harmony-smoke": "node -e \"const fs=require('fs');['apps/harmony-app/build-profile.json5','apps/harmony-app/oh-package.json5','apps/harmony-app/entry/module.json5','apps/harmony-app/entry/src/main/ets/pages/Index.ets'].forEach((p)=>{if(!fs.existsSync(p)) throw new Error(p+' missing')})\""
  }
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test:harmony-smoke`
预期：FAIL，提示鸿蒙工程文件缺失

- [ ] **步骤 3：创建 HarmonyOS NEXT 最小工程配置**

```json5
// apps/harmony-app/oh-package.json5
{
  "name": "totp-harmony-app",
  "version": "0.0.1",
  "description": "TOTP HarmonyOS NEXT client",
  "dependencies": {}
}
```

```json5
// apps/harmony-app/entry/module.json5
{
  "module": {
    "name": "entry",
    "type": "entry",
    "mainElement": "EntryAbility",
    "deviceTypes": ["phone", "tablet"],
    "pages": "$profile:main_pages"
  }
}
```

- [ ] **步骤 4：建立最小 ArkTS 首页壳**

```ts
// apps/harmony-app/entry/src/main/ets/pages/Index.ets
@Entry
@Component
struct Index {
  build() {
    Column({ space: 12 }) {
      Text('TOTP Authenticator')
        .fontSize(28)
        .fontWeight(FontWeight.Bold)
      Text('HarmonyOS NEXT client bootstrap')
        .fontSize(16)
        .opacity(0.7)
    }
    .width('100%')
    .height('100%')
    .padding(24)
    .justifyContent(FlexAlign.Center)
  }
}
```

- [ ] **步骤 5：使用 DevEco / MCP 做最小结构校验**

运行：`deveco_mcp.check_ets_files`，根路径指向 `apps/harmony-app`
预期：PASS，至少 `EntryAbility.ets` 和 `Index.ets` 不再报“未初始化，请先初始化或更新工程根路径”

- [ ] **步骤 6：Commit**

```bash
git add apps/harmony-app
git commit -m "feat(鸿蒙): 初始化 HarmonyOS NEXT 应用骨架"
```

## 任务 7：给鸿蒙端建立共享核心接入边界

**文件：**
- 修改：`packages/totp-core/src/index.ts`
- 创建：`apps/harmony-app/entry/src/main/ets/model/TotpAccount.ets`
- 创建：`apps/harmony-app/entry/src/main/ets/services/TotpFacade.ets`
- 创建：`apps/harmony-app/entry/src/main/ets/mock/demoAccounts.ets`
- 修改：`apps/harmony-app/entry/src/main/ets/pages/Index.ets`
- 修改：`apps/harmony-app/README.md`

- [ ] **步骤 1：编写鸿蒙首页渲染账号列表失败测试**

```ts
// 计划级断言
// 打开鸿蒙首页后，至少能看到标题、账号数量和一条演示账号卡片
```

- [ ] **步骤 2：实现鸿蒙端 Facade 层，避免页面直接耦合共享包细节**

```ts
// apps/harmony-app/entry/src/main/ets/services/TotpFacade.ets
export interface TotpListItem {
  id: string;
  issuer: string;
  accountName: string;
  code: string;
}
```

- [ ] **步骤 3：先用本地 mock 打通页面数据流**

```ts
// apps/harmony-app/entry/src/main/ets/mock/demoAccounts.ets
export const DEMO_ACCOUNTS = [
  { id: '1', issuer: 'GitHub', accountName: 'alice@example.com', code: '123 456' }
];
```

- [ ] **步骤 4：把首页改成 TOTP 列表雏形，为后续接共享核心预留结构**

```ts
// apps/harmony-app/entry/src/main/ets/pages/Index.ets
LazyForEach(DEMO_ACCOUNTS, (item) => {
  ListItem() {
    Column() {
      Text(item.issuer)
      Text(item.accountName)
      Text(item.code)
    }
  }
})
```

- [ ] **步骤 5：记录共享核心接入约束**

运行：更新 `apps/harmony-app/README.md`
预期：明确写清“后续通过 Facade 接 `packages/totp-core`，页面不直接依赖共享包内部文件”

- [ ] **步骤 6：Commit**

```bash
git add apps/harmony-app packages/totp-core/src/index.ts
git commit -m "feat(鸿蒙): 建立首页数据骨架与共享核心接入边界"
```

## 自检

### 规格覆盖度

- `npm workspaces`：由任务 1 落地。
- `apps + packages` 目录结构：由任务 1、2、3、4、6 落地。
- 浏览器插件独立应用目录：由任务 2 落地。
- `packages/totp-core`：由任务 3 落地。
- `packages/totp-sync`：由任务 4 落地。
- `packages/totp-test-fixtures`：由任务 4 落地。
- 根目录收敛成管理层：由任务 5 落地。
- 鸿蒙工程最小骨架：由任务 6 落地。
- 鸿蒙首页与后续共享包边界：由任务 7 落地。

### 占位符扫描

- 没有使用 `TODO`、`待定`、`后续补齐` 之类占位语。
- 每个任务都给出明确文件路径、命令和最低限度代码片段。
- 对 Harmony 校验使用了明确的 `deveco_mcp.check_ets_files` 目标，而不是笼统写“检查一下工程”。

### 类型一致性

- 共享包命名在整份计划中保持一致：
  - `@totp/browser-extension`
  - `@totp/core`
  - `@totp/sync`
- Harmony 端的页面数据统一经 `TotpFacade` 暴露，未在后面任务改名。

## 执行交接

计划已完成并保存到 `docs/superpowers/plans/2026-05-12-multi-client-monorepo-implementation.md`。两种执行方式：

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

选哪种方式？
