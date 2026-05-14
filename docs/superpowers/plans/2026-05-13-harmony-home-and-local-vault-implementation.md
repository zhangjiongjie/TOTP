# Harmony 首页与本地 Vault 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 HarmonyOS NEXT 客户端落地第一版“安全解锁优先”的首页、本地 vault 持久化、底部胶囊浮岛，以及添加/编辑/删除账号主流程。

**架构：** 页面层集中在 `apps/harmony-app/entry/src/main/ets/pages`，本地数据通过 `Preferences` 持久化到单一 vault 快照，并通过 `services` 层提供读取与写入入口。解锁、首页、添加、编辑各自独立为页面状态单元，先保证本地流程闭环，再逐步接共享 `packages/totp-core` 和远端同步。

**技术栈：** HarmonyOS NEXT、ArkTS、ArkUI、Preferences、hvigor PreviewBuild、npm workspaces

---

## 文件结构

- 修改：`apps/harmony-app/entry/src/main/ets/pages/Index.ets`
  - 首页，承载安全状态区、账号列表区、底部浮岛入口
- 创建：`apps/harmony-app/entry/src/main/ets/pages/Unlock.ets`
  - 首次/日常解锁页，先用主密码 + 生物识别占位策略
- 创建：`apps/harmony-app/entry/src/main/ets/pages/AddAccount.ets`
  - 统一添加页，整合扫码/链接/手动表单
- 创建：`apps/harmony-app/entry/src/main/ets/pages/EditAccount.ets`
  - 编辑页，支持保存与删除
- 创建：`apps/harmony-app/entry/src/main/ets/components/home/BottomActionDock.ets`
  - 底部胶囊浮岛
- 创建：`apps/harmony-app/entry/src/main/ets/components/home/AccountCard.ets`
  - 首页账号卡片
- 创建：`apps/harmony-app/entry/src/main/ets/components/forms/AccountForm.ets`
  - 添加/编辑共享表单
- 创建：`apps/harmony-app/entry/src/main/ets/components/dialogs/DeleteConfirmDialog.ets`
  - 删除确认弹层
- 创建：`apps/harmony-app/entry/src/main/ets/model/TotpAccount.ets`
  - 本地账号模型
- 创建：`apps/harmony-app/entry/src/main/ets/model/LocalVault.ets`
  - 本地 vault 模型
- 创建：`apps/harmony-app/entry/src/main/ets/storage/LocalVaultStore.ets`
  - 基于 Preferences 的本地持久化
- 创建：`apps/harmony-app/entry/src/main/ets/services/TotpHomeService.ets`
  - 首页与本地 vault 读取 façade
- 创建：`apps/harmony-app/entry/src/main/ets/services/AccountEditorService.ets`
  - 添加/编辑/删除写入 façade
- 修改：`apps/harmony-app/hvigor/hvigor-config.json5`
  - 保持与 DevEco schema 对齐
- 修改：`apps/harmony-app/entry/oh-package.json5`
  - 保持模块元信息和 SemVer 合规
- 修改：`.gitignore`
  - 忽略 Harmony IDE 产物

### 任务 1：稳定首页与本地 Vault 读取基线

**文件：**
- 修改：`apps/harmony-app/entry/src/main/ets/pages/Index.ets`
- 创建：`apps/harmony-app/entry/src/main/ets/model/TotpAccount.ets`
- 创建：`apps/harmony-app/entry/src/main/ets/model/LocalVault.ets`
- 创建：`apps/harmony-app/entry/src/main/ets/storage/LocalVaultStore.ets`
- 创建：`apps/harmony-app/entry/src/main/ets/services/TotpHomeService.ets`
- 修改：`apps/harmony-app/hvigor/hvigor-config.json5`
- 修改：`apps/harmony-app/entry/oh-package.json5`

- [ ] **步骤 1：确认首页和本地数据层现状**

运行：

```powershell
Get-Content apps/harmony-app/entry/src/main/ets/pages/Index.ets
Get-Content apps/harmony-app/entry/src/main/ets/storage/LocalVaultStore.ets
```

