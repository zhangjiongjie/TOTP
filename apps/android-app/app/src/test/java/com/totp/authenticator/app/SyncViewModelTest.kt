package com.totp.authenticator.app

import com.totp.authenticator.data.webdav.WebDavSettings
import com.totp.authenticator.data.webdav.WebDavSyncMetadata
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SyncViewModelTest {
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
    fun busyRemainsTrueUntilAllOperationsFinish() {
        val viewModel = SyncViewModel(WebDavSettings(), WebDavSyncMetadata())

        viewModel.beginOperation()
        viewModel.beginOperation()
        viewModel.endOperation()

        assertTrue(viewModel.isBusy)

        viewModel.endOperation()

        assertFalse(viewModel.isBusy)
    }

    @Test
    fun ignoresExtraEndOperation() {
        val viewModel = SyncViewModel(WebDavSettings(), WebDavSyncMetadata())

        viewModel.endOperation()

        assertFalse(viewModel.isBusy)
    }

    @Test
    fun storesHomeAndSettingsMessagesSeparately() {
        val viewModel = SyncViewModel(WebDavSettings(), WebDavSyncMetadata())

        viewModel.showHomeCopy("同步完成")
        viewModel.showSettingsError("连接失败")

        assertEquals("同步完成", viewModel.homeCopyStatusMessage)
        assertEquals("", viewModel.homeErrorStatusMessage)
        assertEquals("连接失败", viewModel.webDavStatusMessage)
        assertTrue(viewModel.webDavStatusIsError)
    }

    @Test
    fun homeSyncStatusKeepsRemotePasswordBlockedStateAfterTransientMessageClears() {
        val viewModel = SyncViewModel(
            WebDavSettings(enabled = true),
            WebDavSyncMetadata(lastStatus = "blocked")
        )

        assertEquals("远端保管库需要主密码验证后才能继续同步。", viewModel.homeSyncStatus)

        viewModel.showHomeError("无法解锁。")
        viewModel.clearHomeMessages()

        assertEquals("远端保管库需要主密码验证后才能继续同步。", viewModel.homeSyncStatus)
    }

    @Test
    fun homeSyncStatusShowsLastErrorInsteadOfLatestWhenSyncFailed() {
        val viewModel = SyncViewModel(
            WebDavSettings(enabled = true),
            WebDavSyncMetadata(lastStatus = "error", lastError = "WebDAV 连接失败")
        )

        assertEquals("同步失败：WebDAV 连接失败", viewModel.homeSyncStatus)
    }

    @Test
    fun homeSyncStatusUsesWaitingMessageBeforeFirstSync() {
        val viewModel = SyncViewModel(WebDavSettings(enabled = true), WebDavSyncMetadata())

        assertEquals("WebDAV 同步已开启，等待首次同步。", viewModel.homeSyncStatus)
    }

    @Test
    fun launchExclusiveSyncKeepsCurrentOperationWhenAnotherSyncIsRequested() = runTest {
        val viewModel = SyncViewModel(WebDavSettings(), WebDavSyncMetadata())
        val firstCanFinish = CompletableDeferred<Unit>()
        var firstCompleted = false
        var secondRan = false

        viewModel.launchExclusiveSync {
            firstCanFinish.await()
            firstCompleted = true
        }
        dispatcher.scheduler.runCurrent()

        assertTrue(viewModel.isBusy)

        viewModel.launchExclusiveSync {
            secondRan = true
        }
        dispatcher.scheduler.runCurrent()

        assertFalse(secondRan)
        assertFalse(firstCompleted)
        assertTrue(viewModel.isBusy)

        firstCanFinish.complete(Unit)
        dispatcher.scheduler.advanceUntilIdle()

        assertTrue(firstCompleted)
        assertFalse(secondRan)
        assertFalse(viewModel.isBusy)
    }

    @Test
    fun launchExclusiveSyncTaskRoutesSuccessAndFailure() = runTest {
        val viewModel = SyncViewModel(WebDavSettings(), WebDavSyncMetadata())
        var successValue = 0
        var errorMessage = ""

        viewModel.launchExclusiveSyncTask(
            task = { 42 },
            onSuccess = { successValue = it },
            onFailure = { errorMessage = it.message.orEmpty() }
        )
        dispatcher.scheduler.advanceUntilIdle()

        assertEquals(42, successValue)
        assertEquals("", errorMessage)
        assertFalse(viewModel.isBusy)

        viewModel.launchExclusiveSyncTask(
            task = { error("boom") },
            onSuccess = { successValue = it },
            onFailure = { errorMessage = it.message.orEmpty() }
        )
        dispatcher.scheduler.advanceUntilIdle()

        assertEquals("boom", errorMessage)
        assertFalse(viewModel.isBusy)
    }
}
