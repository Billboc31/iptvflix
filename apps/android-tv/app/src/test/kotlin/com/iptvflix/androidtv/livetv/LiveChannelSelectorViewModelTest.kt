package com.iptvflix.androidtv.livetv

import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

private val CHANNEL_NO_EPG = ChannelResponse(id = "ch-1", name = "Channel 1")
private val CHANNEL_WITH_EPG = ChannelResponse(
    id = "ch-2",
    name = "Channel 2",
    epg = ChannelEpg(
        now = EpgProgram(title = "Evening News", startTime = "20:00", endTime = "21:00"),
        next = null,
    ),
)

@OptIn(ExperimentalCoroutinesApi::class)
class LiveChannelSelectorViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `Ready state populated on successful load`() = runTest {
        val repo = mockk<ChannelRepository>()
        coEvery { repo.allChannels() } returns listOf(CHANNEL_NO_EPG, CHANNEL_WITH_EPG)

        val vm = LiveChannelSelectorViewModel(repo)
        val state = vm.state.value

        assertTrue(state is LiveChannelSelectorState.Ready)
        val ready = state as LiveChannelSelectorState.Ready
        assertEquals(2, ready.channels.size)
        assertEquals("ch-1", ready.channels[0].id)
        assertEquals("ch-2", ready.channels[1].id)
    }

    @Test
    fun `Empty channel list produces Ready with empty list, not Error`() = runTest {
        val repo = mockk<ChannelRepository>()
        coEvery { repo.allChannels() } returns emptyList()

        val vm = LiveChannelSelectorViewModel(repo)
        val state = vm.state.value

        assertTrue(state is LiveChannelSelectorState.Ready)
        val ready = state as LiveChannelSelectorState.Ready
        assertTrue(ready.channels.isEmpty())
    }

    @Test
    fun `Repository failure surfaces as Error`() = runTest {
        val repo = mockk<ChannelRepository>()
        coEvery { repo.allChannels() } throws RuntimeException("Network timeout")

        val vm = LiveChannelSelectorViewModel(repo)
        val state = vm.state.value

        assertTrue(state is LiveChannelSelectorState.Error)
        assertEquals("Network timeout", (state as LiveChannelSelectorState.Error).message)
    }

    @Test
    fun `Channels with and without EPG coexist in the same Ready list`() = runTest {
        val repo = mockk<ChannelRepository>()
        coEvery { repo.allChannels() } returns listOf(CHANNEL_NO_EPG, CHANNEL_WITH_EPG)

        val vm = LiveChannelSelectorViewModel(repo)
        val state = vm.state.value

        assertTrue(state is LiveChannelSelectorState.Ready)
        val ready = state as LiveChannelSelectorState.Ready
        val noEpg = ready.channels.first { it.id == "ch-1" }
        val withEpg = ready.channels.first { it.id == "ch-2" }
        assertEquals(null, noEpg.epg)
        assertEquals("Evening News", withEpg.epg?.now?.title)
    }
}
