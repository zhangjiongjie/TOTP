# Android MVP 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 `apps/android-app` 中构建一个可打包、可安装、可本地使用的原生 Android TOTP MVP。

**架构：** Android 端使用 Kotlin + Jetpack Compose 原生实现，不在运行时复用 TypeScript 包。Kotlin 核心模块重写 TOTP、Base32、`otpauth://` 解析和本地 vault，加密 vault 通过主密码派生密钥并结合 Android Keystore wrapping key 保护。UI 采用单 Activity、Compose Navigation 和本地内存状态，视觉对齐 HarmonyOS 端的状态头部、柔和卡片和底部操作区。

**技术栈：** Kotlin、Jetpack Compose、Material 3、Compose Navigation、Kotlin Coroutines、Android Keystore、androidx.security-crypto、JUnit、Compose UI Test、Android CLI。

---

## 参考资料

- 规格：[docs/superpowers/specs/2026-05-17-android-mvp-design.md](../specs/2026-05-17-android-mvp-design.md)
- Android Gradle Plugin：使用 AGP `9.2.0`，对应 Gradle `9.4.1` 和 JDK `17`。
- Compose：使用 Compose BOM `2026.04.01`。
- Android CLI：使用 `android run` 安装运行 APK，使用 `android docs search` 查询 Android Knowledge Base。

## 文件结构

### 新增 Android 工程

- 创建：`apps/android-app/settings.gradle.kts`  
  独立 Android Gradle 工程设置。
- 创建：`apps/android-app/build.gradle.kts`  
  根 Gradle 插件版本和仓库配置。
- 创建：`apps/android-app/gradle.properties`  
  AndroidX、Kotlin、Compose 和 Gradle 行为开关。
- 创建：`apps/android-app/app/build.gradle.kts`  
  App 模块、依赖、测试和 Android 配置。
- 创建：`apps/android-app/app/src/main/AndroidManifest.xml`  
  单 Activity 声明。
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/MainActivity.kt`  
  Compose 入口。

### 新增测试夹具

- 修改：`packages/totp-test-fixtures/src/index.ts`  
  导出跨端 TOTP、Base32、`otpauth://` 和账号样例 fixture。
- 创建：`apps/android-app/app/src/test/java/com/totp/authenticator/fixtures/TestFixtures.kt`  
  Kotlin 端镜像 fixture，数值必须与 TypeScript fixture 一致。

### 新增 Kotlin 核心

- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/core/totp/TotpAlgorithm.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/core/totp/Base32.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/core/totp/TotpGenerator.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/core/otpauth/OtpAuthParser.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/core/account/TotpAccount.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/core/account/AccountValidator.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/core/account/AccountSorter.kt`

### 新增本地 vault

- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/data/vault/LocalVault.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/data/vault/EncryptedVaultEnvelope.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/data/vault/PasswordKeyDeriver.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/data/vault/WrappingKeyProvider.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/data/vault/AndroidKeystoreWrappingKeyProvider.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/data/vault/VaultCipher.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/data/vault/VaultEnvelopeJson.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/data/vault/VaultRepository.kt`

### 新增应用状态和 UI

- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/app/TotpApplicationState.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/app/TotpRoutes.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/app/TotpApp.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/ui/theme/Color.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/ui/theme/Theme.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/ui/unlock/UnlockScreen.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/ui/home/HomeScreen.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/ui/home/AccountCard.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/ui/editor/AccountFormState.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/ui/editor/AccountEditorScreen.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/ui/settings/SettingsScreen.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/ui/brand/BrandIconMatcher.kt`

### 修改文档

- 修改：`README.md`  
  增加 Android 端目录、命令和 MVP 范围。

## 任务 1：搭建 Android Gradle 工程

**文件：**

- 创建：`apps/android-app/settings.gradle.kts`
- 创建：`apps/android-app/build.gradle.kts`
- 创建：`apps/android-app/gradle.properties`
- 创建：`apps/android-app/app/build.gradle.kts`
- 创建：`apps/android-app/app/src/main/AndroidManifest.xml`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/MainActivity.kt`
- 创建：`apps/android-app/app/src/main/res/values/strings.xml`
- 创建：`apps/android-app/app/src/main/res/values/colors.xml`

- [ ] **步骤 1：创建最小 Android 工程文件**

`apps/android-app/settings.gradle.kts`：

```kotlin
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "TotpAndroid"
include(":app")
```

`apps/android-app/build.gradle.kts`：

```kotlin
plugins {
    id("com.android.application") version "9.2.0" apply false
    id("org.jetbrains.kotlin.android") version "2.3.20" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.3.20" apply false
}
```

`apps/android-app/gradle.properties`：

```properties
android.useAndroidX=true
android.nonTransitiveRClass=true
android.defaults.buildfeatures.buildconfig=true
kotlin.code.style=official
org.gradle.jvmargs=-Xmx4096m -Dfile.encoding=UTF-8
```

- [ ] **步骤 2：创建 App 模块配置**

`apps/android-app/app/build.gradle.kts`：

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.totp.authenticator"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.totp.authenticator"
        minSdk = 28
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        jvmToolchain(17)
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.04.01")

    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.activity:activity-compose:1.12.0")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.runtime:runtime")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.navigation:navigation-compose:2.10.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.10.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.10.0")
    implementation("androidx.security:security-crypto:1.1.0-beta01")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")

    androidTestImplementation("androidx.test.ext:junit:1.4.0")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.8.0")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
```

- [ ] **步骤 3：创建 MainActivity 和 manifest**

`apps/android-app/app/src/main/AndroidManifest.xml`：

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application
        android:allowBackup="false"
        android:dataExtractionRules="@xml/data_extraction_rules"
        android:fullBackupContent="false"
        android:icon="@drawable/app_icon"
        android:label="@string/app_name"
        android:roundIcon="@drawable/app_icon"
        android:supportsRtl="true"
        android:theme="@style/Theme.TotpAndroid">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

`apps/android-app/app/src/main/java/com/totp/authenticator/MainActivity.kt`：

```kotlin
package com.totp.authenticator

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.Text

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            Text("TOTP Authenticator")
        }
    }
}
```

Also create:

- `apps/android-app/app/src/main/res/xml/data_extraction_rules.xml` with an empty `<data-extraction-rules>` root.
- `apps/android-app/app/src/main/res/values/styles.xml` with `Theme.Material3.DayNight.NoActionBar`.
- `apps/android-app/app/src/main/res/drawable/app_icon.xml` as a simple vector icon using the app accent color.

- [ ] **步骤 4：运行构建验证**

运行：

```powershell
cd apps/android-app
gradle wrapper --gradle-version 9.4.1
.\gradlew.bat :app:assembleDebug
```

预期：`BUILD SUCCESSFUL`，生成 `apps/android-app/app/build/outputs/apk/debug/app-debug.apk`。

- [ ] **步骤 5：Commit**

```powershell
git add apps/android-app
git commit -m "feat(Android): 初始化原生应用工程"
```

## 任务 2：补齐跨端测试夹具

**文件：**

- 修改：`packages/totp-test-fixtures/src/index.ts`
- 创建：`apps/android-app/app/src/test/java/com/totp/authenticator/fixtures/TestFixtures.kt`
- 测试：`packages/totp-test-fixtures/src/index.ts`

- [ ] **步骤 1：写 TypeScript fixture 导出**

将 `packages/totp-test-fixtures/src/index.ts` 改为：

```ts
export const rfc6238Sha1Vector = {
  secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
  timestamp: 59000,
  period: 30,
  digits: 8,
  algorithm: 'SHA1',
  expected: '94287082'
} as const;

