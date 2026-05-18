package com.totp.authenticator.ui.unlock

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class UnlockFormStateTest {
    @Test
    fun firstRunSubmitsSinglePasswordForVaultCreation() {
        val state = UnlockFormState(hasExistingVault = false)
        state.password = "TestPassword123!"

        assertFalse(state.showsConfirmation)
        assertEquals(UnlockFormSubmission.Create("TestPassword123!"), state.submit())
    }

    @Test
    fun existingVaultSubmitsPasswordForUnlock() {
        val state = UnlockFormState(hasExistingVault = true)
        state.password = "TestPassword123!"

        assertEquals(UnlockFormSubmission.Unlock("TestPassword123!"), state.submit())
    }

    @Test
    fun emptyPasswordShowsValidationError() {
        val state = UnlockFormState(hasExistingVault = false)

        assertEquals(UnlockFormSubmission.Invalid("Password is required"), state.submit())
    }

    @Test
    fun exposesBusyLabelsForLongRunningVaultWork() {
        assertEquals("Creating...", UnlockFormState(hasExistingVault = false).busyLabel(true))
        assertEquals("Unlocking...", UnlockFormState(hasExistingVault = true).busyLabel(true))
    }
}
