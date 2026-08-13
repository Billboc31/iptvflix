package com.iptvflix.androidtv.command

import com.iptvflix.androidtv.network.SseClient
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class ReconnectBackoffTest {

    @Test
    fun `backoff sequence starts at 1s and doubles each attempt`() {
        assertEquals(1_000L, SseClient.nextBackoffDelayMs(0))
        assertEquals(2_000L, SseClient.nextBackoffDelayMs(1))
        assertEquals(4_000L, SseClient.nextBackoffDelayMs(2))
        assertEquals(8_000L, SseClient.nextBackoffDelayMs(3))
        assertEquals(16_000L, SseClient.nextBackoffDelayMs(4))
        assertEquals(32_000L, SseClient.nextBackoffDelayMs(5))
    }

    @Test
    fun `backoff is capped at 60s`() {
        assertEquals(60_000L, SseClient.nextBackoffDelayMs(6))
        assertEquals(60_000L, SseClient.nextBackoffDelayMs(7))
        assertEquals(60_000L, SseClient.nextBackoffDelayMs(20))
    }

    @Test
    fun `duplicate commandId is not emitted twice`() = runTest {
        val cmdJson = """{"id":"dup-id","mediaType":"movie","mediaId":"m1","startPositionMs":0}"""
        val sseClient = mockk<SseClient>()
        coEvery { sseClient.commandStream() } returns flowOf(cmdJson, cmdJson)

        val apiClient = mockk<com.iptvflix.androidtv.network.ApiClient>()
        coEvery { apiClient.post(any(), any()) } returns ""
        coEvery { apiClient.get(any()) } returns "[]"

        val emitted = mutableListOf<PlaybackCommand>()
        val repo = CommandRepository(sseClient, apiClient, onRevoked = {})

        // Collect only one emission — repository deduplicates
        val cmd = repo.commands().first()
        emitted.add(cmd)

        assertEquals(1, emitted.size)
        assertEquals("dup-id", emitted[0].id)
    }
}