export const base32InvalidInputs = [
  'M',
  'MY===A==',
  'MZX=====',
  'MZ'
] as const;

export const otpAuthSamples = {
  issuerAndAccount:
    'otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub',
  encodedColon:
    'otpauth://totp/alice%3Awork?secret=JBSWY3DPEHPK3PXP',
  defaults:
    'otpauth://totp/alice?secret=JBSWY3DPEHPK3PXP',
  nonDecimalDigits:
    'otpauth://totp/alice?secret=JBSWY3DPEHPK3PXP&digits=1e2',
  malformedLabel:
    'otpauth://totp/%E0?secret=JBSWY3DPEHPK3PXP',
  malformedSecret:
    'otpauth://totp/alice?secret=%E0',
  malformedIssuer:
    'otpauth://totp/alice?secret=JBSWY3DPEHPK3PXP&issuer=%E0'
} as const;

export const accountFixture = {
  id: 'fixture-google-alice',
  issuer: 'Google',
  accountName: 'alice@example.com',
  secret: 'JBSWY3DPEHPK3PXP',
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
  group: 'Default',
  createdAt: 1779010000000,
  updatedAt: 1779010000000
} as const;
```

- [ ] **步骤 2：写 Kotlin fixture 镜像**

`apps/android-app/app/src/test/java/com/totp/authenticator/fixtures/TestFixtures.kt`：

```kotlin
package com.totp.authenticator.fixtures

object TestFixtures {
    val rfc6238Sha1Vector = Rfc6238Vector(
        secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
        timestampMillis = 59_000L,
        period = 30,
        digits = 8,
        algorithm = "SHA1",
        expected = "94287082"
    )

    val base32InvalidInputs = listOf("M", "MY===A==", "MZX=====", "MZ")

    object OtpAuthSamples {
        const val issuerAndAccount =
            "otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub"
        const val encodedColon =
            "otpauth://totp/alice%3Awork?secret=JBSWY3DPEHPK3PXP"
        const val defaults =
            "otpauth://totp/alice?secret=JBSWY3DPEHPK3PXP"
        const val nonDecimalDigits =
            "otpauth://totp/alice?secret=JBSWY3DPEHPK3PXP&digits=1e2"
        const val malformedLabel =
            "otpauth://totp/%E0?secret=JBSWY3DPEHPK3PXP"
        const val malformedSecret =
            "otpauth://totp/alice?secret=%E0"
        const val malformedIssuer =
            "otpauth://totp/alice?secret=JBSWY3DPEHPK3PXP&issuer=%E0"
    }
}

data class Rfc6238Vector(
    val secret: String,
    val timestampMillis: Long,
    val period: Int,
    val digits: Int,
    val algorithm: String,
    val expected: String
)
```

- [ ] **步骤 3：运行现有 TypeScript 测试**

运行：

```powershell
npm run test --workspace @totp/core
```

预期：PASS。fixture 包只导出数据，不应破坏现有测试。

- [ ] **步骤 4：Commit**

```powershell
git add packages/totp-test-fixtures/src/index.ts apps/android-app/app/src/test/java/com/totp/authenticator/fixtures/TestFixtures.kt
git commit -m "test(Android): 添加跨端 TOTP 测试夹具"
```

## 任务 3：实现 Base32 和 TOTP 核心

**文件：**

- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/core/totp/TotpAlgorithm.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/core/totp/Base32.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/core/totp/TotpGenerator.kt`
- 测试：`apps/android-app/app/src/test/java/com/totp/authenticator/core/totp/TotpGeneratorTest.kt`
- 测试：`apps/android-app/app/src/test/java/com/totp/authenticator/core/totp/Base32Test.kt`

- [ ] **步骤 1：编写失败的 Base32 测试**

`Base32Test.kt`：

```kotlin
package com.totp.authenticator.core.totp

import com.totp.authenticator.fixtures.TestFixtures
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class Base32Test {
    @Test
    fun decodesValidBase32Secret() {
        assertArrayEquals(
            byteArrayOf(72, 101, 108, 108, 111, 33),
            Base32.decode("JBSWY3DPEE======")
        )
    }

    @Test
    fun rejectsInvalidInputsFromSharedFixtures() {
        TestFixtures.base32InvalidInputs.forEach { input ->
            assertThrows(InvalidBase32Exception::class.java) {
                Base32.decode(input)
            }
        }
    }
}
```

- [ ] **步骤 2：运行 Base32 测试验证失败**

运行：

```powershell
cd apps/android-app
.\gradlew.bat :app:testDebugUnitTest --tests "com.totp.authenticator.core.totp.Base32Test"
```

预期：FAIL，报错包含 `Unresolved reference 'Base32'`。

- [ ] **步骤 3：实现 Base32**

`Base32.kt`：

```kotlin
package com.totp.authenticator.core.totp

class InvalidBase32Exception(message: String) : IllegalArgumentException(message)

object Base32 {
    private const val ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

    fun decode(input: String): ByteArray {
        val normalized = input.trim().uppercase()
        if (normalized.isEmpty()) return ByteArray(0)
        val firstPadding = normalized.indexOf('=')
        val dataPart = if (firstPadding >= 0) normalized.substring(0, firstPadding) else normalized
        val paddingPart = if (firstPadding >= 0) normalized.substring(firstPadding) else ""

        if (paddingPart.any { it != '=' }) {
            throw InvalidBase32Exception("Padding must be trailing")
        }
        if (normalized.length % 8 == 1 || normalized.length % 8 == 3 || normalized.length % 8 == 6) {
            throw InvalidBase32Exception("Invalid Base32 length")
        }
        if (paddingPart.length !in setOf(0, 1, 3, 4, 6)) {
            throw InvalidBase32Exception("Invalid Base32 padding")
        }

        var buffer = 0
        var bitsLeft = 0
        val output = ArrayList<Byte>()

        for (char in dataPart) {
            val value = ALPHABET.indexOf(char)
            if (value < 0) throw InvalidBase32Exception("Invalid Base32 character")
            buffer = (buffer shl 5) or value
            bitsLeft += 5
            if (bitsLeft >= 8) {
                output += ((buffer shr (bitsLeft - 8)) and 0xff).toByte()
                bitsLeft -= 8
            }
        }

        if (bitsLeft > 0 && (buffer and ((1 shl bitsLeft) - 1)) != 0) {
            throw InvalidBase32Exception("Non-zero trailing bits")
        }

        return output.toByteArray()
    }
}
```

