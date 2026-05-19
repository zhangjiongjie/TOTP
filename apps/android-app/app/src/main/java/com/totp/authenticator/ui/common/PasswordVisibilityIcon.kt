package com.totp.authenticator.ui.common

import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.painterResource
import com.totp.authenticator.R

@Composable
fun PasswordVisibilityIcon(
    visible: Boolean,
    onToggle: () -> Unit
) {
    IconButton(onClick = onToggle) {
        Icon(
            painter = painterResource(if (visible) R.drawable.action_visibility_off else R.drawable.action_visibility),
            contentDescription = if (visible) "Hide password" else "Show password"
        )
    }
}
