# Android MVP 设计规格

日期：2026-05-17

## 1. 背景

`TOTP` 已经演进为多端身份验证器工程，当前包含 Chrome / Edge 浏览器插件、HarmonyOS NEXT 应用、共享 TOTP 核心包和 WebDAV 同步包。Android 端是下一个客户端方向。

现有仓库已经具备清晰的 `apps + packages` 边界：

- `apps/browser-extension` 承载浏览器插件。
- `apps/harmony-app` 承载 HarmonyOS NEXT 应用。
- `packages/totp-core` 承载 TOTP、账号模型、加密保管库、导入导出和品牌图标等共享逻辑。
- `packages/totp-sync` 承载 WebDAV 和同步合并逻辑。

Android 端第一阶段目标不是一次性追平所有端，而是先做出一个原生、可打包、可日常使用的 MVP，为后续扫码、WebDAV、导入导出和生物识别解锁留出稳定扩展点。

## 2. 目标

Android MVP 需要满足以下目标：

- 使用 Kotlin 和 Jetpack Compose 构建原生 Android 应用。
- 新建 `apps/android-app`，接入现有 monorepo 结构。
- 实现主密码解锁、账号列表、添加账号、编辑账号、删除账号和本地持久化。
- 支持手动录入和粘贴 `otpauth://` 链接自动回填表单。
- 实现 Kotlin 原生 TOTP、Base32 和 `otpauth://` 解析逻辑。
- 使用 Android Keystore 参与本地 vault 保护。
- 首页视觉方向对齐 HarmonyOS 端：状态头部、柔和卡片、底部操作区和多端产品识别度。
- 可以构建、安装和运行 APK。
- 使用现有 TypeScript 测试夹具验证 Kotlin 核心逻辑行为一致。

## 3. 非目标

第一阶段明确不包含以下内容：

- 不实现 WebDAV 同步。
- 不实现扫码添加。
- 不实现从图片识别二维码。
- 不实现导入导出。
- 不实现同步冲突处理 UI。
- 不实现生物识别快捷解锁。
- 不直接在 Android 运行时复用 `@totp/core` TypeScript 代码。
- 不引入 React Native、Capacitor 或 WebView 壳。

这些能力可以在 Android MVP 可用后分阶段补充。

## 4. 方案选择

### 4.1 客户端实现方案

选择：原生 Android MVP。

新建 `apps/android-app`，使用 Kotlin、Jetpack Compose 和 Material 3 实现 Android 客户端。第一阶段只做本地可用闭环，后续再扩展同步和导入导出。

放弃的方案：

- 首发完整功能版：功能一致性更强，但会被 WebDAV、扫码、文件选择和冲突 UI 拉长第一阶段周期。
- 仅做 APK 骨架：工程风险最低，但无法快速验证真实产品体验。

### 4.2 核心逻辑复用方案

选择：Kotlin 原生重写核心逻辑。

Android 端实现自己的 Kotlin 核心模块，覆盖以下能力：

- Base32 解码。
- TOTP 生成。
- `otpauth://` 解析。
- 账号模型和表单校验。
- 本地 vault 加解密。

`packages/totp-core` 不作为 Android 运行时依赖，而作为行为规格来源。Android 单测应复用或同步 `packages/totp-test-fixtures` 中的测试数据，确保 TOTP 输出、解析边界和校验规则与现有端一致。

### 4.3 本地 vault 安全方案

选择：主密码 + Android Keystore 包装密钥。

主密码继续作为跨端根凭据。Android 端使用主密码派生 vault key，并使用 Android Keystore 管理本机 wrapping key，保护本地密钥材料和 vault 元数据。

该方案的目标是兼顾两点：

- 保留多端一致的「主密码解锁保管库」心智。
- 利用 Android 平台安全能力，为后续接入生物识别快捷解锁留出空间。

### 4.4 视觉方向

选择：对齐 HarmonyOS 端的产品识别度。

Android 版不直接照搬浏览器插件，也不做高密度验证码面板。首页采用与 HarmonyOS 端相近的结构：

