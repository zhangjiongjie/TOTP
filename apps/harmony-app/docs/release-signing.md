# HarmonyOS 发布签名记录

本文记录 TOTP HarmonyOS 包的正式发布签名流程，避免下次重新排查同一个问题。

## 当前结论

- 发布私钥库保存在本机 `C:/Users/zhang/.ohos/config/` 下，不提交到仓库。
- 发布私钥别名：由 DevEco 本机签名配置管理，不提交到仓库。
- 签名算法：`SHA256withECDSA`
- SDK 目标：`compatibleSdkVersion = 6.0.2(22)`，`targetSdkVersion = 6.0.2(22)`
- AGC 正式 Profile 和证书属于本地签名材料，不提交到仓库。

本机发布 `.p12` 和原始发布 `.p12` 使用的是同一把发布私钥，只是 `.p12` 的保护密码升级为 32 位以上的长密码，用来满足 DevEco/Hvigor 的发布签名校验。`build-profile.json5` 中的 `storePassword` / `keyPassword` 需要使用 DevEco 生成的加密密码串，不能直接填写 `.p12` 的明文密码。

## 安全约定

1. 不提交 `.p12`、`.p7b`、`.cer` 等正式签名材料。
2. 不提交发布签名密码，包括 DevEco 生成的加密密码串。
3. 公开仓库中的 `build-profile.json5` 只保留 debug 签名配置。
4. 需要正式打包时，在本机临时切换 release signingConfig，构建完成后再恢复脱敏配置。

## 这次踩过的坑

1. 不能把正式 Profile / 证书和 debug `.p12` / `debugKey` 混用。这样会在签名阶段报证书或 alias 相关错误。
2. DevEco/Hvigor 对 `storePassword` 和 `keyPassword` 有长度校验。短密码即使能被 `keytool` 打开，也会在构建签名阶段失败。
3. 如果只需要修复密码长度，不需要重新申请证书。用同一把发布私钥重新导出一个长密码保护的 `.p12` 即可。
4. `build-profile.json5` 中不能直接填写 `.p12` 的明文密码，需要使用 DevEco 生成的加密密码串。

## 验证发布私钥库

```powershell
& 'C:\Program Files\Huawei\DevEco Studio\jbr\bin\keytool.exe' `
  '-J-Duser.language=en' `
  -list -v `
  -keystore 'C:\Users\zhang\.ohos\config\<release-keystore>.p12' `
  -storetype PKCS12 `
  -storepass '<long-p12-password>'
```

关键输出应包含：

```text
Alias name: <release-key-alias>
Signature algorithm name: SHA256withECDSA
Subject Public Key Algorithm: 256-bit EC (secp256r1) key
```

## 正式 release 构建

在本机临时配置 release signingConfig 后，在 `apps/harmony-app` 目录运行：

```powershell
& 'C:\Program Files\Huawei\DevEco Studio\tools\hvigor\bin\hvigorw.bat' `
  --mode project `
  -p product=release `
  -p buildMode=release `
  assembleApp `
  --no-daemon `
  --stacktrace
```

构建成功后检查最新产物：

```powershell
Get-ChildItem -Recurse -LiteralPath 'C:\Users\zhang\Project\TOTP\apps\harmony-app\build\outputs' -Include *.app,*.hap,*.zip |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 20 FullName,Length,LastWriteTime
```

## 发布归档建议

建议把每次提交华为审核的产物复制到 `dist/harmony-release-YYYYMMDD-version/`，至少包含：

- signed `.app`
- signed `.hap`（如构建产物中存在）
- `app-symbol.zip`
- 本次使用的 `versionName` 和 `versionCode`

当前版本号记录在 `apps/harmony-app/AppScope/app.json5`，本次发布为 `versionName = 1.0.0`、`versionCode = 6`。