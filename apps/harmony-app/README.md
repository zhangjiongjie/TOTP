# TOTP HarmonyOS NEXT 客户端

`apps/harmony-app` 是 TOTP 多端工程中的 HarmonyOS NEXT 客户端，面向手机和平板设备。当前版本已经从最小骨架演进为首个可用版本，支持本地加密保管库、TOTP 验证码展示、WebDAV 同步、导入导出和生物识别解锁。

客户端遵循「本地优先，云端可选」的设计：未配置 WebDAV 时完全本地使用；配置 WebDAV 后，账号变更会主动同步到远端，并与浏览器插件端保持数据格式和同步行为一致。

## 当前状态

| 项目 | 说明 |
| --- | --- |
| 客户端类型 | HarmonyOS NEXT 应用 |
| 技术栈 | ArkTS、ArkUI、Stage 模型、entry HAP |
| SDK 版本 | HarmonyOS 6.1.0(23) |
| 目标设备 | phone、tablet |
| 默认 WebDAV 路径 | `/totp/vault.json` |
| 数据策略 | 本地加密优先，WebDAV 可选同步 |
| 共享策略 | 当前为 ArkTS 原生实现；协议、备份格式和同步语义与浏览器插件端对齐 |

## 已支持功能

### 账号与验证码

- 支持 TOTP 账号列表展示、验证码倒计时、验证码复制到剪贴板。
- 支持 6 位和 8 位验证码格式化展示。
- 支持 SHA1、SHA256、SHA512 算法。
- 支持自定义 Digits、Period、Algorithm 和 Group。
- 预置常见品牌图标，包括 GitHub、Google、Microsoft、OpenAI、Slack、Apple、Discord、Dropbox、LinkedIn、Notion、OneDrive、Spotify、Telegram、X 等。

### 添加、编辑与删除

- 添加页支持 `otpauth://` 链接解析、手动录入、二维码扫描和图片二维码识别入口。
- 扫描或解析成功后先回填表单，用户点击「保存」后才写入本地保管库。
- 编辑页支持修改发行方、账号名称、密钥、分组、算法、位数和周期。
- 删除账号需要二次确认。
- 添加、编辑、删除成功后会触发与 WebDAV 一致的主动同步流程。

### 本地保管库与解锁

- 首次使用需要设置主密码。
- 本地保管库使用主密码加密保存。
- 应用进入后台后会清理当前解锁态；再次进入需要重新解锁。
- 支持开启生物识别解锁。开启时会先验证系统生物识别能力，后续打开解锁页会自动拉起生物识别。
- 生物识别不可用或验证失败时，仍可回退到主密码解锁。

### WebDAV 同步

- WebDAV 为可选配置，不启用时数据只保留在本机。
- 设置页通过启用勾选项开启同步；必填项不完整时不会启用。
- 支持 WebDAV 服务器地址、保管库路径、用户名、密码和同步间隔配置。
- 首页提供手动同步按钮，同步过程中会展示加载状态。
- 打开应用和本地账号变更后会主动执行同步；当前版本不做后台常驻同步。
- 支持空库初始化策略：本地空且远端有数据时恢复远端，本地有数据且远端空时推送本地。
- 首次绑定时如果本地和远端都有数据且不一致，会进入冲突状态，由用户选择保留本地或使用远端。
- 非首次同步支持账号级三方合并：本地与远端独立新增、修改或删除不同账号时会自动合并；同一账号同一字段两端同时改动时进入冲突。
- 同步基线只比较账号核心字段，不比较本地更新时间等无关字段，减少无意义冲突。

### 导入与导出

- 设置页在 WebDAV 区域提供导入和导出入口。
- 导出会生成加密备份文件。
- 导入支持加密备份和旧版明文 JSON 结构。
- 导入成功后会写入本地保管库，并按当前 WebDAV 设置触发同步。

### 界面与交互

- 整体参考 HarmonyOS 系统应用的大标题、固定标题层和底部悬浮导航风格。
- 首页、添加、编辑、设置和解锁页统一支持浅色/深色模式。
- 首页列表参考浏览器插件端的账号卡片样式，同时针对手机屏幕压缩信息密度。
- 底部采用 HDS 风格的悬浮导航，包含首页、添加、设置入口。
- 同步、图片选择、扫码、编辑、返回等操作使用统一的圆形图标按钮。

## 同步规则

WebDAV 同步以「本地保管库」「远端保管库」「上次同步基线」三者做判断。

