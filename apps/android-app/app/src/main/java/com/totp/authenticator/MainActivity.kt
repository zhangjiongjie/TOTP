package com.totp.authenticator

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.totp.authenticator.app.TotpApp
import com.totp.authenticator.ui.theme.TotpTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            TotpTheme {
                TotpApp()
            }
        }
    }
}
