package com.totp.authenticator.app

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class UnlockViewModelTest {
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
    fun showErrorAndClearError() {
        val viewModel = UnlockViewModel()

        viewModel.showError("Could not unlock vault")

        assertEquals("Could not unlock vault", viewModel.errorMessage)

        viewModel.clearError()

        assertNull(viewModel.errorMessage)
    }

    @Test
    fun launchTaskRoutesSuccessAndClearsBusy() = runTest(dispatcher) {
        val viewModel = UnlockViewModel()
        var value = ""
        val gate = CompletableDeferred<Unit>()

        viewModel.launchTask(
            task = {
                gate.await()
                "unlocked"
            },
            onSuccess = { value = it },
            onFailure = { viewModel.showError("failed") }
        )
        dispatcher.scheduler.runCurrent()

        assertTrue(viewModel.isBusy)

        gate.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()

        assertEquals("unlocked", value)
        assertNull(viewModel.errorMessage)
        assertFalse(viewModel.isBusy)
    }

    @Test
    fun launchTaskRoutesFailureAndClearsBusy() = runTest(dispatcher) {
        val viewModel = UnlockViewModel()

        viewModel.launchTask(
            task = { error("bad password") },
            onSuccess = {},
            onFailure = { viewModel.showError("Could not unlock vault") }
        )
        dispatcher.scheduler.advanceUntilIdle()

        assertEquals("Could not unlock vault", viewModel.errorMessage)
        assertFalse(viewModel.isBusy)
    }

    @Test
    fun launchTaskIgnoresDuplicateRequestWhileBusy() = runTest(dispatcher) {
        val viewModel = UnlockViewModel()
        val gate = CompletableDeferred<Unit>()
        var successCount = 0

        viewModel.launchTask(
            task = {
                gate.await()
                "first"
            },
            onSuccess = { successCount += 1 },
            onFailure = { viewModel.showError("failed") }
        )
        dispatcher.scheduler.runCurrent()

        viewModel.launchTask(
            task = { "second" },
            onSuccess = { successCount += 10 },
            onFailure = { viewModel.showError("failed") }
        )

        gate.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()

        assertEquals(1, successCount)
        assertFalse(viewModel.isBusy)
    }
}
