package com.totp.authenticator.ui.app

import org.junit.Assert.assertEquals
import org.junit.Test

class TotpMainScaffoldTest {
    @Test
    fun mainDestinationsKeepCrossClientOrder() {
        assertEquals(listOf("Home", "Add", "Settings"), mainDestinationLabels())
    }
}
