package com.iptvflix.androidtv.player

import com.iptvflix.androidtv.livetv.ChannelRepository
import com.iptvflix.androidtv.livetv.ChannelResponse
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ChannelZappingTest {

    private val testDispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeChannels(count: Int): List<ChannelResponse> =
        (1..count).map { ChannelResponse(id = "ch-$it", name = "Channel $it") }

    private fun makeZapper(
        channels: List<ChannelResponse>,
        scope: TestScope,
        onSwitch: (ChannelResponse) -> Unit = {},
    ): ChannelZapper {
        val repo = mockk<ChannelRepository>()
        coEvery { repo.allChannels() } returns channels
        return ChannelZapper(repo, scope, onSwitch)
    }

    @Test
    fun `zapNext advances index and calls switchChannel with correct channel`() = runTest {
        val channels = makeChannels(3)
        val switched = mutableListOf<ChannelResponse>()
        val zapper = makeZapper(channels, this) { switched.add(it) }

        zapper.initZapContext("ch-1")
        zapper.zapNext()
        advanceTimeBy(ChannelZapper.DEBOUNCE_MS + 1)

        assertEquals(1, switched.size)
        assertEquals("ch-2", switched[0].id)
    }

    @Test
    fun `zapPrevious decrements index and calls switchChannel with correct channel`() = runTest {
        val channels = makeChannels(3)
        val switched = mutableListOf<ChannelResponse>()
        val zapper = makeZapper(channels, this) { switched.add(it) }

        zapper.initZapContext("ch-2")
        zapper.zapPrevious()
        advanceTimeBy(ChannelZapper.DEBOUNCE_MS + 1)

        assertEquals(1, switched.size)
        assertEquals("ch-1", switched[0].id)
    }

    @Test
    fun `zapNext at last index wraps around to first channel`() = runTest {
        val channels = makeChannels(3)
        val switched = mutableListOf<ChannelResponse>()
        val zapper = makeZapper(channels, this) { switched.add(it) }

        zapper.initZapContext("ch-3")
        zapper.zapNext()
        advanceTimeBy(ChannelZapper.DEBOUNCE_MS + 1)

        assertEquals(1, switched.size)
        assertEquals("ch-1", switched[0].id)
    }

    @Test
    fun `zapPrevious at first index wraps around to last channel`() = runTest {
        val channels = makeChannels(3)
        val switched = mutableListOf<ChannelResponse>()
        val zapper = makeZapper(channels, this) { switched.add(it) }

        zapper.initZapContext("ch-1")
        zapper.zapPrevious()
        advanceTimeBy(ChannelZapper.DEBOUNCE_MS + 1)

        assertEquals(1, switched.size)
        assertEquals("ch-3", switched[0].id)
    }

    @Test
    fun `rapid zapNext calls result in exactly one switchChannel call (the last)`() = runTest {
        val channels = makeChannels(5)
        val switched = mutableListOf<ChannelResponse>()
        val zapper = makeZapper(channels, this) { switched.add(it) }

        zapper.initZapContext("ch-1")
        zapper.zapNext() // index → 2 (ch-2), job1 scheduled
        zapper.zapNext() // index → 3 (ch-3), job1 cancelled, job2 scheduled
        advanceTimeBy(ChannelZapper.DEBOUNCE_MS + 1)

        assertEquals(1, switched.size)
        assertEquals("ch-3", switched[0].id)
    }

    @Test
    fun `failed playback reverts zapIndex to last good channel and subsequent zap works`() = runTest {
        val channels = makeChannels(4)
        val switched = mutableListOf<ChannelResponse>()
        val zapper = makeZapper(channels, this) { switched.add(it) }

        zapper.initZapContext("ch-1")
        zapper.notifyPlaybackSuccess() // ch-1 is the confirmed good position

        // Zap to ch-2, then simulate failure
        zapper.zapNext()
        advanceTimeBy(ChannelZapper.DEBOUNCE_MS + 1)
        assertEquals("ch-2", switched[0].id)
        zapper.notifyPlaybackError() // revert to ch-1

        // Subsequent zap must work from the last good index (ch-1)
        zapper.zapNext()
        advanceTimeBy(ChannelZapper.DEBOUNCE_MS + 1)

        assertEquals(2, switched.size)
        assertEquals("ch-2", switched[1].id)
    }

    @Test
    fun `initZapContext called twice only fetches channel list once`() = runTest {
        val channels = makeChannels(3)
        val repo = mockk<ChannelRepository>()
        coEvery { repo.allChannels() } returns channels
        val zapper = ChannelZapper(repo, this, {})

        zapper.initZapContext("ch-1")
        zapper.initZapContext("ch-2")

        coVerify(exactly = 1) { repo.allChannels() }
    }

    @Test
    fun `initZapContext second call updates index to new channel`() = runTest {
        val channels = makeChannels(3)
        val switched = mutableListOf<ChannelResponse>()
        val zapper = makeZapper(channels, this) { switched.add(it) }

        zapper.initZapContext("ch-1")
        zapper.initZapContext("ch-3") // update index to ch-3 without refetching list
        zapper.zapPrevious()
        advanceTimeBy(ChannelZapper.DEBOUNCE_MS + 1)

        assertEquals(1, switched.size)
        assertEquals("ch-2", switched[0].id)
    }

    @Test
    fun `initZapContext with unknown channelId defaults to index 0`() = runTest {
        val channels = makeChannels(3)
        val switched = mutableListOf<ChannelResponse>()
        val zapper = makeZapper(channels, this) { switched.add(it) }

        zapper.initZapContext("unknown-channel")
        zapper.zapNext()
        advanceTimeBy(ChannelZapper.DEBOUNCE_MS + 1)

        // From index 0 (ch-1), zapNext → ch-2
        assertEquals(1, switched.size)
        assertEquals("ch-2", switched[0].id)
    }

    @Test
    fun `zapHudChannel is set immediately on zap start before debounce completes`() = runTest {
        val channels = makeChannels(3)
        val zapper = makeZapper(channels, this)

        zapper.initZapContext("ch-1")
        assertNull(zapper.hudChannel.value)

        zapper.zapNext()
        // HUD is set immediately, before the debounce delay fires
        assertEquals("ch-2", zapper.hudChannel.value?.id)
    }

    @Test
    fun `clearHud sets zapHudChannel to null`() = runTest {
        val channels = makeChannels(3)
        val zapper = makeZapper(channels, this)

        zapper.initZapContext("ch-1")
        zapper.zapNext()
        assertEquals("ch-2", zapper.hudChannel.value?.id)

        zapper.clearHud()
        assertNull(zapper.hudChannel.value)
    }

    @Test
    fun `zapping before initZapContext is a no-op`() = runTest {
        val channels = makeChannels(3)
        val switched = mutableListOf<ChannelResponse>()
        val zapper = makeZapper(channels, this) { switched.add(it) }

        // No initZapContext call
        zapper.zapNext()
        advanceTimeBy(ChannelZapper.DEBOUNCE_MS + 1)

        assertEquals(0, switched.size)
        assertNull(zapper.hudChannel.value)
    }
}