- [ ] **步骤 4：运行 Base32 测试验证通过**

运行：

```powershell
cd apps/android-app
.\gradlew.bat :app:testDebugUnitTest --tests "com.totp.authenticator.core.totp.Base32Test"
```

预期：PASS。

- [ ] **步骤 5：编写失败的 TOTP 测试**

`TotpGeneratorTest.kt`：

```kotlin
package com.totp.authenticator.core.totp

import com.totp.authenticator.fixtures.TestFixtures
import org.junit.Assert.assertEquals
import org.junit.Test

class TotpGeneratorTest {
    @Test
    fun generatesRfc6238Sha1Vector() {
        val fixture = TestFixtures.rfc6238Sha1Vector

        val code = TotpGenerator.generate(
            secret = fixture.secret,
            timestampMillis = fixture.timestampMillis,
            period = fixture.period,
            digits = fixture.digits,
            algorithm = TotpAlgorithm.SHA1
        )

        assertEquals(fixture.expected, code)
    }
}
```

- [ ] **步骤 6：运行 TOTP 测试验证失败**

运行：

```powershell
cd apps/android-app
.\gradlew.bat :app:testDebugUnitTest --tests "com.totp.authenticator.core.totp.TotpGeneratorTest"
```

预期：FAIL，报错包含 `Unresolved reference 'TotpGenerator'`。

- [ ] **步骤 7：实现 TOTP**

`TotpAlgorithm.kt`：

```kotlin
package com.totp.authenticator.core.totp

enum class TotpAlgorithm(val macName: String) {
    SHA1("HmacSHA1"),
    SHA256("HmacSHA256"),
    SHA512("HmacSHA512");

    companion object {
        fun fromName(name: String): TotpAlgorithm =
            entries.firstOrNull { it.name.equals(name, ignoreCase = true) }
                ?: throw IllegalArgumentException("Unsupported TOTP algorithm: $name")
    }
}
```

`TotpGenerator.kt`：

```kotlin
package com.totp.authenticator.core.totp

import java.nio.ByteBuffer
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlin.math.pow

object TotpGenerator {
    fun generate(
        secret: String,
        timestampMillis: Long,
        period: Int,
        digits: Int,
        algorithm: TotpAlgorithm
    ): String {
        require(period > 0) { "Period must be positive" }
        require(digits in 6..8) { "Digits must be between 6 and 8" }

        val counter = timestampMillis / 1000L / period
        val key = Base32.decode(secret)
        val counterBytes = ByteBuffer.allocate(8).putLong(counter).array()
        val mac = Mac.getInstance(algorithm.macName)
        mac.init(SecretKeySpec(key, algorithm.macName))
        val hash = mac.doFinal(counterBytes)
        val offset = hash.last().toInt() and 0x0f
        val binary = ((hash[offset].toInt() and 0x7f) shl 24) or
            ((hash[offset + 1].toInt() and 0xff) shl 16) or
            ((hash[offset + 2].toInt() and 0xff) shl 8) or
            (hash[offset + 3].toInt() and 0xff)
        val modulo = 10.0.pow(digits).toInt()
        return (binary % modulo).toString().padStart(digits, '0')
    }
}
```

- [ ] **步骤 8：运行核心测试验证通过**

运行：

```powershell
cd apps/android-app
.\gradlew.bat :app:testDebugUnitTest --tests "com.totp.authenticator.core.totp.*"
```

预期：PASS。

- [ ] **步骤 9：Commit**

```powershell
git add apps/android-app/app/src/main/java/com/totp/authenticator/core/totp apps/android-app/app/src/test/java/com/totp/authenticator/core/totp
git commit -m "feat(Android): 实现 TOTP 核心算法"
```

## 任务 4：实现 `otpauth://` 解析和账号校验

**文件：**

- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/core/otpauth/OtpAuthParser.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/core/account/TotpAccount.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/core/account/AccountValidator.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/core/account/AccountSorter.kt`
- 测试：`apps/android-app/app/src/test/java/com/totp/authenticator/core/otpauth/OtpAuthParserTest.kt`
- 测试：`apps/android-app/app/src/test/java/com/totp/authenticator/core/account/AccountValidatorTest.kt`

- [ ] **步骤 1：编写失败的 parser 测试**

`OtpAuthParserTest.kt`：

```kotlin
package com.totp.authenticator.core.otpauth

import com.totp.authenticator.core.totp.TotpAlgorithm
import com.totp.authenticator.fixtures.TestFixtures
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class OtpAuthParserTest {
    @Test
    fun parsesIssuerAndAccountName() {
        val parsed = OtpAuthParser.parse(TestFixtures.OtpAuthSamples.issuerAndAccount)

        assertEquals("GitHub", parsed.issuer)
        assertEquals("alice", parsed.accountName)
        assertEquals("JBSWY3DPEHPK3PXP", parsed.secret)
    }

    @Test
    fun keepsEncodedColonInsideAccountName() {
        val parsed = OtpAuthParser.parse(TestFixtures.OtpAuthSamples.encodedColon)

        assertEquals("", parsed.issuer)
        assertEquals("alice:work", parsed.accountName)
    }

    @Test
    fun usesDefaultParameters() {
        val parsed = OtpAuthParser.parse(TestFixtures.OtpAuthSamples.defaults)

        assertEquals(6, parsed.digits)
        assertEquals(30, parsed.period)
        assertEquals(TotpAlgorithm.SHA1, parsed.algorithm)
    }

    @Test
    fun rejectsInvalidUris() {
        listOf(
            TestFixtures.OtpAuthSamples.nonDecimalDigits,
            TestFixtures.OtpAuthSamples.malformedLabel,
            TestFixtures.OtpAuthSamples.malformedSecret,
            TestFixtures.OtpAuthSamples.malformedIssuer
        ).forEach { uri ->
            assertThrows(InvalidOtpAuthUriException::class.java) {
                OtpAuthParser.parse(uri)
            }
        }
    }
}
```

- [ ] **步骤 2：运行 parser 测试验证失败**

运行：

```powershell
cd apps/android-app
.\gradlew.bat :app:testDebugUnitTest --tests "com.totp.authenticator.core.otpauth.OtpAuthParserTest"
```

预期：FAIL，报错包含 `Unresolved reference 'OtpAuthParser'`。

- [ ] **步骤 3：实现 parser 和账号模型**

`TotpAccount.kt`：

```kotlin
package com.totp.authenticator.core.account

import com.totp.authenticator.core.totp.TotpAlgorithm

data class TotpAccount(
    val id: String,
    val issuer: String,
    val accountName: String,
    val secret: String,
    val algorithm: TotpAlgorithm = TotpAlgorithm.SHA1,
    val digits: Int = 6,
    val period: Int = 30,
    val group: String = "Default",
    val createdAt: Long,
    val updatedAt: Long
)
```

`OtpAuthParser.kt`：

```kotlin
package com.totp.authenticator.core.otpauth

import com.totp.authenticator.core.totp.TotpAlgorithm
import java.net.URI
import java.net.URLDecoder

