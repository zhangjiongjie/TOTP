# TOTP 多端 Monorepo 与鸿蒙端接入设计规格

## 1. 背景

当前仓库已经具备一套可运行的浏览器插件实现，但工程结构仍然保留着典型的单端插件形态：

- 根目录直接承载 `Vite + React + Manifest V3` 工程。
- 业务核心、同步能力、状态编排与浏览器插件 UI 混放在同一个 `src/` 下。
- 文档与 README 也仍以「浏览器插件」为主要视角。

这与项目的真实目标并不一致。当前项目不是一个单纯的浏览器插件项目，而是一个面向多个客户端形态的 TOTP 产品工程。已明确的客户端方向包括：

- 浏览器插件端
- 鸿蒙端
- Android 端
- 未来可能补充的独立 Web 端

因此，在开始鸿蒙端实现之前，先收敛工程结构是必要步骤。否则我们会在错误的目录边界上继续堆功能，后续共享逻辑抽取、平台能力隔离、测试组织和发布流程都会越来越难维护。

## 2. 设计目标

本次设计的目标不是一次性完成所有平台工程，而是先把仓库收敛为一个适合多端演进的 `monorepo` 结构，并为鸿蒙端第一阶段落地提供清晰边界。

本次设计需要满足以下目标：

- 将当前仓库从「单端插件工程」调整为「多端客户端工程」。
- 保留现有浏览器插件端能力，不破坏当前已完成的插件版本。
- 抽离可复用的 TOTP 核心逻辑和同步逻辑，避免鸿蒙端重复实现。
- 为鸿蒙端新工程预留清晰位置和依赖关系。
- 使用 `npm workspaces`，不引入额外的 workspace 管理工具。
- 第一阶段只做必要拆分，不做过度抽象。

## 3. 非目标

本次设计明确不包含以下内容：

- 不在本次规格中直接实现鸿蒙端完整功能。
- 不在本次规格中同时实现 Android 端。
- 不在本次规格中统一所有平台 UI 组件。
- 不在本次规格中引入 Turbo、Nx、pnpm 等额外工具链。
- 不在本次规格中设计云账号体系或服务端。

## 4. 现状评估

### 4.1 当前代码结构

当前核心目录如下：

- [`src/core`](</c:/Users/zhang/Project/TOTP/src/core>)
- [`src/services`](</c:/Users/zhang/Project/TOTP/src/services>)
- [`src/state`](</c:/Users/zhang/Project/TOTP/src/state>)
- [`src/popup`](</c:/Users/zhang/Project/TOTP/src/popup>)

其中已经自然形成了两类代码：

1. 可复用业务核心

- `src/core/totp`
- `src/core/vault`
- `src/core/accounts`
- `src/core/import`
- `src/core/icons`
- `src/core/types.ts`

2. 浏览器插件相关实现

- `src/popup`
- `manifest.config.ts`
- `public/manifest.json`
- 与浏览器 popup 生命周期强相关的状态编排

另有一部分代码处于中间层，虽然现在在插件里使用，但未来应转为跨端能力：

- `src/core/sync`
- `src/services/sync-service.ts`
- `src/services/import-service.ts`
- `src/state/sync-store.ts`

### 4.2 当前结构的问题

当前结构继续扩展到多端会出现以下问题：

- 浏览器插件端与共享逻辑边界不清，鸿蒙端接入时无法直接判断哪些代码可复用。
- `state` 与 `services` 混有浏览器会话语义，不适合作为鸿蒙端直接依赖。
- 根目录构建脚本、测试脚本和 README 都默认服务于浏览器插件，不利于多端协同。
- 鸿蒙端一旦直接塞进根目录，很容易形成「插件项目里硬塞一个鸿蒙子目录」的结构债。

## 5. 方案对比

### 5.1 方案 A：`apps + packages` 标准 monorepo

目录示意：

- `apps/browser-extension`
- `apps/harmony-app`
- `packages/totp-core`
- `packages/totp-sync`
- `packages/totp-test-fixtures`

优点：

