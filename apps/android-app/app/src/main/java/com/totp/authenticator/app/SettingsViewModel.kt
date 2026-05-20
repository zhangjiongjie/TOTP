package com.totp.authenticator.app

import androidx.lifecycle.ViewModel
import com.totp.authenticator.ui.settings.SettingsUiModel

class SettingsViewModel : ViewModel() {
    fun buildUiModel(
        syncState: SyncViewModel,
        backupState: BackupViewModel,
        quickUnlockState: QuickUnlockViewModel
    ): SettingsUiModel {
        return SettingsUiModel.from(
            biometricUnlockEnabled = quickUnlockState.enabled,
            biometricUnlockAvailable = quickUnlockState.available,
            quickUnlockSetupRequired = quickUnlockState.setupRequired,
            hasStrongBiometric = quickUnlockState.hasStrongBiometric,
            isBiometricBusy = quickUnlockState.isBusy,
            webDavSettings = syncState.webDavSettings,
            webDavMetadata = syncState.webDavMetadata,
            isWebDavBusy = syncState.isBusy,
            webDavStatusMessage = syncState.webDavStatusMessage,
            webDavStatusIsError = syncState.webDavStatusIsError,
            backupStatusMessage = backupState.statusMessage,
            backupErrorMessage = backupState.errorMessage,
            isBackupBusy = backupState.isBusy
        )
    }
}