class InvalidOtpAuthUriException(message: String) : IllegalArgumentException(message)

data class ParsedOtpAuth(
    val issuer: String,
    val accountName: String,
    val secret: String,
    val algorithm: TotpAlgorithm,
    val digits: Int,
    val period: Int
)

object OtpAuthParser {
    fun parse(rawUri: String): ParsedOtpAuth {
        val uri = try {
            URI(rawUri)
        } catch (error: Throwable) {
            throw InvalidOtpAuthUriException("Malformed otpauth URI")
        }

        if (uri.scheme != "otpauth" || uri.host != "totp") {
            throw InvalidOtpAuthUriException("Only otpauth://totp URIs are supported")
        }

        val query = parseQuery(uri.rawQuery.orEmpty())
        val label = decode(uri.rawPath?.trimStart('/').orEmpty(), "label")
        val issuerFromQuery = query["issuer"]?.let { decode(it, "issuer") }.orEmpty()
        val labelParts = label.split(":", limit = 2)
        val issuerFromLabel = if (labelParts.size == 2) labelParts[0] else ""
        val accountName = if (labelParts.size == 2) labelParts[1] else label
        val secret = query["secret"]?.let { decode(it, "secret") }
            ?: throw InvalidOtpAuthUriException("Missing secret")
        val digits = parsePositiveInt(query["digits"], 6, "digits")
        val period = parsePositiveInt(query["period"], 30, "period")
        val algorithm = TotpAlgorithm.fromName(query["algorithm"] ?: "SHA1")

        return ParsedOtpAuth(
            issuer = issuerFromQuery.ifBlank { issuerFromLabel },
            accountName = accountName,
            secret = secret,
            algorithm = algorithm,
            digits = digits,
            period = period
        )
    }

    private fun parsePositiveInt(value: String?, defaultValue: Int, field: String): Int {
        if (value == null) return defaultValue
        if (!value.all(Char::isDigit)) throw InvalidOtpAuthUriException("Invalid $field")
        return value.toInt()
    }

    private fun parseQuery(rawQuery: String): Map<String, String> {
        if (rawQuery.isBlank()) return emptyMap()
        return rawQuery.split("&").associate { pair ->
            val parts = pair.split("=", limit = 2)
            parts[0] to parts.getOrElse(1) { "" }
        }
    }

    private fun decode(value: String, field: String): String =
        try {
            URLDecoder.decode(value, Charsets.UTF_8)
        } catch (error: Throwable) {
            throw InvalidOtpAuthUriException("Malformed $field")
        }
}
```

- [ ] **步骤 4：运行 parser 测试验证通过**

运行：

```powershell
cd apps/android-app
.\gradlew.bat :app:testDebugUnitTest --tests "com.totp.authenticator.core.otpauth.OtpAuthParserTest"
```

预期：PASS。

- [ ] **步骤 5：编写账号校验测试**

`AccountValidatorTest.kt`：

```kotlin
package com.totp.authenticator.core.account

import com.totp.authenticator.core.totp.TotpAlgorithm
import org.junit.Assert.assertTrue
import org.junit.Assert.assertFalse
import org.junit.Test

class AccountValidatorTest {
    @Test
    fun acceptsValidAccount() {
        val result = AccountValidator.validate(
            issuer = "GitHub",
            accountName = "alice",
            secret = "JBSWY3DPEHPK3PXP",
            digits = 6,
            period = 30,
            algorithm = TotpAlgorithm.SHA1,
            group = "Default"
        )

        assertTrue(result.isValid)
    }

    @Test
    fun rejectsMissingRequiredFields() {
        val result = AccountValidator.validate(
            issuer = "",
            accountName = "",
            secret = "",
            digits = 6,
            period = 30,
            algorithm = TotpAlgorithm.SHA1,
            group = "Default"
        )

        assertFalse(result.isValid)
        assertTrue(result.errors.contains("Issuer is required"))
        assertTrue(result.errors.contains("Account is required"))
        assertTrue(result.errors.contains("Secret is required"))
    }
}
```

- [ ] **步骤 6：实现账号校验和排序**

`AccountValidator.kt`：

```kotlin
package com.totp.authenticator.core.account

import com.totp.authenticator.core.totp.Base32
import com.totp.authenticator.core.totp.TotpAlgorithm

data class AccountValidationResult(
    val isValid: Boolean,
    val errors: List<String>
)

object AccountValidator {
    fun validate(
        issuer: String,
        accountName: String,
        secret: String,
        digits: Int,
        period: Int,
        algorithm: TotpAlgorithm,
        group: String
    ): AccountValidationResult {
        val errors = mutableListOf<String>()
        if (issuer.isBlank()) errors += "Issuer is required"
        if (accountName.isBlank()) errors += "Account is required"
        if (secret.isBlank()) {
            errors += "Secret is required"
        } else {
            runCatching { Base32.decode(secret) }
                .onFailure { errors += "Secret must be valid Base32" }
        }
        if (digits !in 6..8) errors += "Digits must be between 6 and 8"
        if (period <= 0) errors += "Period must be positive"
        if (group.isBlank()) errors += "Group is required"
        algorithm.name.ifBlank { errors += "Algorithm is required" }

        return AccountValidationResult(errors.isEmpty(), errors)
    }
}
```

`AccountSorter.kt`：

```kotlin
package com.totp.authenticator.core.account

object AccountSorter {
    fun sort(accounts: List<TotpAccount>): List<TotpAccount> =
        accounts.sortedWith(compareBy<TotpAccount> { it.group.lowercase() }
            .thenBy { it.issuer.lowercase() }
            .thenBy { it.accountName.lowercase() })
}
```

- [ ] **步骤 7：运行账号测试验证通过**

运行：

```powershell
cd apps/android-app
.\gradlew.bat :app:testDebugUnitTest --tests "com.totp.authenticator.core.account.*"
```

预期：PASS。

- [ ] **步骤 8：Commit**

```powershell
git add apps/android-app/app/src/main/java/com/totp/authenticator/core apps/android-app/app/src/test/java/com/totp/authenticator/core
git commit -m "feat(Android): 实现 otpauth 解析和账号校验"
```

## 任务 5：实现本地 vault 加密和持久化

**文件：**

- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/data/vault/LocalVault.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/data/vault/EncryptedVaultEnvelope.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/data/vault/PasswordKeyDeriver.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/data/vault/WrappingKeyProvider.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/data/vault/AndroidKeystoreWrappingKeyProvider.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/data/vault/VaultCipher.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/data/vault/VaultEnvelopeJson.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/data/vault/VaultRepository.kt`
- 测试：`apps/android-app/app/src/test/java/com/totp/authenticator/data/vault/VaultCipherTest.kt`

- [ ] **步骤 1：编写失败的 vault 加密测试**

`VaultCipherTest.kt`：

