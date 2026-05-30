# Harmony 首页同步 UI 与 Coordinator 瘦身实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 Harmony `Index.ets` 中的同步展示组件和 WebDAV 同步状态协调逻辑抽离，让页面保留组合子页面、事件转发和状态应用职责。

**架构：** `policies/` 保持纯逻辑；新增 `components/home/` 同步相关展示组件；新增 `services/WebDavSyncCoordinator.ets` 封装同步动作调用、结果 presentation 和错误归一化。`Index.ets` 仍持有 ArkUI `@State`、TOTP ticker 和同步动画，避免 Coordinator 依赖 UI 生命周期。

**技术栈：** HarmonyOS ArkTS、ArkUI struct 组件、Hypium ohosTest、hvigor HAP 构建。

---

## 文件职责

- 修改：`apps/harmony-app/entry/src/main/ets/pages/Index.ets`
  - 保留页面状态、路由、子页面组合、`applyVault`、`applySyncOutcome`、动画启动/停止。
  - 移除同步结果 service 调用细节和同步相关 builder 细节。
- 创建：`apps/harmony-app/entry/src/main/ets/components/home/HomeStatusCard.ets`
  - 展示首页同步/复制/错误状态和冲突操作区。
- 创建：`apps/harmony-app/entry/src/main/ets/components/home/RemotePasswordDialog.ets`
  - 展示远端密码输入弹窗。
- 创建：`apps/harmony-app/entry/src/main/ets/services/WebDavSyncCoordinator.ets`
  - 提供 `manualSync`、`syncLocalChange`、`verifyRemotePassword`、`resolveConflict`，返回统一 outcome。
- 创建：`apps/harmony-app/entry/src/ohosTest/ets/test/WebDavSyncCoordinator.test.ets`
  - 测试 coordinator 对不同动作的 service 调用、presentation 类型和错误归一化。
- 修改：`apps/harmony-app/entry/src/ohosTest/ets/test/List.test.ets`
  - 注册 coordinator 测试。

## 任务 1：抽出同步相关展示组件

- [ ] **步骤 1：创建 `HomeStatusCard.ets`**
  - Props：`message`、`tone`、`hasSyncConflict`、`isDarkMode`。
  - Callbacks：`onKeepLocal`、`onUseRemote`。
  - 保留原状态卡和冲突面板视觉结构。

- [ ] **步骤 2：创建 `RemotePasswordDialog.ets`**
  - Props：`password`、`errorMessage`、`isBusy`。
  - Callbacks：`onPasswordChange`、`onVerify`、`onCancel`。
  - 保留原弹窗文案和样式。

- [ ] **步骤 3：替换 `Index.ets` builder**
  - `buildStatusCard` 改成调用 `HomeStatusCard`。
  - `buildRemotePasswordDialog` 改成调用 `RemotePasswordDialog`。
  - 删除 `buildSyncConflictActions`。

- [ ] **步骤 4：运行测试目标构建**
  - 命令：`& 'C:\Program Files\Huawei\DevEco Studio\tools\hvigor\bin\hvigorw.bat' --mode module -p module=entry@ohosTest -p product=default -p buildMode=debug assembleHap`
  - 预期：BUILD SUCCESSFUL。

## 任务 2：抽出 WebDavSyncCoordinator

- [ ] **步骤 1：编写失败测试 `WebDavSyncCoordinator.test.ets`**
  - 构造 fake runner，不依赖真实 WebDAV。
  - 验证 `manualSync` 使用 standard presentation。
  - 验证 `syncLocalChange` 使用本地变更错误前缀。
  - 验证 `verifyRemotePassword` 对空密码返回 validation error。
  - 验证 `resolveConflict(true/false)` 分别调用 keepLocal/useRemote。

- [ ] **步骤 2：运行测试目标构建确认红灯**
  - 预期：缺少 `WebDavSyncCoordinator` 模块。

- [ ] **步骤 3：实现 `WebDavSyncCoordinator.ets`**
  - 定义 `WebDavSyncActionOutcome`，包含 `result`、`presentation`、`errorMessage`、`remotePasswordErrorMessage`、`remotePasswordVerified`。
  - 定义 runner 接口和默认 runner，以便测试注入 fake runner。
  - Coordinator 不读写 ArkUI 状态，不启动/停止动画。

- [ ] **步骤 4：替换 `Index.ets` 同步方法**
  - `handleManualSync`、`handleLocalChangeSync`、`verifyRemotePassword`、`resolveSyncConflict` 调用 coordinator。
  - `Index` 负责 `isSyncing`、动画、`applyVault`、`applySyncResultPresentation`、`refreshLastSyncLabel`。
  - `syncOnOpenOnce` 仍保留在 `Index`，因为它依赖页面级 `hasSyncedOnOpen` 和 `canSync`。

- [ ] **步骤 5：运行测试目标构建**
  - 预期：BUILD SUCCESSFUL。

## 任务 3：最终验证与质量检查

- [ ] **步骤 1：运行正式 HAP 构建**
  - 命令：`& 'C:\Program Files\Huawei\DevEco Studio\tools\node\node.exe' 'C:\Program Files\Huawei\DevEco Studio\tools\hvigor\bin\hvigorw.js' --mode module -p module=entry@default -p product=default -p requiredDeviceType=phone assembleHap --analyze=normal --parallel --incremental`
  - 预期：BUILD SUCCESSFUL。

- [ ] **步骤 2：检查源码引用边界**
  - `Index.ets` 不直接调用 `WebDavSyncService`。
  - 同步展示 UI 位于 `components/home/`。
  - 纯策略位于 `policies/`。

- [ ] **步骤 3：汇总遗留风险**
  - `syncSpinAngle` 暂留 UI 层。
  - `isSyncing`/`hasSyncConflict` 暂留 `Index` 的 `@State`，由 coordinator outcome 驱动。
