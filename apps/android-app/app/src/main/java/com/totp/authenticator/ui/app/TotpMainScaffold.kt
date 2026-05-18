package com.totp.authenticator.ui.app

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarDefaults
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import com.totp.authenticator.R

enum class MainDestination(
    val label: String,
    @param:DrawableRes val iconRes: Int
) {
    Home("Home", R.drawable.nav_home),
    Add("Add", R.drawable.nav_add),
    Settings("Settings", R.drawable.nav_settings)
}

fun mainDestinationLabels(): List<String> {
    return MainDestination.entries.map { it.label }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TotpMainScaffold(
    title: String,
    selectedDestination: MainDestination?,
    onHome: () -> Unit,
    onAdd: () -> Unit,
    onSettings: () -> Unit,
    onBack: (() -> Unit)? = null,
    content: @Composable (PaddingValues) -> Unit
) {
    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text(title) },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) {
                            Icon(
                                painter = painterResource(R.drawable.action_back),
                                contentDescription = "Back"
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        },
        bottomBar = {
            if (selectedDestination != null) {
                NavigationBar(
                    containerColor = MaterialTheme.colorScheme.surface,
                    contentColor = MaterialTheme.colorScheme.onSurface,
                    windowInsets = NavigationBarDefaults.windowInsets
                ) {
                    MainDestination.entries.forEach { destination ->
                        NavigationBarItem(
                            selected = selectedDestination == destination,
                            onClick = {
                                when (destination) {
                                    MainDestination.Home -> onHome()
                                    MainDestination.Add -> onAdd()
                                    MainDestination.Settings -> onSettings()
                                }
                            },
                            icon = {
                                Icon(
                                    painter = painterResource(destination.iconRes),
                                    contentDescription = destination.label
                                )
                            },
                            label = { Text(destination.label) }
                        )
                    }
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
        contentColor = Color.Unspecified,
        content = content
    )
}
