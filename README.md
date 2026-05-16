# TOTP 多端身份验证器

这是一个本地优先的 TOTP 身份验证器工程，当前支持 HarmonyOS NEXT 应用和 Chrome / Edge 浏览器插件。工程采用 monorepo 组织方式，把 TOTP、加密保管库、WebDAV 同步、导入导出、品牌图标匹配等通用能力沉到共享包中，双端只保留各自平台相关的 UI、存储和系统能力适配。

## 当前能力

- **TOTP 验证码：** 支持 `otpauth://` 解析、6 位 / 8 位验证码、SHA1 / SHA256 / SHA512、周期倒计时和验证码复制。
- **账号管理：** 支持添加、编辑、删除、分组、二维码扫描 / 图片识别入口和手动录入。
- **本地保管库：** 使用主密码加密保存账号数据，支持加密导入导出。
- **跨端同步：** 支持 WebDAV 同步、远端初始化、账号级合并和冲突处理。
- **解锁体验：** HarmonyOS 端支持生物识别；浏览器插件端支持 WebAuthn / Windows Hello 解锁。
- **品牌图标：** 品牌匹配规则和图标资源集中维护，浏览器直接读取共享包，HarmonyOS 通过脚本同步资源与匹配代码。
- **暗色模式：** 双端界面按当前设计适配浅色 / 深色模式。

## 工程结构

```text
.
├── apps/
│   ├── browser-extension/            # Chrome / Edge 浏览器插件
│   └── harmony-app/                  # HarmonyOS NEXT 应用
├── packages/
│   ├── totp-core/                    # TOTP、账号模型、加密、导入导出、品牌图标
│   ├── totp-sync/                    # WebDAV、同步引擎、冲突处理、同步状态
│   └── totp-test-fixtures/           # 跨端测试夹具
├── scripts/
│   ├── generate-core-icon-registry.mjs
│   ├── generate-harmony-brand-matcher.mjs
│   └── sync-harmony-brand-assets.mjs
├── docs/                             # 规格、计划和过程文档
├── package.json                      # npm workspace 入口
└── tsconfig.json                     # TypeScript workspace 路径配置
```

## 共享包边界

### `@totp/core`

`packages/totp-core` 是跨端核心逻辑来源，浏览器插件直接通过 `@totp/core` 引用。

包含：

- 账号模型、账号排序、账号校验。
- Base32、TOTP 计算、`otpauth://` 解析。
- 主密码校验、保管库加密、加密 / 明文备份导入导出。
- 二维码识别辅助逻辑。
- 品牌图标匹配规则、图标注册表和公共图标资源。

### `@totp/sync`

`packages/totp-sync` 负责和同步有关的共享逻辑。

包含：

- WebDAV 客户端。
- 本地、远端、同步基线的三方同步判断。
- 账号级合并和冲突处理。
- 同步状态存储结构。

### 浏览器插件和共享包的关系

浏览器插件内部已经移除了重复的 `src/core` 代码，当前通过 npm workspace 直接引用：

```ts
import { generateTotp, parseOtpAuthUri } from '@totp/core';
import { syncVaultWithRemote } from '@totp/sync';
```

浏览器插件内部只保留浏览器侧代码，例如 React 页面、Chrome Storage 适配、WebAuthn 解锁流程和插件弹窗状态。

### HarmonyOS 应用和共享包的关系

HarmonyOS 端使用 ArkTS / ArkUI 原生实现界面和平台能力。品牌图标资源和匹配规则由共享包生成到 HarmonyOS 工程：

- 匹配规则来源：`packages/totp-core/src/icons/icon-matchers-data.json`
- 公共资源来源：`packages/totp-core/src/icons/assets`
- 生成目标：
  - `apps/harmony-app/entry/src/main/ets/services/BrandIconMatcher.ets`
  - `apps/harmony-app/entry/src/main/ets/services/BrandIconResources.ets`
  - `apps/harmony-app/entry/src/main/resources/base/media/brand_*`

## 品牌图标维护

后续新增或调整品牌图标时，优先改共享包：

1. 把 SVG 或 PNG 放到 `packages/totp-core/src/icons/assets`。
2. 在 `packages/totp-core/src/icons/icon-matchers-data.json` 中补充匹配规则。
3. 执行同步脚本。

```powershell
npm run sync:brand-icons
```

脚本会完成 3 件事：

- 重新生成浏览器使用的 `icon-registry.ts`。
- 根据 JSON 规则重新生成 HarmonyOS 的 `BrandIconMatcher.ets`。
- 把公共图标资源同步到 HarmonyOS 的 `resources/base/media`，并生成 `BrandIconResources.ets`。

注意：

- 复杂 SVG 在 HarmonyOS 真机上可能存在渲染差异。当前 `canva`、`default`、`google`、`instagram` 会优先同步 PNG。
- 自定义发行方规则应写入 `icon-matchers-data.json`，不要手动改生成后的 ArkTS 文件，否则下次执行脚本会被覆盖。
- 未匹配品牌时会使用默认 App Icon，不会回退到 Microsoft 等其他品牌图标。

