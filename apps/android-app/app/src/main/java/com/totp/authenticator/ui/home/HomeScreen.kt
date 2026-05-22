package com.totp.authenticator.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.totp.authenticator.core.account.AccountSorter
import com.totp.authenticator.core.account.TotpAccount
import com.totp.authenticator.core.totp.TotpGenerator
import com.totp.authenticator.data.vault.LocalVault
import kotlinx.coroutines.delay

@Composable
fun HomeScreen(
    vault: LocalVault,
    syncStatusMessage: String,
    copyStatusMessage: String,
    errorMessage: String,
    lastSyncLabel: String,
    onAdd: () -> Unit,
    onEdit: (String) -> Unit,
    onCopy: (String, com.totp.authenticator.core.account.TotpAccount) -> Unit,
    modifier: Modifier = Modifier
) {
    val accounts = remember(vault.accounts) { AccountSorter.sort(vault.accounts) }

    Surface(
        modifier = modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            HomeMetaLine(
                accountCount = accounts.size,
                lastSyncLabel = lastSyncLabel
            )
            if (syncStatusMessage.isNotBlank() || copyStatusMessage.isNotBlank() || errorMessage.isNotBlank()) {
                val banner = resolveHomeBanner(
                    syncStatusMessage = syncStatusMessage,
                    copyStatusMessage = copyStatusMessage,
                    errorMessage = errorMessage
                )
                HomeStatusCard(
                    message = banner.message,
                    tone = banner.tone
                )
            }

            if (accounts.isEmpty()) {
                EmptyHomeState(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    onAdd = onAdd
                )
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(accounts, key = { it.id }) { account ->
                        AccountCard(
                            account = account,
                            onCopy = { copiedCode -> onCopy(copiedCode, account) },
                            onEdit = onEdit
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun RowScope.AccountOtpTicker(
    account: TotpAccount,
    onCopy: (String) -> Unit
) {
    var nowMillis by remember(account.id) { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(account.id) {
        while (true) {
            nowMillis = System.currentTimeMillis()
            val nextSecondBoundary = ((nowMillis / 1000L) + 1L) * 1000L
            delay((nextSecondBoundary - nowMillis).coerceAtLeast(16L))
        }
    }
    val code = runCatching {
        TotpGenerator.generate(
            secret = account.secret,
            timestampMillis = nowMillis,
            period = account.period,
            digits = account.digits,
            algorithm = account.algorithm
        )
    }.getOrDefault("------")
    AccountCodeRow(
        account = account,
        code = code,
        secondsRemaining = secondsRemaining(nowMillis, account.period),
        onCopy = onCopy
    )
}

@Composable
private fun EmptyHomeState(
    modifier: Modifier,
    onAdd: () -> Unit
) {
    Box(
        modifier = modifier,
        contentAlignment = Alignment.Center
    ) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.extraLarge,
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.78f),
            tonalElevation = 1.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = "还没有账号",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = "点击底部添加按钮录入账号。",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(4.dp))
                Button(onClick = onAdd) {
                    Text("添加账号")
                }
            }
        }
    }
}

@Composable
private fun HomeMetaLine(
    accountCount: Int,
    lastSyncLabel: String
) {
    Text(
        text = "$accountCount 个账号 · $lastSyncLabel",
        modifier = Modifier.fillMaxWidth(),
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
    )
}

@Composable
private fun HomeStatusCard(
    message: String,
    tone: HomeBannerTone
) {
    val colors = webBannerColors()
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.extraLarge,
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.78f),
        tonalElevation = 1.dp
    ) {
        Text(
            text = message,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            style = MaterialTheme.typography.bodySmall,
            color = when (tone) {
                HomeBannerTone.Success -> colors.success
                HomeBannerTone.Error -> colors.danger
                HomeBannerTone.Idle -> colors.inkSoft
            },
            lineHeight = MaterialTheme.typography.bodySmall.lineHeight
        )
    }
}

private fun resolveHomeBanner(
    syncStatusMessage: String,
    copyStatusMessage: String,
    errorMessage: String
): HomeBanner {
    return when {
        errorMessage.isNotBlank() -> HomeBanner(errorMessage, HomeBannerTone.Error)
        copyStatusMessage.isNotBlank() -> HomeBanner(copyStatusMessage, HomeBannerTone.Success)
        syncStatusMessage.contains("远端保管库需要主密码") -> HomeBanner(syncStatusMessage, HomeBannerTone.Error)
        syncStatusMessage.startsWith("同步失败：") -> HomeBanner(syncStatusMessage, HomeBannerTone.Error)
        syncStatusMessage.startsWith("同步冲突：") -> HomeBanner(syncStatusMessage, HomeBannerTone.Error)
        syncStatusMessage.contains("同步冲突") -> HomeBanner(syncStatusMessage, HomeBannerTone.Error)
        else -> HomeBanner(syncStatusMessage, HomeBannerTone.Idle)
    }
}

private data class HomeBanner(
    val message: String,
    val tone: HomeBannerTone
)

private enum class HomeBannerTone {
    Idle,
    Success,
    Error
}

@Composable
private fun webBannerColors(): WebBannerColors {
    return if (isSystemInDarkTheme()) {
        WebBannerColors(
            inkSoft = Color(0xFFA0A4AD),
            success = Color(0xFF58C18F),
            danger = Color(0xFFFF6B6B)
        )
    } else {
        WebBannerColors(
            inkSoft = Color(0xFF61738A),
            success = Color(0xFF2D7A59),
            danger = Color(0xFFC53D3D)
        )
    }
}

private data class WebBannerColors(
    val inkSoft: Color,
    val success: Color,
    val danger: Color
)
