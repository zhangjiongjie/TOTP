package com.totp.authenticator.app

import com.totp.authenticator.data.biometric.QuickUnlockAvailability
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class QuickUnlockViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun refreshAppliesCoordinatorState() {
        val viewModel = QuickUnlockViewModel(
            QuickUnlockState(
                enabled = true,
                availability = QuickUnlockAvailability.Available,
                available = true,
                hasStrongBiometric = true
            )
        )

        viewModel.refresh(
            QuickUnlockState(
                enabled = false,
                availability = QuickUnlockAvailability.Unsupported,
                available = false,
                hasStrongBiometric = false
            )
        )

        assertFalse(viewModel.enabled)
        assertFalse(viewModel.available)
        assertFalse(viewModel.hasStrongBiometric)
        assertFalse(viewModel.setupRequired)
    }

    @Test
    fun busyAndAutoAttemptAreOwnedByViewModel() {
        val viewModel = QuickUnlockViewModel(
            QuickUnlockState(
                enabled = false,
                availability = QuickUnlockAvailability.NeedsSystemCredential,
                available = false,
                hasStrongBiometric = false
            )
        )

        viewModel.updateBusy(true)
        viewModel.markAutoAttempted()

        assertTrue(viewModel.isBusy)
        assertTrue(viewModel.autoUnlockAttempted)
        assertTrue(viewModel.setupRequired)

        viewModel.resetUnlockAttempt()

        assertFalse(viewModel.isBusy)
        assertFalse(viewModel.autoUnlockAttempted)
    }

    @Test
    fun launchCredentialTaskRoutesFailureAndClearsBusy() = runTest {
        val viewModel = QuickUnlockViewModel(
            QuickUnlockState(
                enabled = true,
                availability = QuickUnlockAvailability.Available,
                available = true,
                hasStrongBiometric = true
            )
        )
        var errorMessage = ""

        viewModel.updateBusy(true)
        viewModel.launchCredentialTask(
            task = { error("cipher failed") },
            onSuccess = {},
            onFailure = { errorMessage = it.message.orEmpty() }
        )
        dispatcher.scheduler.advanceUntilIdle()

        assertFalse(viewModel.isBusy)
        assertTrue(errorMessage.contains("cipher failed"))
    }
}
