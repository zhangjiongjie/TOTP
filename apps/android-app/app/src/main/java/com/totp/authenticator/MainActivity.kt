package com.totp.authenticator

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.fragment.app.FragmentActivity
import com.totp.authenticator.app.TotpApp
import com.totp.authenticator.ui.theme.TotpTheme

class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, true)
        window.statusBarColor = getColor(R.color.totp_primary)
        window.navigationBarColor = getColor(R.color.totp_background)
        WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = false
        setContent {
            TotpTheme {
                TotpApp()
            }
        }
    }
}
