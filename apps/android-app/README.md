# Android 应用

这是 `TOTP` 的原生 Android 客户端。当前版本已经从本地 MVP 收敛到可日常调试的完整闭环：本地加密保管库、TOTP 账号管理、扫码和图片导入、WebDAV 同步、快速解锁、导入导出和品牌图标都已经接入。

Android 端的目标不是照搬 HarmonyOS 或浏览器插件，而是在数据语义、同步规则和视觉识别上保持多端一致，同时使用 Android 原生的系统能力和交互习惯。

## 技术栈

- Kotlin
- Jetpack Compose
- Material 3
- Android Keystore
- Android Biometric / Device Credential
- CameraX / ML Kit 二维码识别
- WebDAV HTTP 同步
- JUnit 单元测试
- Android CLI / Gradle

## 构建和运行

在 `apps/android-app` 目录执行：

```powershell
.\gradlew.bat :app:testDebugUnitTest
.\gradlew.bat :app:assembleDebug
android run --apks .\app\build\outputs\apk\debug\app-debug.apk
```

如果本机没有 Gradle wrapper，可以使用已安装的 Gradle 运行同样的任务，或先执行：

```powershell
gradle wrapper --gradle-version 9.4.1
```

APK 输出位置：

```text
apps/android-app/app/build/outputs/apk/debug/app-debug.apk
```

## 当前能力

- 主密码创建、主密码解锁和快速解锁。
- 本地加密 vault，支持账号添加、编辑、删除和复制验证码。
- `otpauth://` 粘贴解析、扫码解析和图片二维码解析。
- 首页账号列表、品牌图标、倒计时、同步入口和提示栏。
- 设置页 WebDAV 配置、测试连接、手动同步和启用状态。
- WebDAV 自动同步、v2 远端 key envelope、账号级合并和冲突提示。
- 设置页支持修改主密码；WebDAV 已启用时修改后会立刻同步到远端。
- 加密备份导入 / 导出，兼容旧版明文 JSON 导入。
- 浅色 / 深色模式，状态栏和 Title 栏跟随当前主题色。
- PNG 品牌图标资源，避免 Android 对复杂 SVG 渲染不一致。

## Android 差异化设计

### 系统 UI

Android 端使用单 Activity + Compose 页面分支，所有主页面都放在带 Title 栏的 `Scaffold` 中。Title 栏使用主题蓝，状态栏颜色在 Compose 主题层跟随 `MaterialTheme.colorScheme.primary`，确保浅色和深色模式下状态栏与 Title 栏一致。

底部导航使用 Android Material 3 的 `NavigationBarItem`，文案与 HarmonyOS 端一致：

- 首页
- 添加
- 设置

选中态使用主题蓝，保留 Android 原生触摸反馈、三键导航和手势导航兼容。

### 解锁和 Keystore

Android 端保留主密码作为跨端根凭据，同时接入 Android Keystore 和系统凭据：

- 普通主密码解锁：用主密码 + salt 重新执行 PBKDF2 得到 wrapping key，解开随机 `vaultKey` 后解密本地 vault。
- 快速解锁：开启后把本地 `vaultKey` 和 `masterPassword` 存入 Android Keystore 保护的加密记录。
- 系统凭据：设备支持生物识别时显示生物识别解锁；不支持生物识别但支持系统锁屏时，显示系统凭证解锁。
- 自动拉起：进入解锁页时优先尝试系统凭据 / 生物识别；失败、取消或超时后回落到主密码。

快速解锁的 Keystore key 设置了用户认证要求，读取凭据前必须通过系统凭据或生物识别。这样可以绕过本地 vault 的 PBKDF2，改善后续解锁速度，同时保留系统级保护。

### Vault v2 和 WebDAV

Android 本地 vault 和 WebDAV 远端 vault 都采用 v2 key envelope：

- PBKDF2 SHA-256
- 310000 次迭代
- AES-GCM
- 随机 256-bit `vaultKey`
- 16 字节 salt
- 12 字节 IV
- 128 bit tag

流程：