```kotlin
package com.totp.authenticator.data.vault

import com.totp.authenticator.core.account.TotpAccount
import com.totp.authenticator.core.totp.TotpAlgorithm
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import javax.crypto.SecretKey

class VaultCipherTest {
    private val wrappingKeyProvider = object : WrappingKeyProvider {
        override fun getOrCreateWrappingKey(): SecretKeySpec =
            SecretKeySpec(ByteArray(32) { 7 }, "AES")
    }

    @Test
    fun encryptsAndDecryptsVaultWithPassword() {
        val vault = LocalVault(
            schemaVersion = 1,
            accounts = listOf(sampleAccount()),
            updatedAt = 1779010000000
        )
        val cipher = VaultCipher(wrappingKeyProvider)

        val envelope = cipher.encrypt(vault, "correct horse battery staple")
        val decrypted = cipher.decrypt(envelope, "correct horse battery staple")

        assertEquals(vault, decrypted)
    }

    @Test
    fun rejectsWrongPassword() {
        val cipher = VaultCipher(wrappingKeyProvider)
        val envelope = cipher.encrypt(
            LocalVault(1, listOf(sampleAccount()), 1779010000000),
            "correct password"
        )

        assertThrows(VaultDecryptException::class.java) {
            cipher.decrypt(envelope, "wrong password")
        }
    }

    private fun sampleAccount(): TotpAccount =
        TotpAccount(
            id = "fixture-google-alice",
            issuer = "Google",
            accountName = "alice@example.com",
            secret = "JBSWY3DPEHPK3PXP",
            algorithm = TotpAlgorithm.SHA1,
            digits = 6,
            period = 30,
            group = "Default",
            createdAt = 1779010000000,
            updatedAt = 1779010000000
        )
}
```

- [ ] **步骤 2：运行 vault 测试验证失败**

运行：

```powershell
cd apps/android-app
.\gradlew.bat :app:testDebugUnitTest --tests "com.totp.authenticator.data.vault.VaultCipherTest"
```

预期：FAIL，报错包含 `Unresolved reference 'VaultCipher'`。

- [ ] **步骤 3：实现 vault 模型和 key 派生**

`LocalVault.kt`：

```kotlin
package com.totp.authenticator.data.vault

import com.totp.authenticator.core.account.TotpAccount

data class LocalVault(
    val schemaVersion: Int,
    val accounts: List<TotpAccount>,
    val updatedAt: Long
)
```

`EncryptedVaultEnvelope.kt`：

```kotlin
package com.totp.authenticator.data.vault

data class EncryptedVaultEnvelope(
    val schemaVersion: Int,
    val kdf: String,
    val salt: String,
    val nonce: String,
    val wrappedKeyNonce: String,
    val wrappedVaultKey: String,
    val ciphertext: String,
    val updatedAt: Long
)
```

`PasswordKeyDeriver.kt`：

```kotlin
package com.totp.authenticator.data.vault

import java.security.SecureRandom
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

object PasswordKeyDeriver {
    private const val ITERATIONS = 210_000
    private const val KEY_BITS = 256

    fun newSalt(): ByteArray = ByteArray(16).also { SecureRandom().nextBytes(it) }

    fun derive(password: String, salt: ByteArray): SecretKeySpec {
        val spec = PBEKeySpec(password.toCharArray(), salt, ITERATIONS, KEY_BITS)
        val bytes = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
            .generateSecret(spec)
            .encoded
        return SecretKeySpec(bytes, "AES")
    }

    fun kdfLabel(): String = "PBKDF2WithHmacSHA256:$ITERATIONS:$KEY_BITS"
}
```

- [ ] **步骤 4：实现 wrapping key provider 和 cipher**

`WrappingKeyProvider.kt`：

```kotlin
package com.totp.authenticator.data.vault

import javax.crypto.spec.SecretKeySpec

interface WrappingKeyProvider {
    fun getOrCreateWrappingKey(): SecretKey
}
```

`AndroidKeystoreWrappingKeyProvider.kt`：

```kotlin
package com.totp.authenticator.data.vault

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

class AndroidKeystoreWrappingKeyProvider(
    private val alias: String = "totp_vault_wrapping_key"
) : WrappingKeyProvider {
    override fun getOrCreateWrappingKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = keyStore.getKey(alias, null) as? SecretKey
        if (existing != null) return existing

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        val spec = KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build()
        generator.init(spec)
        return generator.generateKey()
    }
}
```

`VaultCipher.kt`：

```kotlin
package com.totp.authenticator.data.vault

import android.util.Base64
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec

class VaultDecryptException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)

class VaultCipher(private val wrappingKeyProvider: WrappingKeyProvider) {
    fun encrypt(vault: LocalVault, password: String): EncryptedVaultEnvelope {
        val salt = PasswordKeyDeriver.newSalt()
        val passwordKey = PasswordKeyDeriver.derive(password, salt)
        val vaultJson = VaultEnvelopeJson.encodeVault(vault).toByteArray(Charsets.UTF_8)
        val vaultNonce = randomNonce()
        val ciphertext = aesGcmEncrypt(passwordKey, vaultNonce, vaultJson)

        val wrappedKeyNonce = randomNonce()
        val wrappedVaultKey = aesGcmEncrypt(
            wrappingKeyProvider.getOrCreateWrappingKey(),
            wrappedKeyNonce,
            passwordKey.encoded
        )

        return EncryptedVaultEnvelope(
            schemaVersion = 1,
            kdf = PasswordKeyDeriver.kdfLabel(),
            salt = b64(salt),
            nonce = b64(vaultNonce),
            wrappedKeyNonce = b64(wrappedKeyNonce),
            wrappedVaultKey = b64(wrappedVaultKey),
            ciphertext = b64(ciphertext),
            updatedAt = vault.updatedAt
        )
    }

    fun decrypt(envelope: EncryptedVaultEnvelope, password: String): LocalVault =
        try {
            val passwordKey = PasswordKeyDeriver.derive(password, fromB64(envelope.salt))
            val plaintext = aesGcmDecrypt(
                passwordKey,
                fromB64(envelope.nonce),
                fromB64(envelope.ciphertext)
            )
            VaultEnvelopeJson.decodeVault(String(plaintext, Charsets.UTF_8))
        } catch (error: Throwable) {
            throw VaultDecryptException("Unable to decrypt vault", error)
        }

    private fun aesGcmEncrypt(key: javax.crypto.SecretKey, nonce: ByteArray, data: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(128, nonce))
        return cipher.doFinal(data)
    }

    private fun aesGcmDecrypt(key: javax.crypto.SecretKey, nonce: ByteArray, data: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, nonce))
        return cipher.doFinal(data)
    }

    private fun randomNonce(): ByteArray = ByteArray(12).also { SecureRandom().nextBytes(it) }
    private fun b64(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)
    private fun fromB64(value: String): ByteArray = Base64.decode(value, Base64.NO_WRAP)
}
```

- [ ] **步骤 5：实现 JSON 编解码和 repository**

Use `kotlinx.serialization`; add `id("org.jetbrains.kotlin.plugin.serialization") version "2.3.20" apply false` to `apps/android-app/build.gradle.kts`, apply it in `app/build.gradle.kts`, and add `@Serializable` to model DTOs used by `VaultEnvelopeJson`.

`VaultRepository.kt`:

```kotlin
package com.totp.authenticator.data.vault

import android.content.Context

class VaultRepository(
    context: Context,
    private val vaultCipher: VaultCipher = VaultCipher(AndroidKeystoreWrappingKeyProvider())
) {
    private val preferences = context.getSharedPreferences("totp_vault", Context.MODE_PRIVATE)

    fun hasVault(): Boolean = preferences.contains("encrypted_vault")

    fun create(password: String, nowMillis: Long): LocalVault {
        val vault = LocalVault(schemaVersion = 1, accounts = emptyList(), updatedAt = nowMillis)
        save(vault, password)
        return vault
    }

    fun unlock(password: String): LocalVault {
        val json = preferences.getString("encrypted_vault", null)
            ?: throw VaultDecryptException("Vault does not exist")
        return vaultCipher.decrypt(VaultEnvelopeJson.decodeEnvelope(json), password)
    }

    fun save(vault: LocalVault, password: String) {
        val envelope = vaultCipher.encrypt(vault, password)
        preferences.edit()
            .putString("encrypted_vault", VaultEnvelopeJson.encodeEnvelope(envelope))
            .apply()
    }

    fun clear() {
        preferences.edit().clear().apply()
    }
}
```

- [ ] **步骤 6：运行 vault 测试验证通过**

运行：

```powershell
cd apps/android-app
.\gradlew.bat :app:testDebugUnitTest --tests "com.totp.authenticator.data.vault.VaultCipherTest"
```

预期：PASS。

- [ ] **步骤 7：Commit**

```powershell
git add apps/android-app/app/build.gradle.kts apps/android-app/build.gradle.kts apps/android-app/app/src/main/java/com/totp/authenticator/data/vault apps/android-app/app/src/test/java/com/totp/authenticator/data/vault
git commit -m "feat(Android): 实现本地加密 vault"
```

## 任务 6：实现应用状态、导航和解锁页面

**文件：**

- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/app/TotpRoutes.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/app/TotpApplicationState.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/app/TotpApp.kt`
- 修改：`apps/android-app/app/src/main/java/com/totp/authenticator/MainActivity.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/ui/theme/Color.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/ui/theme/Theme.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/ui/unlock/UnlockScreen.kt`
- 测试：`apps/android-app/app/src/test/java/com/totp/authenticator/app/TotpApplicationStateTest.kt`

- [ ] **步骤 1：编写失败的应用状态测试**

`TotpApplicationStateTest.kt`：

```kotlin
package com.totp.authenticator.app

import com.totp.authenticator.data.vault.LocalVault
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TotpApplicationStateTest {
    @Test
    fun startsLockedWhenVaultExists() {
        val state = TotpApplicationState(hasExistingVault = true)

        assertEquals(TotpRoute.Unlock, state.currentRoute)
        assertFalse(state.isUnlocked)
    }

    @Test
    fun unlockStoresVaultInMemory() {
        val state = TotpApplicationState(hasExistingVault = true)
        val vault = LocalVault(schemaVersion = 1, accounts = emptyList(), updatedAt = 1L)

        state.applyUnlockedVault(vault, password = "pw")

        assertTrue(state.isUnlocked)
        assertEquals(TotpRoute.Home, state.currentRoute)
        assertEquals(vault, state.vault)
    }
}
```

- [ ] **步骤 2：实现 route 和应用状态**

`TotpRoutes.kt`：

```kotlin
package com.totp.authenticator.app

sealed interface TotpRoute {
    data object Unlock : TotpRoute
    data object Home : TotpRoute
    data object Add : TotpRoute
    data class Edit(val accountId: String) : TotpRoute
    data object Settings : TotpRoute
}
```

`TotpApplicationState.kt`：

```kotlin
package com.totp.authenticator.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.totp.authenticator.data.vault.LocalVault

class TotpApplicationState(hasExistingVault: Boolean) {
    var currentRoute: TotpRoute by mutableStateOf(TotpRoute.Unlock)
        private set
    var isUnlocked: Boolean by mutableStateOf(false)
        private set
    var vault: LocalVault? by mutableStateOf(null)
        private set
    var activePassword: String? = null
        private set

    init {
        currentRoute = TotpRoute.Unlock
        isUnlocked = !hasExistingVault
    }

    fun applyUnlockedVault(vault: LocalVault, password: String) {
        this.vault = vault
        activePassword = password
        isUnlocked = true
        currentRoute = TotpRoute.Home
    }

    fun navigate(route: TotpRoute) {
        currentRoute = route
    }

    fun lock() {
        vault = null
        activePassword = null
        isUnlocked = false
        currentRoute = TotpRoute.Unlock
    }
}
```

- [ ] **步骤 3：运行应用状态测试验证通过**

运行：

```powershell
cd apps/android-app
.\gradlew.bat :app:testDebugUnitTest --tests "com.totp.authenticator.app.TotpApplicationStateTest"
```

预期：PASS。

- [ ] **步骤 4：实现 Theme、TotpApp 和 UnlockScreen**

`UnlockScreen.kt` should expose:

```kotlin
@Composable
fun UnlockScreen(
    hasExistingVault: Boolean,
    errorMessage: String?,
    onCreatePassword: (String) -> Unit,
    onUnlock: (String) -> Unit
)
```

It must render:

- App title `TOTP Authenticator`。
- `Password` input。
- `Confirm password` input only when `hasExistingVault == false`。
- Primary button text `Create vault` or `Unlock`。
- Error text when passwords do not match or callback returns an error.

`TotpApp.kt` should own `VaultRepository`, call `repository.hasVault()`, and route to `UnlockScreen` first. `MainActivity.kt` should change to:

```kotlin
setContent {
    TotpTheme {
        TotpApp()
    }
}
```

- [ ] **步骤 5：运行构建验证**

运行：

```powershell
cd apps/android-app
.\gradlew.bat :app:assembleDebug
```

预期：PASS，APK 启动后显示解锁页。

- [ ] **步骤 6：Commit**

```powershell
git add apps/android-app/app/src/main/java/com/totp/authenticator/app apps/android-app/app/src/main/java/com/totp/authenticator/ui apps/android-app/app/src/main/java/com/totp/authenticator/MainActivity.kt apps/android-app/app/src/test/java/com/totp/authenticator/app
git commit -m "feat(Android): 添加解锁流程和应用状态"
```

## 任务 7：实现账号编辑流程

**文件：**

- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/ui/editor/AccountFormState.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/ui/editor/AccountEditorScreen.kt`
- 修改：`apps/android-app/app/src/main/java/com/totp/authenticator/app/TotpApp.kt`
- 测试：`apps/android-app/app/src/test/java/com/totp/authenticator/ui/editor/AccountFormStateTest.kt`

- [ ] **步骤 1：编写失败的表单状态测试**

`AccountFormStateTest.kt`：