预期：首页已改为本地列表骨架，存储层已能读写单一 vault 快照。

- [ ] **步骤 2：补齐首页展示字段与空态**

在 `Index.ets` 中确保存在以下状态字段与渲染逻辑：

```ts
@State private accounts: TotpAccount[] = [];
@State private accountCountLabel: string = '0 个账号';
@State private lastUpdatedLabel: string = '尚未写入本地保管库';
@State private statusMessage: string = '当前仅启用本地存储，后续会接入加密 vault 与 WebDAV 同步。';
@State private errorMessage: string = '';
```

并保证页面在 `aboutToAppear()` 中调用：

```ts
this.loadHome();
```

- [ ] **步骤 3：确保本地 Preferences 读写有异常处理**

`LocalVaultStore.ets` 保持如下结构：

```ts
load(context: common.UIAbilityContext): LocalVault {
  try {
    let store: preferences.Preferences = this.getStore(context);
    let payload: string = store.getSync(SNAPSHOT_KEY, '') as string;
    if (payload.length === 0) {
      return createEmptyLocalVault();
    }
    return createLocalVaultFromJson(payload);
  } catch (error) {
    let businessError: BusinessError = error as BusinessError;
    throw new Error(`load local vault failed: ${businessError.message}`);
  }
}
```

- [ ] **步骤 4：运行 Harmony 预览构建验证首页可编译**

运行：

```powershell
& "C:\Program Files\Huawei\DevEco Studio\tools\node\node.exe" "C:\Program Files\Huawei\DevEco Studio\tools\hvigor\bin\hvigorw.js" --mode module -p module=entry@default -p product=default -p pageType=page -p compileResInc=true -p previewMode=true -p buildRoot=.preview PreviewBuild --watch --analyze=normal --parallel --incremental --daemon
```

预期：`BUILD SUCCESSFUL`

- [ ] **步骤 5：Commit**

```bash
git add apps/harmony-app/entry/src/main/ets/pages/Index.ets apps/harmony-app/entry/src/main/ets/model apps/harmony-app/entry/src/main/ets/storage apps/harmony-app/entry/src/main/ets/services apps/harmony-app/hvigor/hvigor-config.json5 apps/harmony-app/entry/oh-package.json5 .gitignore
git commit -m "feat(harmony): 打通首页与本地 vault 基线"
```

### 任务 2：实现解锁页与安全状态入口

**文件：**
- 创建：`apps/harmony-app/entry/src/main/ets/pages/Unlock.ets`
- 修改：`apps/harmony-app/entry/src/main/ets/pages/Index.ets`
- 创建：`apps/harmony-app/entry/src/main/ets/services/UnlockService.ets`

- [ ] **步骤 1：定义最小解锁状态服务**

在 `UnlockService.ets` 中定义本地状态 façade：

```ts
export interface UnlockState {
  hasVault: boolean;
  biometricsEnabled: boolean;
  unlocked: boolean;
}
```

并提供：

```ts
getState(context: common.UIAbilityContext): UnlockState
unlockWithPassword(password: string): boolean
```

第一版先用本地内存态 + 本地配置占位，不在这一步接真实生物识别。

- [ ] **步骤 2：实现解锁页布局**

`Unlock.ets` 至少包含：

```ts
Text('TOTP Authenticator')
Text('使用主密码解锁，生物识别会作为快捷入口。')
TextInput({ placeholder: '输入主密码' })
Button('解锁')
Button('使用生物识别')
```

要求：
- 首屏大标题
- 安全说明文案
- 生物识别按钮存在但可先用占位逻辑

- [ ] **步骤 3：首页根据解锁状态决定显示内容**

在 `Index.ets` 顶层增加条件：

```ts
if (!this.isUnlocked) {
  this.buildLockedState();
} else {
  this.buildAccountSection();
}
```

锁定态显示安全状态卡片与解锁入口，不显示账号列表。

- [ ] **步骤 4：运行预览构建**

运行任务 1 的同一条 `PreviewBuild` 命令。
预期：`BUILD SUCCESSFUL`

