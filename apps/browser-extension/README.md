# TOTP 浏览器插件

`apps/browser-extension` 是 TOTP 多端工程中的 Chrome / Edge 浏览器插件客户端。它使用 React + Vite 构建弹窗 UI，通过 `@totp/core` 和 `@totp/sync` 复用跨端 TOTP、加密保管库、导入导出、品牌图标和 WebDAV 同步逻辑。

浏览器端定位是轻量、快速、贴近桌面浏览器使用场景：在扩展弹窗中完成验证码查看、复制、账号管理、导入导出和 WebDAV 同步。

## 技术栈

- React 19
- Vite 7
- TypeScript
- Vitest
- Chrome Extension Manifest V3
- WebAuthn / Windows Hello
- Chrome Storage
- `jsqr` 图片二维码解析

## 当前能力

### 账号与验证码

- 首页展示账号列表、品牌图标、验证码、倒计时和复制入口。
- 支持添加、编辑、删除账号。
- 支持 `otpauth://` 链接解析、图片二维码识别和手动填写。
- 支持 SHA1、SHA256、SHA512，支持 6 位 / 8 位验证码和自定义周期。
- 品牌图标和匹配规则来自 `packages/totp-core`。

### 本地保管库与解锁

- 首次使用需要创建主密码。
- 本地数据使用 v2 key envelope 加密。
- 支持 WebAuthn / Windows Hello 快速解锁。
- 解锁态只保留在当前浏览器运行上下文中，关闭或刷新后按当前状态重新进入解锁流程。

### WebDAV 同步

- 设置页支持 WebDAV 服务器、路径、用户名和密码配置。
- 开启同步时先检查远端：远端存在则下载、解密、合并；远端不存在才初始化上传本地。
- 远端 vault key 是权威源。接入已有远端、自动合并或验证远端密码成功后，本地采用远端 `vaultKey`。
- 远端主密码被其他端修改后，插件会进入 `BlockedRemotePassword` 状态，并主动提示用户验证远端主密码。
- 验证远端主密码成功后，会先解锁远端，再按正常同步逻辑处理本地空、远端空、账号级合并和冲突。
- 关闭 WebDAV 后，首页和设置页状态回到本地模式，不再显示旧同步成功状态。

### 导入导出

- 支持加密备份导入 / 导出。
- 导出使用当前 v2 encrypted vault 结构，和 Android、HarmonyOS 端兼容。
- 旧 v1 加密导出需要先使用迁移脚本转换为 v2 备份后再导入。
- 导入成功后会写入本地保管库；如果 WebDAV 已启用，会继续按当前同步规则处理远端。

## v2 加密格式

浏览器端和其他两端统一使用：

- PBKDF2 SHA-256
- 310000 次迭代
- AES-GCM
- 随机 256-bit `vaultKey`
- 16 字节 salt
- 12 字节 IV
- 128 bit tag

主密码修改时只重新生成 `wrappingKey` 并重包 `vaultKey`，账号数据密钥不变。WebDAV 开启时，修改主密码会先确认远端可解锁 / 可同步，再上传新的远端 envelope。

## 目录结构

```text
apps/browser-extension
├── public/                  # Manifest 和静态资源
├── src/
│   ├── popup/               # React 弹窗页面、表单和组件
│   ├── services/            # 设置、同步、备份和浏览器平台适配
│   ├── state/               # App 状态和本地存储编排
│   └── main.tsx             # 弹窗入口
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 构建与调试

在仓库根目录执行：

```powershell
npm run typecheck:browser
npm run test:browser
npm run build:browser
```

也可以进入子工程执行：

```powershell
cd apps/browser-extension
npm run typecheck
npm test
npm run build
```

构建产物位于：

```text
apps/browser-extension/dist
```

在 Chrome / Edge 中调试：

1. 打开扩展管理页面。
2. 启用开发者模式。
3. 选择「加载已解压的扩展」。
4. 选择 `apps/browser-extension/dist`。

## 与其他端的一致性

- 数据格式、备份格式和 WebDAV payload 与 Android、HarmonyOS 端保持一致。
- 账号级合并和冲突处理使用 `@totp/sync`。
- TOTP、导入导出、加密和品牌图标使用 `@totp/core`。
- UI 不直接照搬移动端，优先服务浏览器弹窗的窄宽度和高频复制场景。

## 验证建议

提交涉及浏览器端的改动前，至少执行：

```powershell
npm run typecheck:browser
npm run test:browser
npm run build:browser
```