- 语义清晰，符合多端工程的常见组织方式。
- `app` 与 `shared package` 边界天然明确。
- 后续追加 Android / Web 时扩展路径稳定。
- 方便逐步演进为真正的跨端产品仓库。

缺点：

- 需要一次目录搬迁与脚本调整。
- 需要重新组织测试与构建入口。

### 5.2 方案 B：`clients + shared`

目录示意：

- `clients/browser-extension`
- `clients/harmony-app`
- `shared/core`
- `shared/sync`

优点：

- 业务语义直观。

缺点：

- 与 JavaScript / TypeScript 社区通用 monorepo 习惯相比，不够标准。
- 后续工具链和团队认知通常还是会回到 `apps/packages`。

### 5.3 方案 C：保留根工程，增量塞入鸿蒙目录

目录示意：

- 现有根工程继续保留为插件
- 新增 `harmony/`
- 共享逻辑后续再慢慢抽

优点：

- 起步最快。

缺点：

- 结构债最大。
- 未来共享代码迁移成本更高。
- 根目录职责持续模糊。

### 5.4 选型结论

采用方案 A，即：

- 使用 `apps + packages`
- 采用 `npm workspaces`
- 第一阶段只落必要目录与必要抽取
- 不做额外复杂工具链

## 6. 最终目录设计

第一阶段目标目录如下：

```text
TOTP/
  apps/
    browser-extension/
    harmony-app/
  packages/
    totp-core/
    totp-sync/
    totp-test-fixtures/
  docs/
  package.json
  package-lock.json
```

### 6.1 `apps/browser-extension`

职责：

- 承载浏览器插件入口与 UI。
- 持有 `manifest`、popup 页面、浏览器特定样式与平台交互。
- 依赖 `packages/totp-core` 和 `packages/totp-sync`。

应迁入的内容包括：

- 当前 `src/popup`
- 当前 `public`
- 当前 `manifest.config.ts`
- 当前与插件构建直接相关的 `index.html`
- 插件端测试配置与构建配置

### 6.2 `apps/harmony-app`

职责：

- 承载鸿蒙应用工程。
- 持有 ArkTS 页面、鸿蒙生命周期、平台 API 适配、DevEco 构建文件。
- 依赖 `packages/totp-core` 和 `packages/totp-sync`。

初期应包含的工程元素：

- `AppScope`
- `entry`
- `build-profile.json5`
- `hvigor` 相关文件
- `oh-package.json5`
- `module.json5`

### 6.3 `packages/totp-core`

职责：

- 提供纯业务核心能力。
- 不依赖浏览器 API。
- 不依赖鸿蒙 API。
- 尽可能保持纯 TypeScript、纯数据逻辑、纯算法边界。

建议纳入的内容：

- TOTP 算法
- `otpauth://` 解析
- 账号实体模型
- 分组与排序逻辑
- 品牌图标匹配键规则
- vault 加解密
- 导入导出数据格式

### 6.4 `packages/totp-sync`

职责：

- 提供与平台无关的同步流程与同步协议模型。
- 对上暴露同步引擎、冲突模型、同步结果对象。
- 平台特定存储和 IO 通过适配接口注入。

建议纳入的内容：

- WebDAV client
- 同步冲突模型
- 同步引擎
- 同步元数据类型
- 跨端通用的同步状态定义

### 6.5 `packages/totp-test-fixtures`

职责：

- 放共享测试夹具、演示数据、跨包测试辅助。
- 避免各端重复维护同一批测试数据。

此包在第一阶段可以非常轻，仅在真正出现共享测试需求时启用。

## 7. 代码边界设计

### 7.1 共享与平台隔离原则

必须坚持以下原则：

- UI 不共享。
- 平台存储不共享。
- 平台生命周期不共享。
- 业务规则共享。
- 同步协议与冲突规则共享。
- 数据格式共享。

换句话说：

- 浏览器插件端和鸿蒙端可以长得不一样。
- 但它们必须使用同一套 TOTP 数据模型、vault 格式和同步协议。

### 7.2 `totp-core` 允许依赖的内容

允许：

- TypeScript 标准语言能力
- 纯函数工具
- 加密与编码抽象