| 场景 | 处理方式 |
| --- | --- |
| 本地空，远端空 | 刷新同步基线 |
| 本地空，远端有数据 | 拉取远端并恢复本地 |
| 本地有数据，远端空 | 上传本地到远端 |
| 本地和远端一致 | 刷新同步基线 |
| 仅本地变化 | 上传本地到远端 |
| 仅远端变化 | 拉取远端到本地 |
| 两端独立变化且可合并 | 自动账号级合并后上传 |
| 两端变化且同账号字段冲突 | 提示用户选择本地或远端版本 |
| 首次绑定且两端都有不同数据 | 提示用户选择本地或远端版本 |

账号级合并当前以账号 `id` 为身份标识，核心比较字段包括发行方、账号名称、密钥、验证码位数、周期、算法、分组和图标标识。

## 目录结构

```text
apps/harmony-app
├── AppScope/                         # 应用全局配置
├── entry/                            # 主 HAP 模块
│   ├── src/main/ets/
│   │   ├── components/               # 通用表单、弹窗、首页卡片和底部导航组件
│   │   ├── entryability/             # Stage Ability 入口
│   │   ├── model/                    # 本地保管库、账号、WebDAV 设置等模型
│   │   ├── pages/                    # 首页、添加、编辑、设置、解锁页面
│   │   ├── services/                 # TOTP、同步、安全、导入导出等业务服务
│   │   └── storage/                  # Preferences 本地持久化封装
│   └── src/main/resources/           # 图标、品牌资源、颜色和页面配置
├── build-profile.json5               # 工程构建与签名配置
├── hvigor/                           # hvigor 配置
├── hvigorfile.ts                     # 工程级构建入口
└── oh-package.json5                  # 工程依赖配置
```

## 构建与运行

### 环境要求

- DevEco Studio。
- HarmonyOS SDK 6.1.0(23)。
- DevEco Studio 自带 Node.js、hvigor 和 ohpm。
- 真机运行需要在 DevEco Studio 中配置调试签名。

### 安装依赖

在 DevEco Studio 中打开 `apps/harmony-app` 后，可通过 IDE 同步工程；也可以在命令行执行：

```powershell
& 'C:\Program Files\Huawei\DevEco Studio\tools\ohpm\bin\ohpm.bat' install --all --registry https://ohpm.openharmony.cn/ohpm/
```

### 命令行构建

```powershell
& 'C:\Program Files\Huawei\DevEco Studio\tools\node\node.exe' 'C:\Program Files\Huawei\DevEco Studio\tools\hvigor\bin\hvigorw.js' --mode module -p module=entry@default -p product=default -p requiredDeviceType=phone assembleHap --analyze=normal --parallel --incremental
```

当前工程在 `hvigor/hvigor-config.json5` 中关闭了 hvigor daemon。这样会略微增加冷启动构建时间，但可以避免 SDK 路径或环境变量调整后被旧 daemon 状态污染。

### 签名说明

`build-profile.json5` 中的调试签名配置通常和本机 DevEco Studio、证书、Profile 文件路径相关。迁移到其他机器或其他设备时，建议在 DevEco Studio 的 Signing Configs 中重新配置，不要直接复用本机路径。

## 权限说明

| 权限 | 用途 |
| --- | --- |
| `ohos.permission.INTERNET` | 访问 WebDAV 服务 |
| `ohos.permission.ACCESS_BIOMETRIC` | 使用系统生物识别进行解锁 |

## 与多端工程的关系

当前仓库规划了共享包：

- `packages/totp-core`：TOTP 核心、加解密和导入导出逻辑。
- `packages/totp-sync`：WebDAV 同步和冲突处理逻辑。
- `packages/totp-test-fixtures`：跨端测试夹具与演示数据。

HarmonyOS 客户端目前没有直接依赖这些 TypeScript 共享包，而是在 ArkTS 侧实现等价逻辑。这样可以降低首个版本的构建和运行风险。后续如果要进一步降低跨端逻辑漂移，可以优先抽取协议测试、备份格式测试和同步场景夹具，再逐步评估是否引入可复用的共享实现。

## 已知边界与后续计划

- 二维码扫描和图片识别入口已接入系统能力，仍建议继续做更多真机兼容性验证。
- WebDAV 同步当前在前台触发，不做后台常驻任务。
- 首个版本以手机端体验为主，平板布局可继续单独优化。
- 当前账号级合并以账号 `id` 为准，跨端导入导致的重复账号自动识别可以后续再增强。
- 可以继续补充端到端测试夹具，覆盖浏览器插件端与 HarmonyOS 端的导入导出、加密备份和 WebDAV 同步一致性。