```kotlin
package com.totp.authenticator.ui.editor

import com.totp.authenticator.core.totp.TotpAlgorithm
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AccountFormStateTest {
    @Test
    fun fillsFromOtpAuthUri() {
        val state = AccountFormState()

        val result = state.applyOtpAuthUri(
            "otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub"
        )

        assertTrue(result)
        assertEquals("GitHub", state.issuer)
        assertEquals("alice", state.accountName)
        assertEquals("JBSWY3DPEHPK3PXP", state.secret)
        assertEquals(TotpAlgorithm.SHA1, state.algorithm)
    }
}
```

- [ ] **步骤 2：实现 AccountFormState**

`AccountFormState.kt`：

```kotlin
package com.totp.authenticator.ui.editor

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.totp.authenticator.core.account.AccountValidator
import com.totp.authenticator.core.account.TotpAccount
import com.totp.authenticator.core.otpauth.OtpAuthParser
import com.totp.authenticator.core.totp.TotpAlgorithm
import java.util.UUID

class AccountFormState(account: TotpAccount? = null) {
    var issuer by mutableStateOf(account?.issuer.orEmpty())
    var accountName by mutableStateOf(account?.accountName.orEmpty())
    var secret by mutableStateOf(account?.secret.orEmpty())
    var digits by mutableStateOf(account?.digits?.toString() ?: "6")
    var period by mutableStateOf(account?.period?.toString() ?: "30")
    var algorithm by mutableStateOf(account?.algorithm ?: TotpAlgorithm.SHA1)
    var group by mutableStateOf(account?.group ?: "Default")
    var errors by mutableStateOf(emptyList<String>())

    fun applyOtpAuthUri(uri: String): Boolean =
        runCatching {
            val parsed = OtpAuthParser.parse(uri)
            issuer = parsed.issuer
            accountName = parsed.accountName
            secret = parsed.secret
            digits = parsed.digits.toString()
            period = parsed.period.toString()
            algorithm = parsed.algorithm
            true
        }.getOrElse {
            errors = listOf("Invalid otpauth URI")
            false
        }

    fun toAccount(existing: TotpAccount?, nowMillis: Long): TotpAccount? {
        val digitsInt = digits.toIntOrNull() ?: -1
        val periodInt = period.toIntOrNull() ?: -1
        val result = AccountValidator.validate(
            issuer, accountName, secret, digitsInt, periodInt, algorithm, group
        )
        errors = result.errors
        if (!result.isValid) return null

        return TotpAccount(
            id = existing?.id ?: UUID.randomUUID().toString(),
            issuer = issuer.trim(),
            accountName = accountName.trim(),
            secret = secret.trim(),
            algorithm = algorithm,
            digits = digitsInt,
            period = periodInt,
            group = group.trim(),
            createdAt = existing?.createdAt ?: nowMillis,
            updatedAt = nowMillis
        )
    }
}
```

- [ ] **步骤 3：运行表单测试验证通过**

运行：

```powershell
cd apps/android-app
.\gradlew.bat :app:testDebugUnitTest --tests "com.totp.authenticator.ui.editor.AccountFormStateTest"
```

预期：PASS。

- [ ] **步骤 4：实现 AccountEditorScreen**

`AccountEditorScreen.kt` should expose:

```kotlin
@Composable
fun AccountEditorScreen(
    title: String,
    existingAccount: TotpAccount?,
    onSave: (TotpAccount) -> Unit,
    onDelete: ((String) -> Unit)?,
    onBack: () -> Unit
)
```

Screen requirements:

- Text fields for issuer, account, secret, digits, period, group。
- Segmented or dropdown choice for SHA1、SHA256、SHA512。
- Paste URI field/button that calls `AccountFormState.applyOtpAuthUri`。
- Save button calls `toAccount` and `onSave`。
- Delete button appears only when `existingAccount != null` and asks for confirmation in an AlertDialog。

- [ ] **步骤 5：接入 Add/Edit 路由**

Modify `TotpApp.kt` so:

- Bottom action `Add` navigates to `TotpRoute.Add`。
- `TotpRoute.Add` renders `AccountEditorScreen(title = "Add account", existingAccount = null, ...)`。
- Save appends account to `state.vault.accounts` and calls `VaultRepository.save(vault, activePassword)`。
- Edit route finds account by ID and replaces it on save。
- Delete removes account by ID and saves vault。

- [ ] **步骤 6：运行构建验证**

运行：

```powershell
cd apps/android-app
.\gradlew.bat :app:assembleDebug
```

预期：PASS。

- [ ] **步骤 7：Commit**

```powershell
git add apps/android-app/app/src/main/java/com/totp/authenticator/ui/editor apps/android-app/app/src/main/java/com/totp/authenticator/app/TotpApp.kt apps/android-app/app/src/test/java/com/totp/authenticator/ui/editor
git commit -m "feat(Android): 添加账号编辑流程"
```

## 任务 8：实现首页、品牌图标和设置页

**文件：**

- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/ui/home/HomeScreen.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/ui/home/AccountCard.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/ui/settings/SettingsScreen.kt`
- 创建：`apps/android-app/app/src/main/java/com/totp/authenticator/ui/brand/BrandIconMatcher.kt`
- 修改：`apps/android-app/app/src/main/java/com/totp/authenticator/app/TotpApp.kt`
- 测试：`apps/android-app/app/src/test/java/com/totp/authenticator/ui/brand/BrandIconMatcherTest.kt`

- [ ] **步骤 1：编写失败的品牌匹配测试**

`BrandIconMatcherTest.kt`：

```kotlin
package com.totp.authenticator.ui.brand

import org.junit.Assert.assertEquals
import org.junit.Test

class BrandIconMatcherTest {
    @Test
    fun matchesKnownIssuers() {
        assertEquals(BrandIcon.Google, BrandIconMatcher.match("Google"))
        assertEquals(BrandIcon.GitHub, BrandIconMatcher.match("github"))
    }

    @Test
    fun fallsBackToDefault() {
        assertEquals(BrandIcon.Default, BrandIconMatcher.match("Unknown Service"))
    }
}
```

- [ ] **步骤 2：实现品牌匹配**

`BrandIconMatcher.kt`：

```kotlin
package com.totp.authenticator.ui.brand

enum class BrandIcon {
    Amazon,
    Apple,
    GitHub,
    Google,
    Microsoft,
    OpenAI,
    Default
}