不允许：

- `window`
- `document`
- `chrome.*`
- `browser.*`
- 鸿蒙平台 API
- UI 路由或页面组件

### 7.3 `totp-sync` 允许依赖的内容

允许：

- `totp-core`
- 网络协议模型
- 存储适配接口

不允许：

- 具体浏览器存储实现
- 具体鸿蒙存储实现
- Popup 状态机或页面组件

### 7.4 应保留在 `apps/browser-extension` 的内容

必须留在插件端：

- popup 页面与路由
- 插件顶栏 / 浮动按钮 / 对话框 UI
- 浏览器复制反馈与会话交互
- 插件特有的解锁体验与 Popup 布局

### 7.5 应保留在 `apps/harmony-app` 的内容

必须留在鸿蒙端：

- ArkTS UI 页面
- 页面路由与导航
- 剪贴板、生命周期、权限、设备能力
- DevEco / Hvigor 构建配置

## 8. README 与文档调整原则

根目录 [`README.md`](</c:/Users/zhang/Project/TOTP/README.md>) 不应继续只描述浏览器插件。

改造后应调整为：

- 仓库是一个多端 TOTP 客户端工程
- 浏览器插件端位置
- 鸿蒙端位置
- 共享包位置
- workspace 级开发命令

同时保留各端自己的 README：

- `apps/browser-extension/README.md`
- `apps/harmony-app/README.md`

## 9. 第一阶段迁移范围

第一阶段只做以下工作：

1. 建立 `npm workspaces`
2. 创建 `apps/browser-extension`
3. 创建 `apps/harmony-app`
4. 创建 `packages/totp-core`
5. 创建 `packages/totp-sync`
6. 将当前插件代码搬入 `apps/browser-extension`
7. 将可复用核心逻辑抽入 `packages`
8. 调整插件端引用到新的包路径
9. 搭好鸿蒙端最小工程骨架

第一阶段明确不做：

- Android 工程
- 共享 UI 组件库
- 多端统一主题系统
- 将所有测试一次性拆分到最优形态

## 10. 鸿蒙端第一阶段范围

在 monorepo 结构完成后，鸿蒙端第一阶段仅需具备以下目标：

- 鸿蒙工程可正常构建
- 能引入 `totp-core`
- 能展示最小页面
- 能验证 TOTP 核心逻辑在鸿蒙端可调用

此阶段不要求一次性完成完整产品 UI。

## 11. 风险与规避

### 11.1 风险：迁移时破坏现有插件端

规避：

- 先搬目录，再补引用
- 保留插件端测试作为迁移验收基线

### 11.2 风险：共享包边界抽得过早或过多

规避：

- 只抽纯逻辑
- 不提前抽 UI
- 不提前抽平台状态编排

### 11.3 风险：鸿蒙工程与 npm workspace 兼容问题

规避：

- 鸿蒙工程先做最小可运行骨架
- 共享包先保持纯 TypeScript 边界
- 必要时通过构建产物或中间适配层接入

### 11.4 风险：根目录命令体验变差

规避：

- 在 workspace 根定义统一脚本
- 为各端保留清晰的子命令入口

## 12. 成功标准

完成本次结构改造后，应满足：

- 仓库目录能直观看出这是多端工程，而非单一插件工程
- 浏览器插件端仍可通过原有测试与构建验证
- 共享逻辑可以独立被浏览器插件端和鸿蒙端依赖
- 鸿蒙端拥有明确、干净、可继续实现的工程位置
- 根目录 README 与文档语义完成更新

## 13. 最终结论

本项目后续应以 `npm workspaces + apps/packages monorepo` 为基础继续推进。

第一阶段不追求一次性把所有平台逻辑抽象到位，而是重点完成三件事：

- 把浏览器插件端从根工程中抽离出来
- 建立稳定的共享核心包边界
- 为鸿蒙端建立一个干净可持续演进的工程入口

这是后续真正开发 HarmonyOS 版本 TOTP App 的前置条件，也是整个仓库从「单端实现」升级为「多端产品工程」的关键一步。