```text
masterPassword + kdf salt
  -> wrappingKey
  -> 解开 encryptedVaultKey
  -> vaultKey
  -> 解密账号数据
```

修改账号时复用同一个 `vaultKey`，只重写账号数据密文。修改主密码时只重新包裹 `vaultKey`，账号数据密钥保持不变。

### 文件选择器生命周期

Android 导入 / 导出需要调用系统文件管理器。系统文件面板会让当前 Activity 进入 `ON_STOP`，如果直接按退出后台处理，会导致用户完成或取消导入导出后回到 App 需要重新解锁。

当前 Android 端在启动导入 / 导出文件选择器前设置临时标记，文件选择器返回后清理标记。只有普通退后台才会立即锁定，导入 / 导出这种系统面板往返不会触发锁定。

### 扫码和图片识别

扫码使用 Android 原生相机权限和相机页面，不依赖需要动态下载模块的系统扫码器。图片解析使用 Android 图片选择器和二维码识别服务，成功后会自动填入 `otpauth://` 链接并解析到添加账号表单。

### 品牌图标

Android 对部分复杂 SVG 的显示与 HarmonyOS、浏览器不同。为保证真机显示稳定，Android 端统一使用从 `packages/totp-core` 资源生成的 PNG 图标。

图标匹配规则仍与共享包对齐，特殊域名规则也放在匹配层，例如 `git01.mobiwire.com` 会匹配 GitLab。

## 数据和同步语义

Android 端保持和其他端一致的数据语义：

- 本地优先，未启用 WebDAV 时只保存本地加密 vault。
- 创建、编辑、删除账号后，如果 WebDAV 已启用，会主动同步本地变更。
- 解锁后会触发一次 WebDAV 同步，尽量保持首页数据新鲜。
- WebDAV 同步使用本地、远端和同步基线进行判断。
- 两端独立修改时优先账号级合并；同一账号字段冲突进入冲突状态。
- 导入备份当前语义是恢复备份，会覆盖本地 vault；导入后如果 WebDAV 已启用，会按当前本地 vault 推动同步。

## 导入导出

导出文件使用当前主密码加密。加密参数与 WebDAV 远端 vault 的 `encryptedVault` blob 保持一致，但外层 JSON envelope 不同。

导出备份结构：

```json
{
  "mode": "encrypted",
  "encryptedVault": {
    "formatVersion": 2,
    "vaultId": "...",
    "kdf": {
      "name": "PBKDF2",
      "iterations": 310000,
      "hash": "SHA-256",
      "salt": "..."
    },
    "keyEncryption": {
      "cipher": "AES-GCM",
      "iv": "...",
      "ciphertext": "..."
    },
    "vaultEncryption": {
      "cipher": "AES-GCM",
      "iv": "...",
      "ciphertext": "..."
    }
  }
}
```

注意：

- 旧 v1 加密导出需要先用 `tools/migrate-vault-v1-to-v2.mjs` 转换为 v2 导出。
- WebDAV 远端文件不能直接当完整备份文件导入，因为外层 envelope 包含 `revision` 和 `updatedAt` 等同步字段。
- 导入时主密码必须与备份文件匹配，否则会提示备份密码与当前主密码不匹配。

## 常用调试

安装到已连接设备：

```powershell
adb install -r .\app\build\outputs\apk\debug\app-debug.apk
```

查看设备：

```powershell
adb devices
```

查看性能日志关键字：

```powershell
adb logcat | findstr TotpUnlockPerf
adb logcat | findstr TotpWebDavPerf
```

常见日志：

- `TotpUnlockPerf`：主密码解锁和快速解锁耗时。
- `TotpWebDavPerf`：WebDAV 下载、加密、解密、上传和 key cache 命中情况。

## 验证命令

提交前建议执行：

```powershell
.\gradlew.bat --no-daemon :app:testDebugUnitTest :app:assembleDebug
```

当前 Windows 环境下 Kotlin daemon 可能因本机权限报 `AccessDeniedException`，Gradle 会自动 fallback 到非 daemon 编译。只要最终输出 `BUILD SUCCESSFUL`，不影响构建结果。