- 顶部状态头部。
- 账号卡片列表。
- 底部操作区。
- 柔和、克制的安全工具气质。

具体控件和交互仍使用 Android 原生习惯，例如 Compose、Material 3、系统返回、触摸反馈和 Android 无障碍语义。

## 5. 工程结构

目标新增目录：

```text
apps/
  android-app/
    app/
      build.gradle.kts
      src/
        main/
          AndroidManifest.xml
          java/
          res/
        test/
        androidTest/
    build.gradle.kts
    settings.gradle.kts
```

Android 工程第一阶段可以保持独立 Gradle 工程，不强行纳入 npm workspace 构建脚本。根 README 后续补充 Android 端命令和环境说明。

建议模块边界：

- `core/totp`：Base32、TOTP、时间窗口计算。
- `core/otpauth`：`otpauth://` 解析和字段归一化。
- `core/account`：账号模型、排序和表单校验。
- `data/vault`：本地 vault envelope、加解密和持久化。
- `data/settings`：本地设置和首次启动状态。
- `ui/unlock`：解锁和创建主密码。
- `ui/home`：首页、账号卡片、倒计时和复制。
- `ui/editor`：添加、编辑、删除账号。
- `ui/settings`：安全状态、清空数据和版本信息。

## 6. 技术栈

Android MVP 使用：

- Kotlin。
- Jetpack Compose。
- Material 3。
- 单 Activity。
- Compose Navigation。
- Kotlin Coroutines。
- Android Keystore。
- Jetpack Security 或等价的安全存储封装。
- JUnit 单测。
- Compose UI smoke 测试。

`minSdk` 建议设为 26 或 28。最终值应结合 Android Keystore、Jetpack Security 和目标设备覆盖面在实现计划中确认。

## 7. 页面设计

### 7.1 UnlockScreen

职责：

- 首次打开时创建主密码。
- 日常打开时输入主密码解锁。
- 展示 vault 状态和错误提示。

规则：

- 首次创建主密码需要二次确认。
- 密码不持久化保存。
- 解锁成功后进入首页。
- 解锁失败只展示明确错误，不泄露加密细节。

### 7.2 HomeScreen

职责：

- 展示 vault 解锁状态。
- 展示账号列表和当前 TOTP。
- 支持复制验证码。
- 进入添加、编辑和设置。

结构：

1. 状态头部。
2. 账号列表。
3. 底部操作区。

账号卡片包含：

- 品牌图标。
- `issuer`。
- `accountName`。
- `group`。
- 当前验证码。
- 倒计时。
- 编辑入口。

空状态需要提示本地保管库已就绪，并引导用户添加第一个账号。

### 7.3 AddAccountScreen

职责：

- 手动创建账号。
- 粘贴 `otpauth://` 后自动解析并回填表单。

字段：

- `Issuer`。
- `Account`。
- `Secret`。
- `Digits`，默认 6。
- `Period`，默认 30。
- `Algorithm`，默认 SHA1。
- `Group`，默认 `Default`。

保存规则：

- 解析成功只回填表单，不自动入库。
- 用户点击保存后才写入 vault。
- 保存前做字段校验和 TOTP 试算。

### 7.4 EditAccountScreen

职责：

- 编辑账号字段。
- 删除账号。

规则：

- 编辑页面复用添加页表单结构。
- 删除必须二次确认。
- 保存或删除成功后返回首页。

### 7.5 SettingsScreen

第一阶段只承接与本地 MVP 相关的内容：

- 当前 vault 状态。
- 清空本地数据。
- 应用版本信息。
- 后续能力入口提示，例如 WebDAV、导入导出和生物识别，但不实现真实流程。

## 8. 数据模型

核心模型使用 Kotlin 原生定义。

```kotlin
data class TotpAccount(
    val id: String,
    val issuer: String,
    val accountName: String,
    val secret: String,
    val algorithm: TotpAlgorithm,
    val digits: Int,
    val period: Int,
    val group: String,
    val createdAt: Long,
    val updatedAt: Long
)
```

