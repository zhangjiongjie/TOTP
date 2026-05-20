package com.totp.authenticator.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class BackupViewModelTest {
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
    fun successClearsPreviousError() {
        val viewModel = BackupViewModel()

        viewModel.showError("导出失败")
        viewModel.showSuccess("已导出 2 个账号。")

        assertEquals("已导出 2 个账号。", viewModel.statusMessage)
        assertEquals("", viewModel.errorMessage)
    }

    @Test
    fun busyCanBeUpdatedIndependentlyFromMessages() {
        val viewModel = BackupViewModel()

        viewModel.updateBusy(true)
        viewModel.showError("保管库未解锁。")

        assertTrue(viewModel.isBusy)
        assertEquals("保管库未解锁。", viewModel.errorMessage)

        viewModel.updateBusy(false)

        assertFalse(viewModel.isBusy)
    }

    @Test
    fun launchTaskRoutesSuccessAndClearsBusy() = runTest {
        val viewModel = BackupViewModel()
        var value = 0

        viewModel.launchTask(
            task = { 7 },
            onSuccess = { value = it },
            onFailure = { viewModel.showError(it.message.orEmpty()) }
        )
        dispatcher.scheduler.advanceUntilIdle()

        assertEquals(7, value)
        assertFalse(viewModel.isBusy)
    }

    @Test
    fun launchTaskCanKeepBusyAfterSuccessForDocumentPicker() = runTest {
        val viewModel = BackupViewModel()

        viewModel.launchTask(
            finishBusyOnSuccess = false,
            task = { "payload" },
            onSuccess = { viewModel.showSuccess(it) },
            onFailure = { viewModel.showError(it.message.orEmpty()) }
        )
        dispatcher.scheduler.advanceUntilIdle()

        assertEquals("payload", viewModel.statusMessage)
        assertTrue(viewModel.isBusy)
    }

    @Test
    fun tracksPendingExportContentForDocumentPicker() {
        val viewModel = BackupViewModel()

        viewModel.prepareExport(BackupExportPayload(content = """{"encrypted":true}""", filename = "totp.json"))

        assertTrue(viewModel.externalPickerActive)
        assertEquals("totp.json", viewModel.pendingExportFilename)
        assertEquals("""{"encrypted":true}""", viewModel.consumePendingExportContent())
        assertNull(viewModel.consumePendingExportContent())
    }

    @Test
    fun tracksImportContentPasswordPromptAndDismissal() {
        val viewModel = BackupViewModel()

        viewModel.requestImportPassword("""{"accounts":[]}""")

        assertEquals(BackupPasswordAction.Import, viewModel.pendingPasswordAction)
        assertEquals("""{"accounts":[]}""", viewModel.pendingImportContent)

        viewModel.dismissPasswordPrompt()

        assertNull(viewModel.pendingPasswordAction)
        assertNull(viewModel.pendingImportContent)
        assertFalse(viewModel.isBusy)
    }

    @Test
    fun consumesPasswordPromptOnce() {
        val viewModel = BackupViewModel()

        viewModel.requestImportPassword("""{"accounts":[]}""")

        val request = viewModel.consumePasswordRequest()

        assertEquals(BackupPasswordAction.Import, request?.action)
        assertEquals("""{"accounts":[]}""", request?.importContent)
        assertNull(viewModel.pendingPasswordAction)
        assertNull(viewModel.pendingImportContent)
        assertNull(viewModel.consumePasswordRequest())
    }
}
