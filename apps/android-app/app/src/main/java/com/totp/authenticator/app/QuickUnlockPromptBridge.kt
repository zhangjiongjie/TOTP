package com.totp.authenticator.app

import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

typealias QuickUnlockPrompt = (
    title: String,
    subtitle: String,
    onAuthenticated: () -> Unit,
    onError: (String) -> Unit
) -> Unit

@Composable
fun rememberQuickUnlockPromptBridge(
    quickUnlockState: QuickUnlockViewModel
): QuickUnlockPrompt {
    val activityContext = LocalContext.current
    return remember(activityContext, quickUnlockState) {
        prompt@ { title, subtitle, onAuthenticated, onError ->
            val fragmentActivity = activityContext as? FragmentActivity
            if (fragmentActivity == null) {
                quickUnlockState.updateBusy(false)
                onError("当前界面不可使用快速解锁")
                return@prompt
            }
            val prompt = BiometricPrompt(
                fragmentActivity,
                ContextCompat.getMainExecutor(activityContext),
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        onAuthenticated()
                    }

                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        quickUnlockState.updateBusy(false)
                        onError(errString.toString())
                    }

                    override fun onAuthenticationFailed() {
                        onError("系统认证失败，请重试。")
                    }
                }
            )
            val promptInfo = BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(subtitle)
                .setAllowedAuthenticators(BIOMETRIC_STRONG or DEVICE_CREDENTIAL)
                .build()
            runCatching {
                prompt.authenticate(promptInfo)
            }.onFailure { error ->
                quickUnlockState.updateBusy(false)
                onError(error.message ?: "无法启动系统凭据验证")
            }
        }
    }
}
