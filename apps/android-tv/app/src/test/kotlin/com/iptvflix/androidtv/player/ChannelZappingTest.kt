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
    fun `previewNext shows carousel without switching channel`() = runTest {
        val channels = makeChannels(3)
        val switched = mutableListOf<ChannelResponse>()
        val zapper = makeZapper(channels, this) { switched.add(it) }

        zapper.initZapContext("ch-1")
        zapper.previewNext()

        assertEquals(0, switched.size)
        assertEquals("ch-2", zapper.previewState.value?.selectedChannel?.id)
        assertEquals(3, zapper.previewState.value?.window?.size)
    }

    @Test
    fun `confirmPreview switches to selected channel`() = runTest {
        val channels = makeChannels(3)
        val switched = mutableListOf<ChannelResponse>()
        val zapper = makeZapper(channels, this) { switched.add(it) }

        zapper.initZapContext("ch-1")
        zapper.previewNext()
        zapper.confirmPreview()

        assertEquals(1, switched.size)
        assertEquals("ch-2", switched[0].id)
        assertNull(zapper.previewState.value)
    }

    @Test
    fun `previewPrevious wraps around to last channel`() = runTest {
        val channels = makeChannels(3)
        val zapper = makeZapper(channels, this)

        zapper.initZapContext("ch-1")
        zapper.previewPrevious()

        assertEquals("ch-3", zapper.previewState.value?.selectedChannel?.id)
    }

    @Test
    fun `previewNext at last index wraps around to first channel`() = runTest {
        val channels = makeChannels(3)
        val zapper = makeZapper(channels, this)

        zapper.initZapContext("ch-3")
        zapper.previewNext()

        assertEquals("ch-1", zapper.previewState.value?.selectedChannel?.id)
    }

    @Test
    fun `confirmPreview on same channel does not switch`() = runTest {
        val channels = makeChannels(3)
        val switched = mutableListOf<ChannelResponse>()
        val zapper = makeZapper(channels, this) { switched.add(it) }

        zapper.initZapContext("ch-2")
        zapper.confirmPreview()

        assertEquals(0, switched.size)
        assertNull(zapper.previewState.value)
    }

    @Test
    fun `cancelPreview clears carousel without switching`() = runTest {
        val channels = makeChannels(3)
        val switched = mutableListOf<ChannelResponse>()
        val zapper = makeZapper(channels, this) { switched.add(it) }

        zapper.initZapContext("ch-1")
        zapper.previewNext()
        zapper.cancelPreview()

        assertEquals(0, switched.size)
        assertNull(zapper.previewState.value)
    }

    @Test
    fun `failed playback reverts index and subsequent preview works`() = runTest {
        val channels = makeChannels(4)
        val switched = mutableListOf<ChannelResponse>()
        val zapper = makeZapper(channels, this) { switched.add(it) }

        zapper.initZapContext("ch-1")
        zapper.notifyPlaybackSuccess("ch-1")

        zapper.previewNext()
        zapper.confirmPreview()
        assertEquals("ch-2", switched[0].id)
        zapper.notifyPlaybackError()

        zapper.previewNext()
        zapper.confirmPreview()
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
    fun `preview window contains three channels before and after selection`() = runTest {
        val channels = makeChannels(10)
        val zapper = makeZapper(channels, this)

        zapper.initZapContext("ch-5")
        zapper.previewNext()

        val window = zapper.previewState.value?.window.orEmpty()
        assertEquals(listOf("ch-3", "ch-4", "ch-5", "ch-6", "ch-7", "ch-8", "ch-9"), window.map { it.id })
        assertEquals("ch-6", zapper.previewState.value?.selectedChannel?.id)
    }

    @Test
    fun `confirmPreview does not commit index until playback succeeds`() = runTest {
        val channels = makeChannels(3)
        val switched = mutableListOf<ChannelResponse>()
        val zapper = makeZapper(channels, this) { switched.add(it) }

        zapper.initZapContext("ch-1")
        zapper.notifyPlaybackSuccess("ch-1")
        zapper.previewNext()
        zapper.confirmPreview()

        assertEquals(1, switched.size)
        assertEquals("ch-2", switched[0].id)
        // Still on ch-1 until the new stream reports READY.
        zapper.previewNext()
        zapper.confirmPreview()
        assertEquals(1, switched.size)
        zapper.notifyPlaybackSuccess("ch-2")
        zapper.previewNext()
        zapper.confirmPreview()
        assertEquals(2, switched.size)
    }

    @Test
    fun `preview window has no duplicate channels on small lists`() = runTest {
        val channels = makeChannels(4)
        val zapper = makeZapper(channels, this)

        zapper.initZapContext("ch-1")
        zapper.previewNext()

        val window = zapper.previewState.value?.window.orEmpty()
        assertEquals(window.size, window.distinctBy { it.id }.size)
        assertEquals("ch-1", zapper.previewState.value?.playingChannelId)
    }

    @Test
    fun `zapping before initZapContext is a no-op`() = runTest {
        val channels = makeChannels(3)
        val switched = mutableListOf<ChannelResponse>()
        val zapper = makeZapper(channels, this) { switched.add(it) }

        zapper.previewNext()

        assertEquals(0, switched.size)
        assertNull(zapper.previewState.value)
    }
}

class OverlayGuardTest {

    @Test
    fun `shouldZapChannel returns false when overlay is open`() {
        assertFalse(shouldZapChannel(isOverlayOpen = true, mediaType = "channel"))
    }

    @Test
    fun `shouldZapChannel returns false when overlay is open regardless of mediaType`() {
        assertFalse(shouldZapChannel(isOverlayOpen = true, mediaType = null))
        assertFalse(shouldZapChannel(isOverlayOpen = true, mediaType = "episode"))
    }

    @Test
    fun `shouldZapChannel returns false when overlay is closed but mediaType is not channel`() {
        assertFalse(shouldZapChannel(isOverlayOpen = false, mediaType = "episode"))
        assertFalse(shouldZapChannel(isOverlayOpen = false, mediaType = null))
    }

    @Test
    fun `shouldZapChannel returns true when overlay is closed and mediaType is channel`() {
        assertTrue(shouldZapChannel(isOverlayOpen = false, mediaType = "channel"))
    }

    @Test
    fun `shouldZapChannel mediaType comparison is case insensitive`() {
        assertTrue(shouldZapChannel(isOverlayOpen = false, mediaType = "CHANNEL"))
        assertTrue(shouldZapChannel(isOverlayOpen = false, mediaType = "Channel"))
    }
}