- [ ] **步骤 5：Commit**

```bash
git add apps/harmony-app/entry/src/main/ets/pages/Unlock.ets apps/harmony-app/entry/src/main/ets/pages/Index.ets apps/harmony-app/entry/src/main/ets/services/UnlockService.ets
git commit -m "feat(harmony): 添加安全解锁页骨架"
```

### 任务 3：实现底部胶囊浮岛与首页卡片组件

**文件：**
- 创建：`apps/harmony-app/entry/src/main/ets/components/home/BottomActionDock.ets`
- 创建：`apps/harmony-app/entry/src/main/ets/components/home/AccountCard.ets`
- 修改：`apps/harmony-app/entry/src/main/ets/pages/Index.ets`

- [ ] **步骤 1：抽出首页账号卡片组件**

在 `AccountCard.ets` 中定义：

```ts
@Component
export struct AccountCard {
  account: TotpAccount;
  onCopy?: (accountId: string) => void;
  onEdit?: (accountId: string) => void;
}
```

卡片内容包含：
- 品牌图标占位
- issuer
- accountName
- groupName
- digits/period/algorithm 标签
- 更新时间

- [ ] **步骤 2：实现底部胶囊浮岛**

在 `BottomActionDock.ets` 中定义：

```ts
@Component
export struct BottomActionDock {
  onAdd?: () => void;
  onSync?: () => void;
  onSettings?: () => void;
}
```

渲染 3 个入口：
- 添加
- 同步
- 设置

要求：
- 胶囊底
- 半透明
- 圆角
- 轻高光

- [ ] **步骤 3：将首页内联卡片替换为组件**

在 `Index.ets` 中用：

```ts
ForEach(this.accounts, (account: TotpAccount) => {
  AccountCard({
    account,
    onEdit: (accountId: string) => {
      this.activeAccountId = accountId;
      this.activeRoute = 'edit';
    }
  })
}, (account: TotpAccount) => account.id)
```

- [ ] **步骤 4：将底部操作入口替换为浮岛**

在 `Index.ets` 底部加入：

```ts
BottomActionDock({
  onAdd: () => {
    this.activeRoute = 'add';
  },
  onSync: () => {
    this.syncStatusMessage = '正在同步...';
  },
  onSettings: () => {
    this.activeRoute = 'settings';
  }
})
```

- [ ] **步骤 5：运行预览构建**

运行任务 1 的同一条 `PreviewBuild` 命令。
预期：`BUILD SUCCESSFUL`

- [ ] **步骤 6：Commit**

```bash
git add apps/harmony-app/entry/src/main/ets/components/home apps/harmony-app/entry/src/main/ets/pages/Index.ets
git commit -m "feat(harmony): 添加首页卡片与底部浮岛"
```

### 任务 4：实现统一添加页

**文件：**
- 创建：`apps/harmony-app/entry/src/main/ets/components/forms/AccountForm.ets`
- 创建：`apps/harmony-app/entry/src/main/ets/pages/AddAccount.ets`
- 创建：`apps/harmony-app/entry/src/main/ets/services/AccountEditorService.ets`
- 修改：`apps/harmony-app/entry/src/main/ets/pages/Index.ets`

- [ ] **步骤 1：抽出共享账号表单组件**

在 `AccountForm.ets` 中定义最小字段：

```ts
issuer: string;
accountName: string;
secret: string;
otpauthUri: string;
digits: string;
period: string;
algorithm: string;
groupName: string;
```

默认值：

```ts
digits = '6'
period = '30'
algorithm = 'SHA1'
groupName = 'Default'
```

- [ ] **步骤 2：实现添加页基础布局**

`AddAccount.ets` 至少包含：
- 标题与返回
- `otpauth://` 输入区
- 表单区
- 底部固定 `保存`

并保留两个入口按钮占位：
- 上传图片
- 重新扫码

- [ ] **步骤 3：实现本地保存逻辑**

`AccountEditorService.ets` 至少实现：

```ts
createAccount(context: common.UIAbilityContext, draft: TotpAccountRecord): LocalVault
```

