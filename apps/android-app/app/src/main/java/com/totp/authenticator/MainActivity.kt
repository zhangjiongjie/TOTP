package com.totp.authenticator

import android.os.Bundle
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowCompat
import androidx.fragment.app.FragmentActivity
import com.totp.authenticator.app.TotpApp
import com.totp.authenticator.ui.theme.TotpTheme

class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, true)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(getColor(R.color.totp_primary)),
            navigationBarStyle = SystemBarStyle.light(
                getColor(R.color.totp_background),
                getColor(R.color.totp_background)
            )
        )
        setContent {
            TotpTheme {
                TotpApp()
            }
        }
    }
}
