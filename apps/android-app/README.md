# Android 应用

这是 `TOTP` 的原生 Android 客户端，第一阶段聚焦本地可用 MVP。

## 技术栈

- Kotlin
- Jetpack Compose
- Material 3
- Android Keystore
- Android CLI

## 构建和运行

在 `apps/android-app` 目录执行：

```powershell
.\gradlew.bat :app:testDebugUnitTest
.\gradlew.bat :app:assembleDebug
android run --apks .\app\build\outputs\apk\debug\app-debug.apk
```

如果本机还没有生成 Gradle wrapper，可以使用已安装的 Gradle 运行同样的任务，或先执行：

```powershell
gradle wrapper --gradle-version 9.4.1
```

## 已覆盖范围

- 主密码创建和解锁。
- 本地加密 vault。
- 添加、编辑和删除账号。
- `otpauth://` URI 粘贴解析。
- TOTP 验证码生成、倒计时和复制。
- 设置页锁定和清空本地 vault。

## 暂未覆盖

- WebDAV 同步。
- 扫码和图片识别。
- 导入和导出。
- 生物识别解锁。

## 调试提示

APK 输出位置：

```text
apps/android-app/app/build/outputs/apk/debug/app-debug.apk
```

没有连接设备或模拟器时，`android run` 会提示设备缺失；这不代表 APK 构建失败。
