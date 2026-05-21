package com.totp.authenticator.ui.home

import androidx.compose.foundation.clickable
import androidx.compose.foundation.Image
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.totp.authenticator.R
import com.totp.authenticator.core.account.TotpAccount
import com.totp.authenticator.ui.brand.BrandIcon
import com.totp.authenticator.ui.brand.BrandIconMatcher

@Composable
fun AccountCard(
    account: TotpAccount,
    onCopy: (String) -> Unit,
    onEdit: (String) -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp,
        shadowElevation = 1.dp,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 14.dp, top = 12.dp, end = 12.dp, bottom = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            BrandBadge(account.issuer)
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = account.issuer.ifBlank { "未命名服务" },
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = account.accountName.ifBlank { "未填写账号" },
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    EditIconButton(onClick = { onEdit(account.id) })
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    AccountOtpTicker(account = account, onCopy = onCopy)
                }
            }
        }
    }
}

@Composable
fun RowScope.AccountCodeRow(
    account: TotpAccount,
    code: String,
    secondsRemaining: Int,
    onCopy: (String) -> Unit
) {
    Text(
        text = formatTotpCode(code),
        modifier = Modifier
            .weight(1f)
            .clickable { onCopy(code) },
        style = MaterialTheme.typography.headlineSmall,
        fontFamily = FontFamily.Monospace,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.primary
    )
    CountdownRing(
        secondsRemaining = secondsRemaining,
        period = account.period
    )
    CopyPill(onClick = { onCopy(code) })
}

@Composable
private fun BrandBadge(issuer: String) {
    val icon = BrandIconMatcher.match(issuer)
    val imageRes = icon.drawableResIdOrNull()
    val label = when (icon.name) {
        "Default" -> issuer.take(1).uppercase().ifEmpty { "T" }
        else -> icon.name.take(1)
    }
    Surface(
        modifier = Modifier.size(48.dp),
        shape = RoundedCornerShape(14.dp),
        color = Color(0xFFEAF1F8),
        contentColor = MaterialTheme.colorScheme.onSurfaceVariant,
        border = BorderStroke(1.dp, Color(0xFFCFDCEB))
    ) {
        Box(contentAlignment = Alignment.Center) {
            if (imageRes != null) {
                Image(
                    painter = painterResource(imageRes),
                    contentDescription = null,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.size(34.dp)
                )
            } else {
                Text(
                    text = label,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
private fun EditIconButton(onClick: () -> Unit) {
    Surface(
        modifier = Modifier.size(36.dp),
        shape = CircleShape,
        color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.18f))
    ) {
        IconButton(onClick = onClick) {
            Icon(
                painter = painterResource(R.drawable.action_edit),
                contentDescription = "Edit",
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

@Composable
private fun CopyPill(onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = CircleShape,
        color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.55f),
        contentColor = MaterialTheme.colorScheme.primary
    ) {
        Text(
            text = "复制",
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
private fun CountdownRing(secondsRemaining: Int, period: Int) {
    val safePeriod = period.takeIf { it > 0 } ?: 30
    val progress = secondsRemaining.coerceIn(0, safePeriod).toFloat() / safePeriod.toFloat()
    val activeColor = MaterialTheme.colorScheme.primary
    val trackColor = MaterialTheme.colorScheme.outlineVariant
    Box(
        modifier = Modifier.size(38.dp),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.size(38.dp)) {
            val stroke = Stroke(width = 4.dp.toPx(), cap = StrokeCap.Round)
            val inset = 2.dp.toPx()
            val arcSize = Size(size.width - inset * 2, size.height - inset * 2)
            drawArc(
                color = trackColor,
                startAngle = -90f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = Offset(inset, inset),
                size = arcSize,
                style = stroke
            )
            drawArc(
                color = activeColor,
                startAngle = -90f,
                sweepAngle = 360f * progress,
                useCenter = false,
                topLeft = Offset(inset, inset),
                size = arcSize,
                style = stroke
            )
        }
        Text(
            text = "${secondsRemaining.coerceAtLeast(0)}s",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}

private fun BrandIcon.drawableResIdOrNull(): Int? {
    return when (this) {
        BrandIcon.Amazon -> R.drawable.brand_amazon
        BrandIcon.Apple -> R.drawable.brand_apple
        BrandIcon.Aws -> R.drawable.brand_aws
        BrandIcon.Binance -> R.drawable.brand_binance
        BrandIcon.Bitwarden -> R.drawable.brand_bitwarden
        BrandIcon.Canva -> R.drawable.brand_canva
        BrandIcon.Cloudflare -> R.drawable.brand_cloudflare
        BrandIcon.Coinbase -> R.drawable.brand_coinbase
        BrandIcon.Discord -> R.drawable.brand_discord
        BrandIcon.Dropbox -> R.drawable.brand_dropbox
        BrandIcon.Facebook -> R.drawable.brand_facebook
        BrandIcon.GitHub -> R.drawable.brand_github
        BrandIcon.GitLab -> R.drawable.brand_gitlab
        BrandIcon.Google -> R.drawable.brand_google
        BrandIcon.Instagram -> R.drawable.brand_instagram
        BrandIcon.LinkedIn -> R.drawable.brand_linkedin
        BrandIcon.Microsoft -> R.drawable.brand_microsoft
        BrandIcon.Notion -> R.drawable.brand_notion
        BrandIcon.OneDrive -> R.drawable.brand_onedrive
        BrandIcon.OpenAI -> R.drawable.brand_openai
        BrandIcon.PayPal -> R.drawable.brand_paypal
        BrandIcon.Reddit -> R.drawable.brand_reddit
        BrandIcon.Slack -> R.drawable.brand_slack
        BrandIcon.Spotify -> R.drawable.brand_spotify
        BrandIcon.Steam -> R.drawable.brand_steam
        BrandIcon.Stripe -> R.drawable.brand_stripe
        BrandIcon.Telegram -> R.drawable.brand_telegram
        BrandIcon.TikTok -> R.drawable.brand_tiktok
        BrandIcon.Twitch -> R.drawable.brand_twitch
        BrandIcon.WhatsApp -> R.drawable.brand_whatsapp
        BrandIcon.X -> R.drawable.brand_x
        BrandIcon.Yahoo -> R.drawable.brand_yahoo
        BrandIcon.Zoom -> R.drawable.brand_zoom
        BrandIcon.Default -> R.drawable.brand_default
    }
}
