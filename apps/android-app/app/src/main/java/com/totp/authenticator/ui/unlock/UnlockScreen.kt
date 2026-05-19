package com.totp.authenticator.ui.unlock

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.totp.authenticator.ui.common.PasswordVisibilityIcon

@Composable
fun UnlockScreen(
    hasExistingVault: Boolean,
    errorMessage: String?,
    isBusy: Boolean,
    biometricUnlockEnabled: Boolean,
    isBiometricBusy: Boolean,
    modifier: Modifier = Modifier,
    onCreatePassword: (String) -> Unit,
    onUnlock: (String) -> Unit,
    onBiometricUnlock: () -> Unit
) {
    val formState = remember(hasExistingVault) { UnlockFormState(hasExistingVault) }
    val displayedError = formState.localError ?: errorMessage
    var passwordVisible by remember { mutableStateOf(false) }

    Surface(
        modifier = modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 520.dp),
                shape = MaterialTheme.shapes.extraLarge,
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.78f),
                tonalElevation = 1.dp
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text(
                        text = "主密码",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )

                    Text(
                        text = if (hasExistingVault) "请输入已保存的主密码" else "首次输入会初始化当前设备的主密码",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    OutlinedTextField(
                        value = formState.password,
                        onValueChange = {
                            formState.password = it
                            formState.clearError()
                        },
                        enabled = !isBusy,
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(if (hasExistingVault) "输入主密码" else "设置主密码") },
                        singleLine = true,
                        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        trailingIcon = {
                            PasswordVisibilityIcon(
                                visible = passwordVisible,
                                onToggle = { passwordVisible = !passwordVisible }
                            )
                        },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
                    )

                    Button(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        enabled = !isBusy,
                        onClick = {
                            when (val submission = formState.submit()) {
                                is UnlockFormSubmission.Create -> onCreatePassword(submission.password)
                                is UnlockFormSubmission.Unlock -> onUnlock(submission.password)
                                is UnlockFormSubmission.Invalid -> Unit
                            }
                        }
                    ) {
                        if (isBusy) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                        }
                        Text(formState.busyLabel(isBusy))
                    }

                    if (biometricUnlockEnabled) {
                        OutlinedButton(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(46.dp),
                            enabled = !isBusy,
                        onClick = onBiometricUnlock
                    ) {
                            Text("快速解锁")
                    }

                    Text(
                            text = if (isBiometricBusy) {
                                "正在调用系统凭据验证。如果没有自动弹出，可以再次点按快速解锁。"
                            } else {
                                "可使用已开启的系统凭据快速解锁，也可以继续使用主密码。"
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    if (displayedError != null) {
                        Text(
                            text = displayedError,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }
        }
    }
}
