# TOTP 多端工程

这是一个面向多个客户端形态的 TOTP 产品仓库，当前目标客户端包括浏览器插件端与 HarmonyOS NEXT 端，后续预留 Android 与独立 Web 端扩展空间。

## Workspace 结构

- `apps/browser-extension`：Chrome / Edge 浏览器插件端
- `apps/harmony-app`：HarmonyOS NEXT 客户端
- `packages/totp-core`：共享 TOTP 核心、加解密与导入导出逻辑
- `packages/totp-sync`：共享 WebDAV 同步与冲突处理逻辑
- `packages/totp-test-fixtures`：跨端测试夹具与演示数据

## 常用命令

- `npm install`
- `npm run test:workspace-smoke`
- `npm run test:browser`
- `npm run build:browser`
- `npm test`
- `npm run build`