## 浏览器插件

目录：`apps/browser-extension`

技术栈：

- React 19
- Vite 7
- Vitest
- Chrome Extension Manifest V3

主要功能：

- 弹窗内展示账号列表、验证码、倒计时、复制和编辑入口。
- 支持添加账号、解析 `otpauth://`、二维码图片识别和手动填写。
- 支持设置主密码、WebAuthn / Windows Hello 解锁。
- 支持 WebDAV 设置、手动同步、冲突处理、导入导出。
- 通过 `@totp/core` 和 `@totp/sync` 复用共享逻辑。

常用命令：

```powershell
npm run typecheck:browser
npm run test:browser
npm run build:browser
```

构建产物位于：

```text
apps/browser-extension/dist
```

在 Chrome / Edge 中调试时，打开扩展管理页面，启用开发者模式，加载该目录即可。

## HarmonyOS NEXT 应用

目录：`apps/harmony-app`

技术栈：

- ArkTS
- ArkUI
- Stage 模型
- HarmonyOS 6.1.0(23)

主要功能：

- 首页账号列表、TOTP 倒计时、复制和编辑。
- 添加页支持扫码、图片识别入口、`otpauth://` 解析和手动录入。
- 设置页支持生物识别解锁、WebDAV 同步、导入导出。
- 支持前台手动同步和本地账号变更后的主动同步。
- 使用脚本同步的品牌图标资源和匹配逻辑。

子工程文档见：

```text
apps/harmony-app/README.md
```

命令行构建示例：

```powershell
& 'C:\Program Files\Huawei\DevEco Studio\tools\node\node.exe' 'C:\Program Files\Huawei\DevEco Studio\tools\hvigor\bin\hvigorw.js' --mode module -p module=entry@default -p product=default -p requiredDeviceType=phone assembleHap --analyze=normal --parallel --incremental
```

签名配置通常依赖本机 DevEco Studio、证书和 Profile 文件。迁移机器或设备时，建议在 DevEco Studio 中重新生成调试签名配置。

## 开发环境

基础要求：

- Node.js 20 或更高版本。
- npm workspace。
- DevEco Studio 和 HarmonyOS SDK 6.1.0(23)，用于 HarmonyOS 端构建和真机调试。
- Chrome 或 Edge，用于浏览器插件调试。

首次安装：

```powershell
npm install
```

工作区健康检查：

```powershell
npm run test:workspace-smoke
```

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run test:workspace-smoke` | 检查基础目录是否完整 |
| `npm run sync:brand-icons` | 同步品牌图标注册表、HarmonyOS 匹配逻辑和资源 |
| `npm run typecheck` | 执行所有 workspace 的 TypeScript 类型检查 |
| `npm test` | 执行所有 workspace 测试 |
| `npm run build` | 执行所有 workspace 构建 |
| `npm run typecheck:browser` | 只检查浏览器插件 |
| `npm run test:browser` | 只测试浏览器插件 |
| `npm run build:browser` | 只构建浏览器插件 |

共享包单独验证：

```powershell
npm run typecheck --workspace @totp/core
npm run test --workspace @totp/core
npm run typecheck --workspace @totp/sync
npm run test --workspace @totp/sync
```

## 数据与同步规则

工程采用本地优先策略：

- 未配置 WebDAV 时，数据只保存在本地加密保管库。
- 配置 WebDAV 后，本地账号变更会主动触发同步。
- 远端默认保管库路径为 `/totp/vault.json`。
- 同步比较本地保管库、远端保管库和上次同步基线。

主要场景：

| 场景 | 处理方式 |
| --- | --- |
| 本地空，远端空 | 初始化同步基线 |
| 本地空，远端有数据 | 拉取远端并恢复本地 |
| 本地有数据，远端空 | 上传本地到远端 |
| 仅本地变化 | 上传本地 |
| 仅远端变化 | 拉取远端 |
| 两端独立变化 | 自动账号级合并 |
| 同一账号字段冲突 | 进入冲突处理，由用户选择本地或远端 |

## 导入导出

当前支持：

- 加密备份导出。
- 加密备份导入。
- 旧版明文 JSON 导入兼容。

浏览器插件端和 HarmonyOS 端使用相同的数据语义，导入后会写入本地保管库，并按当前 WebDAV 配置触发同步。

## 发布前检查

建议在提交或发版前执行：

```powershell
npm run sync:brand-icons
npm run typecheck
npm test
npm run build:browser
```

HarmonyOS 端发版或真机包构建前，再使用 DevEco Studio 或 hvigor 执行 HAP 构建。

## 维护约定

- 公共业务逻辑优先放在 `packages/totp-core` 或 `packages/totp-sync`。
- 浏览器插件不要重新复制共享包里的核心实现。
- HarmonyOS 端生成文件不要手动维护；新增品牌匹配请修改共享 JSON 后执行同步脚本。
- 涉及同步、加密、导入导出和品牌匹配的变更，应优先补共享包测试。
- 涉及 UI 的变更，应分别在浏览器插件和 HarmonyOS 真机 / 模拟器上验证。