内部流程：
- 读取 vault
- 追加账号
- 更新 `updatedAt`
- 回写本地 store

- [ ] **步骤 4：添加页保存后返回首页**

在 `AddAccount.ets` 的保存处理里：

```ts
this.editorService.createAccount(context, record);
this.onSaved();
```

首页收到回调后：
- 重新加载本地 vault
- 返回列表视图

- [ ] **步骤 5：运行预览构建**

运行任务 1 的同一条 `PreviewBuild` 命令。
预期：`BUILD SUCCESSFUL`

- [ ] **步骤 6：Commit**

```bash
git add apps/harmony-app/entry/src/main/ets/components/forms apps/harmony-app/entry/src/main/ets/pages/AddAccount.ets apps/harmony-app/entry/src/main/ets/services/AccountEditorService.ets apps/harmony-app/entry/src/main/ets/pages/Index.ets
git commit -m "feat(harmony): 添加统一账号新增页"
```

### 任务 5：实现编辑页与删除确认

**文件：**
- 创建：`apps/harmony-app/entry/src/main/ets/pages/EditAccount.ets`
- 创建：`apps/harmony-app/entry/src/main/ets/components/dialogs/DeleteConfirmDialog.ets`
- 修改：`apps/harmony-app/entry/src/main/ets/services/AccountEditorService.ets`
- 修改：`apps/harmony-app/entry/src/main/ets/pages/Index.ets`

- [ ] **步骤 1：为编辑服务补齐更新与删除**

在 `AccountEditorService.ets` 中增加：

```ts
updateAccount(context: common.UIAbilityContext, accountId: string, draft: TotpAccountRecord): LocalVault
deleteAccount(context: common.UIAbilityContext, accountId: string): LocalVault
```

- [ ] **步骤 2：实现删除确认弹层**

`DeleteConfirmDialog.ets` 包含：

```ts
title: '确认删除'
content: '删除后将从本地保管库移除该账号。'
confirm: '删除'
cancel: '取消'
```

- [ ] **步骤 3：实现编辑页布局**

`EditAccount.ets` 复用 `AccountForm.ets`，页面底部固定两个按钮：

```ts
Button('删除')
Button('保存')
```

删除先拉起确认弹层，保存后返回首页。

- [ ] **步骤 4：从首页编辑入口接入编辑页**

首页点击卡片编辑图标后：

```ts
this.activeAccountId = account.id;
this.activeRoute = 'edit';
```

编辑完成或删除完成后：
- 返回首页
- 重新加载 vault

- [ ] **步骤 5：运行预览构建**

运行任务 1 的同一条 `PreviewBuild` 命令。
预期：`BUILD SUCCESSFUL`

- [ ] **步骤 6：Commit**

```bash
git add apps/harmony-app/entry/src/main/ets/pages/EditAccount.ets apps/harmony-app/entry/src/main/ets/components/dialogs/DeleteConfirmDialog.ets apps/harmony-app/entry/src/main/ets/services/AccountEditorService.ets apps/harmony-app/entry/src/main/ets/pages/Index.ets
git commit -m "feat(harmony): 添加账号编辑与删除流程"
```

### 任务 6：回归验证与实现收口

**文件：**
- 修改：如验证后发现的少量问题文件

- [ ] **步骤 1：运行仓库级 Node 验证**

运行：

```powershell
npm run test
npm run typecheck
npm run build
```

工作目录：

```text
C:\Users\zhang\Project\TOTP\.worktrees\monorepo-harmony-v1
```

预期：全部通过。

- [ ] **步骤 2：运行 Harmony 预览构建回归**

运行任务 1 的同一条 `PreviewBuild` 命令。
预期：`BUILD SUCCESSFUL`

- [ ] **步骤 3：检查 git 工作区**

运行：

```powershell
git status --short
```

预期：只有本阶段预期代码改动，没有 `.idea`、`.appanalyzer` 等噪音。

- [ ] **步骤 4：最终 Commit**

```bash
git add .
git commit -m "feat(harmony): 完成首页与本地账号主流程首版"
```
