package com.iptvflix.androidtv.pairing

import com.iptvflix.androidtv.storage.TokenStore
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class PairingStateMachineTest {

    private class FakeTokenStore : TokenStore {
        var token: String? = null
        override fun saveDeviceToken(token: String) { this.token = token }
        override fun getDeviceToken(): String? = token
        override fun clearDeviceToken() { token = null }
        override fun saveProfileToken(token: String) {}
        override fun getProfileToken(): String? = null
        override fun clearProfileToken() {}
        override fun saveLastUsedProfileId(id: String) {}
        override fun getLastUsedProfileId(): String? = null
    }

    private fun fakeApi(
        code: String = "TESTCODE",
        statusSequence: List<PairingStatusResponse>,
    ): PairingApi {
        val api = mockk<PairingApi>()
        coEvery { api.requestCode() } returns PairingCodeResponse(code, "2099-01-01T00:00:00Z")
        var callCount = 0
        coEvery { api.pollStatus(any()) } answers {
            statusSequence[callCount++.coerceAtMost(statusSequence.lastIndex)]
        }
        return api
    }

    @Test
    fun `idle to approved stores token`() = runTest {
        val store = FakeTokenStore()
        val api = fakeApi(
            statusSequence = listOf(
                PairingStatusResponse("pending"),
                PairingStatusResponse("approved", "tok-secret"),
            ),
        )
        val states = mutableListOf<PairingState>()

        PairingRepository(api, store).runPairingFlow { states.add(it) }

        assertNotNull(states.filterIsInstance<PairingState.Approved>().firstOrNull())
        assertEquals("tok-secret", store.token)
    }

    @Test
    fun `expired state does not store token`() = runTest {
        val store = FakeTokenStore()
        val api = fakeApi(statusSequence = listOf(PairingStatusResponse("expired")))
        val states = mutableListOf<PairingState>()

        PairingRepository(api, store).runPairingFlow { states.add(it) }

        assert(states.any { it is PairingState.Expired }) { "Expected Expired state" }
        assertNull(store.token)
    }

    @Test
    fun `polling code state exposes the received code`() = runTest {
        val store = FakeTokenStore()
        val api = fakeApi(
            code = "ABCD1234",
            statusSequence = listOf(PairingStatusResponse("approved", "tok")),
        )
        val states = mutableListOf<PairingState>()

        PairingRepository(api, store).runPairingFlow { states.add(it) }

        val polling = states.filterIsInstance<PairingState.PollingCode>().firstOrNull()
        assertNotNull(polling)
        assertEquals("ABCD1234", polling!!.code)
    }

    @Test
    fun `re-request after expiry results in new Requesting state`() = runTest {
        val store = FakeTokenStore()
        val api = fakeApi(statusSequence = listOf(PairingStatusResponse("expired")))
        val states = mutableListOf<PairingState>()

        PairingRepository(api, store).runPairingFlow { states.add(it) }

        assert(states.first() is PairingState.Requesting) { "First state should be Requesting" }
    }
}