```kotlin
data class LocalVault(
    val schemaVersion: Int,
    val accounts: List<TotpAccount>,
    val updatedAt: Long
)
```

```kotlin
data class EncryptedVaultEnvelope(
    val schemaVersion: Int,
    val kdf: String,
    val salt: String,
    val nonce: String,
    val ciphertext: String,
    val updatedAt: Long
)
```

具体字段编码格式应在实现计划中固定，优先使用稳定、可迁移的 JSON 结构。

## 9. 本地安全与生命周期

本地持久化只保存加密 envelope，不保存明文账号。

解锁流程：

1. 用户输入主密码。
2. 使用 salt 和 KDF 参数派生 vault key。
3. 使用 Android Keystore 管理的 wrapping key 参与本机保护。
4. 解密 vault envelope。
5. 将明文 `LocalVault` 保留在内存状态中。

锁定规则：

- 用户主动锁定时清除内存明文。
- 应用进入后台后的自动锁定策略在 MVP 中可以先采用保守默认值，并在设置页后续开放配置。
- 解锁失败不破坏现有 vault 数据。

清空数据：

- 删除本地加密 envelope。
- 删除或轮换相关 Keystore 条目。
- 回到首次创建主密码状态。

## 10. 品牌图标

MVP 需要支持基础品牌图标展示，但不要求完整自动化。

第一阶段策略：

- 从 `packages/totp-core/src/icons/assets` 选取当前已有品牌资源。
- 同步到 Android `res/drawable` 或 `res/drawable-nodpi`。
- 实现一个简单的 Kotlin `BrandIconMatcher`。
- 未匹配时使用默认应用图标。

后续可以新增脚本，从 `packages/totp-core/src/icons/icon-matchers-data.json` 自动生成 Android matcher 和资源映射。

## 11. 测试策略

### 11.1 Kotlin 单测

必须覆盖：

- Base32 解码。
- TOTP RFC 样例。
- SHA1、SHA256、SHA512。
- 6 位和 8 位验证码。
- `otpauth://` 解析。
- 表单校验。
- vault 加密、解密和错误密码失败路径。

### 11.2 跨端一致性

Android 测试应复用现有测试夹具，确保以下行为与 `@totp/core` 一致：

- 相同 secret、时间、算法、位数和周期生成相同验证码。
- `otpauth://` 常见格式解析一致。
- 非法 secret 和非法 URI 的错误边界一致。

### 11.3 UI smoke 测试

至少覆盖：

- 首次创建主密码。
- 解锁。
- 添加账号。
- 首页显示验证码。
- 编辑账号。
- 删除账号。

### 11.4 手动验收

使用 Android CLI 或 Gradle 完成：

- 构建 APK。
- 安装到模拟器或真机。
- 完成创建、解锁、添加、复制、编辑、删除和重启恢复流程。

## 12. 验收标准

Android MVP 完成时应满足：

- `apps/android-app` 可以独立构建 APK。
- APK 可以安装并启动。
- 首次打开可以创建主密码。
- 日常打开可以输入主密码解锁。
- 解锁后可以添加账号。
- 支持粘贴 `otpauth://` 自动回填。
- 首页验证码和倒计时正确刷新。
- 点击验证码可以复制。
- 可以编辑和删除账号。
- 关闭应用后再次打开，输入主密码可以恢复本地账号。
- 清空数据后回到首次设置状态。
- Kotlin TOTP 测试与现有测试夹具结果一致。

## 13. 后续阶段

MVP 之后建议按以下顺序演进：

1. 生物识别快捷解锁。
2. 扫码添加和图片二维码识别。
3. 导入导出。
4. WebDAV 同步和同步状态。
5. 同步冲突处理 UI。
6. Android brand matcher 自动生成脚本。
7. 发布签名、版本号和分发流程。

该顺序优先保证本地安全闭环，再扩展输入方式和跨端同步。
