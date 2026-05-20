# Vault v2 Key Envelope 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将三端加密、WebDAV 同步、导入导出统一升级到随机长期 `vaultKey` 的 v2 envelope，并提供旧导出转换工具。

**架构：** `masterPassword` 只通过 KDF 派生临时 `wrappingKey`，用于 AES-GCM 包裹随机 `vaultKey`；账号数据始终由 `vaultKey` 使用 AES-GCM 加密。WebDAV 远端存在时采用远端 `vaultKey`，远端解不开时阻止上传。

**技术栈：** Web Crypto / TypeScript、ArkTS cryptoFramework、Kotlin/JCA AES-GCM、Android Keystore、Vitest、Gradle unit tests。

---

## 文件结构

- 修改 `packages/totp-core/src/vault/password.ts`：暴露 wrapping key 派生、AES raw key import、随机字节辅助。
- 修改 `packages/totp-core/src/vault/crypto.ts`：定义 v2 envelope、encrypt/decrypt/rewrap/save-with-key API。
- 修改 `packages/totp-core/src/vault/export.ts`：导入导出使用统一 v2 envelope。
- 新增 `packages/totp-core/src/vault/legacy-v1.ts`：仅供迁移工具读取旧导出。
- 新增 `tools/migrate-vault-v1-to-v2`：旧 encrypted export 转新 encrypted export。
- 修改 `packages/totp-sync/src/sync/*`：WebDAV 内层 encryptedVault 仍用 core 类型，远端存在时阻止未解密上传。
- 修改 `apps/browser-extension/src/state/app-store.ts` 和 `apps/browser-extension/src/services/sync-service.ts`：会话保存 `vaultKey`，保存/同步复用 key。
- 修改 `apps/harmony-app/entry/src/main/ets/services/RemoteVaultCryptoService.ets`、`LocalVaultStore.ets`：实现 v2 envelope 和远端 key 优先。
- 修改 `apps/android-app/app/src/main/java/com/totp/authenticator/data/vault/*`：本地 vault 改为随机 `vaultKey` envelope。
- 修改 `apps/android-app/app/src/main/java/com/totp/authenticator/data/webdav/*`：移除 remote key cache，采用统一 envelope，远端解不开时阻止上传。
- 修改 `apps/android-app/app/src/main/java/com/totp/authenticator/data/biometric/BiometricVaultUnlockStore.kt`：只缓存 `vaultKey`，不缓存 master password。
- 修改三端 Settings：增加修改主密码入口，WebDAV 开启时修改后立即同步。

## 任务 1：totp-core v2 crypto

- [ ] **步骤 1：编写失败的 v2 round-trip 测试**

在 `packages/totp-core/src/vault/crypto.test.ts` 添加测试：加密返回 `formatVersion: 2`、含 `vaultId/keyEncryption/vaultEncryption`，解密后账号一致。

- [ ] **步骤 2：运行测试验证失败**

运行：`pnpm --filter @totp/core test -- crypto.test.ts`
预期：旧实现返回 `formatVersion: 1`，测试失败。

- [ ] **步骤 3：实现 v2 envelope**

在 `password.ts` 增加 `deriveWrappingKey`、`importAesKey`；在 `crypto.ts` 改造 `encryptVault/decryptVault`，新增 `decryptVaultWithKey`、`encryptVaultWithKey`、`rewrapVaultKey`。

- [ ] **步骤 4：运行测试验证通过**

运行：`pnpm --filter @totp/core test -- crypto.test.ts`
预期：PASS。

## 任务 2：导入导出和旧导出转换工具

- [ ] **步骤 1：编写 export 测试**

覆盖新 export 是 v2 envelope，import 能解密 v2；旧 v1 通过迁移函数转换后可导入。

- [ ] **步骤 2：实现 legacy-v1 只读模块和工具**

`legacy-v1.ts` 保留旧 PBKDF2/AES-GCM 解密逻辑；工具读取输入文件和密码参数，输出 v2 encrypted export。

- [ ] **步骤 3：运行 core 测试和工具 smoke test**

运行 core 测试，并用测试 fixture 生成 v2 文件后再次 import。

## 任务 3：浏览器插件 v2 会话 key

- [ ] **步骤 1：更新 app-store 测试**

保存账号后断言 `keyEncryption` 不变、`vaultEncryption.iv` 变化。

- [ ] **步骤 2：改造解锁和保存流程**

解锁时保存 `vaultKey` 到内存会话；账号保存调用 `encryptVaultWithKey`，创建/改密调用完整 wrap 流程。

- [ ] **步骤 3：改造 sync-service**

远端存在时先 decrypt remote；远端失败返回 blocking 状态；合并后采用远端 `vaultKey` 重新加密。

## 任务 4：Harmony v2 加密与同步

- [ ] **步骤 1：补 Harmony crypto service 单元级函数**

实现随机 `vaultKey`、PBKDF2 wrapping、AES-GCM wrap/unwrap。

- [ ] **步骤 2：改 LocalVaultStore**

创建本地 vault 时生成 v2 envelope；解锁后在内存保存 `vaultKey`；保存账号复用 `vaultKey`。

- [ ] **步骤 3：改 WebDAV 接入**

远端存在时采用远端 `vaultKey`；远端解不开时设置阻塞状态并提示用户。

## 任务 5：Android v2 vault、Keystore 与 WebDAV

- [ ] **步骤 1：更新 Kotlin vault 测试**

覆盖 v2 创建、解锁、`encryptWithVaultKey` 不改 `keyEncryption`、改主密码 rewrap。

- [ ] **步骤 2：改 VaultCipher / Repository**

生成随机 `vaultKey`；PBKDF2 只派生 wrapping key；本地 envelope 保存 `vaultId/keyEncryption/vaultEncryption`。

- [ ] **步骤 3：改 BiometricVaultUnlockStore**

只存 `vaultId` 和 `vaultKey`，删除 master password 持久缓存。

- [ ] **步骤 4：改 WebDavSyncService**

移除 `RemoteVaultKeyCacheStore` 使用；远端存在先解密；采用远端 key 合并；远端解不开返回 blocking。

- [ ] **步骤 5：设置页修改主密码**

加入修改主密码入口；WebDAV 开启时修改成功后立即同步；阻塞状态弹远端密码验证。

## 任务 6：全量验证、文档和提交

- [ ] **步骤 1：运行 JS 测试**

运行：`pnpm test`

- [ ] **步骤 2：运行 Android 测试和构建**

运行：`:app:testDebugUnitTest :app:assembleDebug`

- [ ] **步骤 3：更新 README**

记录 v2 格式、旧导出转换工具、旧客户端不兼容新 WebDAV 数据。

- [ ] **步骤 4：提交和推送**

提交信息：`feat: upgrade vault encryption to v2 key envelope`
