package com.totp.authenticator.app

import javax.crypto.AEADBadTagException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class PasswordChangeViewModelTest {
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
    fun startsWithProgressDialogVisible() {
        val viewModel = PasswordChangeViewModel()

        viewModel.start()

        assertTrue(viewModel.dialogVisible)
        assertTrue(viewModel.inProgress)
        assertFalse(viewModel.dialogIsError)
        assertEquals("正在更新主密码...", viewModel.dialogMessage)
        assertEquals("", viewModel.masterPasswordErrorMessage)
    }

    @Test
    fun mapsCryptoErrorsToCurrentPasswordMessage() {
        val viewModel = PasswordChangeViewModel()

        assertEquals("当前主密码错误", viewModel.userFacingError(AEADBadTagException()))
        assertEquals("当前主密码错误", viewModel.userFacingError(IllegalStateException("Tag mismatch")))
    }

    @Test
    fun launchChangeRoutesSuccessAndHidesDialogAfterDelay() = runTest {
        val viewModel = PasswordChangeViewModel()
        var successValue = ""

        viewModel.launchChange(
            successMessage = "主密码已修改，系统凭证解锁需要重新开启。",
            task = { "ok" },
            onSuccess = { successValue = it },
            onFailure = {}
        )
        dispatcher.scheduler.runCurrent()

        assertTrue(viewModel.dialogVisible)
        assertFalse(viewModel.inProgress)
        assertEquals("主密码已修改，系统凭证解锁需要重新开启。", viewModel.dialogMessage)

        dispatcher.scheduler.advanceUntilIdle()

        assertEquals("ok", successValue)
        assertFalse(viewModel.dialogVisible)
    }

    @Test
    fun launchChangeRoutesFailureAndHidesDialogAfterDelay() = runTest {
        val viewModel = PasswordChangeViewModel()
        var errorSeen = false

        viewModel.launchChange(
            successMessage = "unused",
            task = { error("unable to decrypt") },
            onSuccess = {},
            onFailure = { errorSeen = true }
        )
        dispatcher.scheduler.runCurrent()

        assertTrue(viewModel.dialogVisible)
        assertFalse(viewModel.inProgress)
        assertTrue(viewModel.dialogIsError)
        assertEquals("当前主密码错误", viewModel.dialogMessage)
        assertEquals("当前主密码错误", viewModel.masterPasswordErrorMessage)

        dispatcher.scheduler.advanceUntilIdle()

        assertTrue(errorSeen)
        assertFalse(viewModel.dialogVisible)
    }
}
