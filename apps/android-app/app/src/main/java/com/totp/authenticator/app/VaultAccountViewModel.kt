package com.totp.authenticator.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch

class VaultAccountViewModel : ViewModel() {
    fun launchMutation(block: suspend () -> Unit) {
        viewModelScope.launch {
            block()
        }
    }
}