object BrandIconMatcher {
    fun match(issuer: String): BrandIcon {
        val normalized = issuer.lowercase()
        return when {
            "amazon" in normalized -> BrandIcon.Amazon
            "apple" in normalized -> BrandIcon.Apple
            "github" in normalized -> BrandIcon.GitHub
            "google" in normalized -> BrandIcon.Google
            "microsoft" in normalized -> BrandIcon.Microsoft
            "openai" in normalized -> BrandIcon.OpenAI
            else -> BrandIcon.Default
        }
    }
}
```

- [ ] **步骤 3：运行品牌测试验证通过**

运行：

```powershell
cd apps/android-app
.\gradlew.bat :app:testDebugUnitTest --tests "com.totp.authenticator.ui.brand.BrandIconMatcherTest"
```

预期：PASS。

- [ ] **步骤 4：实现 AccountCard 和 HomeScreen**

`AccountCard.kt` should expose:

```kotlin
@Composable
fun AccountCard(
    account: TotpAccount,
    code: String,
    secondsRemaining: Int,
    onCopy: (String) -> Unit,
    onEdit: (String) -> Unit
)
```

Requirements:

- Brand icon area uses `BrandIconMatcher.match(account.issuer)`。
- Code uses large monospace text and inserts a visual space for 6-digit codes。
- Clicking code calls `onCopy(code)`。
- Edit icon calls `onEdit(account.id)`。

`HomeScreen.kt` should expose:

```kotlin
@Composable
fun HomeScreen(
    vault: LocalVault,
    nowMillis: Long,
    onAdd: () -> Unit,
    onEdit: (String) -> Unit,
    onSettings: () -> Unit,
    onCopy: (String) -> Unit
)
```

It must:

- Sort accounts with `AccountSorter.sort`。
- Generate codes with `TotpGenerator.generate`。
- Calculate seconds remaining as `period - ((nowMillis / 1000) % period)`。
- Show empty state when account list is empty。
- Show bottom action area with Home、Add、Settings labels/icons。

- [ ] **步骤 5：实现 SettingsScreen**

`SettingsScreen.kt` should expose:

```kotlin
@Composable
fun SettingsScreen(
    accountCount: Int,
    onClearVault: () -> Unit,
    onLock: () -> Unit,
    onBack: () -> Unit
)
```

Requirements:

- Show `Local vault unlocked`。
- Show account count。
- Show disabled entries for WebDAV、Import / Export、Biometric unlock with text `Available in a later version`。
- Clear vault requires AlertDialog confirmation and calls `onClearVault`。
- Lock calls `onLock`。

- [ ] **步骤 6：接入定时刷新和复制**

Modify `TotpApp.kt`:

- Use `LaunchedEffect(Unit)` with `while (true) { nowMillis = System.currentTimeMillis(); delay(1000) }`。
- Use Android `ClipboardManager` in `onCopy`。
- Route `TotpRoute.Home` to `HomeScreen`。
- Route `TotpRoute.Settings` to `SettingsScreen`。
- Clear vault calls `VaultRepository.clear()` and `state.lock()`。

- [ ] **步骤 7：运行构建验证**

运行：

```powershell
cd apps/android-app
.\gradlew.bat :app:assembleDebug
```

预期：PASS。

- [ ] **步骤 8：Commit**

```powershell
git add apps/android-app/app/src/main/java/com/totp/authenticator/ui/home apps/android-app/app/src/main/java/com/totp/authenticator/ui/settings apps/android-app/app/src/main/java/com/totp/authenticator/ui/brand apps/android-app/app/src/main/java/com/totp/authenticator/app/TotpApp.kt apps/android-app/app/src/test/java/com/totp/authenticator/ui/brand
git commit -m "feat(Android): 实现首页和设置页"
```

## 任务 9：添加 APK 运行验证和 README

**文件：**

- 修改：`README.md`
- 创建：`apps/android-app/README.md`
- 测试：Android CLI / Gradle 命令

- [ ] **步骤 1：更新根 README**

在 `README.md` 的工程结构中加入：

```text
│   ├── android-app/                 # Android 原生应用
```

在客户端说明中加入 Android 端：

```markdown
## Android 应用

目录：`apps/android-app`

技术栈：

- Kotlin
- Jetpack Compose
- Material 3
- Android Keystore

第一阶段能力：

- 主密码创建和解锁。
- 本地加密保管库。
- 账号添加、编辑、删除。
- TOTP 验证码和倒计时。
- `otpauth://` 链接粘贴解析。

常用命令：

```powershell
cd apps/android-app
.\gradlew.bat :app:testDebugUnitTest
.\gradlew.bat :app:assembleDebug
android run --apks .\app\build\outputs\apk\debug\app-debug.apk
```
```

- [ ] **步骤 2：创建 Android 子工程 README**

`apps/android-app/README.md`：

```markdown
# Android 应用

这是 `TOTP` 的原生 Android 客户端，第一阶段聚焦本地可用 MVP。

## 命令

```powershell
.\gradlew.bat :app:testDebugUnitTest
.\gradlew.bat :app:assembleDebug
android run --apks .\app\build\outputs\apk\debug\app-debug.apk
```

## 范围

已覆盖：

- 主密码创建和解锁。
- 本地加密 vault。
- 添加、编辑、删除账号。
- TOTP 生成和复制。

未覆盖：

- WebDAV 同步。
- 扫码和图片识别。
- 导入导出。
- 生物识别快捷解锁。
```

- [ ] **步骤 3：运行全量 Android 单测**

运行：

```powershell
cd apps/android-app
.\gradlew.bat :app:testDebugUnitTest
```

预期：PASS。

- [ ] **步骤 4：构建 debug APK**

运行：

```powershell
cd apps/android-app
.\gradlew.bat :app:assembleDebug
```

预期：PASS，APK 位于 `apps/android-app/app/build/outputs/apk/debug/app-debug.apk`。

- [ ] **步骤 5：用 Android CLI 安装运行**

运行：

```powershell
cd apps/android-app
android run --apks .\app\build\outputs\apk\debug\app-debug.apk
```

预期：模拟器或连接设备启动 `TOTP Authenticator`。如果没有设备，记录 `android run` 的设备缺失错误，不把它当作构建失败。

- [ ] **步骤 6：手动验收 MVP 流程**

在模拟器或真机上执行：

1. 首次打开，创建主密码 `TestPassword123!`。
2. 进入首页，看到空状态。
3. 添加账号，粘贴 `otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub`。
4. 保存后首页显示 GitHub 账号和 6 位验证码。
5. 点击验证码，确认复制提示。
6. 编辑账号，把分组改为 `Work`。
7. 返回首页，确认分组显示为 `Work`。
8. 关闭应用并重新打开，输入主密码，确认账号恢复。
9. 进入设置，清空本地数据，确认回到首次创建主密码状态。

- [ ] **步骤 7：Commit**

```powershell
git add README.md apps/android-app/README.md
git commit -m "docs(Android): 补充应用运行说明"
```

## 任务 10：最终验证

**文件：**

- 验证：整个工作区

- [ ] **步骤 1：运行共享包测试**

运行：

```powershell
npm run test --workspace @totp/core
npm run test --workspace @totp/sync
```

预期：全部 PASS。

- [ ] **步骤 2：运行 Android 单测**

运行：

```powershell
cd apps/android-app
.\gradlew.bat :app:testDebugUnitTest
```

预期：PASS。

- [ ] **步骤 3：构建 Android APK**

运行：

```powershell
cd apps/android-app
.\gradlew.bat :app:assembleDebug
```

预期：PASS。

- [ ] **步骤 4：检查 git 状态**

运行：

```powershell
git status --short
```

预期：无未提交文件。

- [ ] **步骤 5：输出完成摘要**

摘要必须包含：

- 已完成的 Android MVP 功能。
- 运行过的测试命令和结果。
- APK 路径。
- 未运行的设备验证原因，如果没有模拟器或真机。
