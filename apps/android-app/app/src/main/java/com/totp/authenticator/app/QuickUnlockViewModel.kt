package com.totp.authenticator.app

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.totp.authenticator.data.biometric.QuickUnlockAvailability
import kotlinx.coroutines.launch

class QuickUnlockViewModel(initialState: QuickUnlockState) : ViewModel() {
    var enabled: Boolean by mutableStateOf(initialState.enabled)
        private set

    var availability: QuickUnlockAvailability by mutableStateOf(initialState.availability)
        private set

    var available: Boolean by mutableStateOf(initialState.available)
        private set

    var hasStrongBiometric: Boolean by mutableStateOf(initialState.hasStrongBiometric)
        private set

    var isBusy: Boolean by mutableStateOf(false)
        private set

    var autoUnlockAttempted: Boolean by mutableStateOf(false)
        private set

    val setupRequired: Boolean
        get() = availability == QuickUnlockAvailability.NeedsSystemCredential

    fun refresh(state: QuickUnlockState) {
        enabled = state.enabled
        availability = state.availability
        available = state.available
        hasStrongBiometric = state.hasStrongBiometric
    }

    fun updateEnabled(value: Boolean) {
        enabled = value
    }

    fun updateBusy(busy: Boolean) {
        isBusy = busy
    }

    fun markAutoAttempted() {
        autoUnlockAttempted = true
    }

    fun resetUnlockAttempt() {
        isBusy = false
        autoUnlockAttempted = false
    }

    fun <T> launchCredentialTask(
        task: suspend () -> T,
        onSuccess: (T) -> Unit,
        onFailure: (Throwable) -> Unit
    ) {
        viewModelScope.launch {
            runCatching {
                task()
            }.onSuccess(onSuccess)
                .onFailure(onFailure)
            updateBusy(false)
        }
    }
}
