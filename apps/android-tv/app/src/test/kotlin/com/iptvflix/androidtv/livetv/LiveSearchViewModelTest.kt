package com.iptvflix.androidtv.livetv

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

private val LIVE_NOW_A = LiveNowResult(
    channelId = "ch-tf1",
    channelName = "TF1",
    logoUrl = null,
    programTitle = "US Open – Finale",
    startTime = "2026-08-27T14:00:00Z",
    endTime = "2026-08-27T17:00:00Z",
    progress = 0.4f,
    streamUrl = "https://example.com/tf1.m3u8",
    deliveryMode = "HLS",
)

private val LIVE_NOW_B = LiveNowResult(
    channelId = "ch-eurosport",
    channelName = "Eurosport",
    logoUrl = null,
    programTitle = "US Open – Finale",
    startTime = "2026-08-27T14:00:00Z",
    endTime = "2026-08-27T17:00:00Z",
    progress = 0.4f,
    streamUrl = "https://example.com/eurosport.m3u8",
    deliveryMode = "HLS",
)

private val UPCOMING_A = UpcomingResult(
    channelId = "ch-tf1",
    channelName = "TF1",
    logoUrl = null,
    programTitle = "Fort Boyard",
    startTime = "2026-08-27T21:00:00Z",
    endTime = "2026-08-27T22:45:00Z",
)

private val CHANNEL_A = ChannelSearchResult(
    channelId = "ch-tf1",
    channelName = "TF1",
    logoUrl = null,
    categories = listOf("Généraliste"),
)

@OptIn(ExperimentalCoroutinesApi::class)
class LiveSearchViewModelTest {

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
    fun `channel-name query returns Results with channels, empty liveNow and upcoming`() = runTest {
        val repo = mockk<ChannelRepository>()
        coEvery { repo.searchLiveTV("TF1") } returns LiveSearchResponse(channels = listOf(CHANNEL_A))

        val vm = LiveSearchViewModel(repo)
        vm.onQueryChanged("TF1")
        advanceUntilIdle()

        val state = vm.state.value as LiveSearchState.Results
        assertTrue(state.channels.isNotEmpty())
        assertTrue(state.liveNow.isEmpty())
        assertTrue(state.upcoming.isEmpty())
    }

    @Test
    fun `program query with live match returns Results with liveNow, empty upcoming`() = runTest {
        val repo = mockk<ChannelRepository>()
        coEvery { repo.searchLiveTV("US Open") } returns LiveSearchResponse(liveNow = listOf(LIVE_NOW_A))

        val vm = LiveSearchViewModel(repo)
        vm.onQueryChanged("US Open")
        advanceUntilIdle()

        val state = vm.state.value as LiveSearchState.Results
        assertTrue(state.liveNow.isNotEmpty())
        assertTrue(state.upcoming.isEmpty())
    }

    @Test
    fun `program query with future match only returns Results with upcoming, empty liveNow`() = runTest {
        val repo = mockk<ChannelRepository>()
        coEvery { repo.searchLiveTV("Fort Boyard") } returns LiveSearchResponse(upcoming = listOf(UPCOMING_A))

        val vm = LiveSearchViewModel(repo)
        vm.onQueryChanged("Fort Boyard")
        advanceUntilIdle()

        val state = vm.state.value as LiveSearchState.Results
        assertTrue(state.upcoming.isNotEmpty())
        assertTrue(state.liveNow.isEmpty())
    }

    @Test
    fun `multiple live matches yields isSingleLiveNowResult false`() = runTest {
        val repo = mockk<ChannelRepository>()
        coEvery { repo.searchLiveTV("US Open") } returns LiveSearchResponse(liveNow = listOf(LIVE_NOW_A, LIVE_NOW_B))

        val vm = LiveSearchViewModel(repo)
        vm.onQueryChanged("US Open")
        advanceUntilIdle()

        assertTrue(vm.state.value is LiveSearchState.Results)
        assertFalse(vm.isSingleLiveNowResult)
    }

    @Test
    fun `single live match yields isSingleLiveNowResult true`() = runTest {
        val repo = mockk<ChannelRepository>()
        coEvery { repo.searchLiveTV("US Open") } returns LiveSearchResponse(liveNow = listOf(LIVE_NOW_A))

        val vm = LiveSearchViewModel(repo)
        vm.onQueryChanged("US Open")
        advanceUntilIdle()

        assertTrue(vm.state.value is LiveSearchState.Results)
        assertTrue(vm.isSingleLiveNowResult)
    }

    @Test
    fun `onVoiceResult with same text produces same state as onQueryChanged`() = runTest {
        val repo = mockk<ChannelRepository>()
        coEvery { repo.searchLiveTV("US Open") } returns LiveSearchResponse(liveNow = listOf(LIVE_NOW_A))

        val vm1 = LiveSearchViewModel(repo)
        vm1.onQueryChanged("US Open")
        advanceUntilIdle()
        val state1 = vm1.state.value

        val vm2 = LiveSearchViewModel(repo)
        vm2.onVoiceResult("US Open")
        advanceUntilIdle()
        val state2 = vm2.state.value

        assertEquals(state1, state2)
    }

    @Test
    fun `clearQuery resets state to Idle`() = runTest {
        val repo = mockk<ChannelRepository>()
        coEvery { repo.searchLiveTV("TF1") } returns LiveSearchResponse(channels = listOf(CHANNEL_A))

        val vm = LiveSearchViewModel(repo)
        vm.onQueryChanged("TF1")
        advanceUntilIdle()
        assertTrue(vm.state.value is LiveSearchState.Results)

        vm.clearQuery()
        assertTrue(vm.state.value is LiveSearchState.Idle)
    }

    @Test
    fun `API error results in Error state`() = runTest {
        val repo = mockk<ChannelRepository>()
        coEvery { repo.searchLiveTV(any()) } throws RuntimeException("Network error")

        val vm = LiveSearchViewModel(repo)
        vm.onQueryChanged("TF1")
        advanceUntilIdle()

        assertTrue(vm.state.value is LiveSearchState.Error)
    }

    @Test
    fun `empty query stays Idle and makes no API call`() = runTest {
        val repo = mockk<ChannelRepository>()

        val vm = LiveSearchViewModel(repo)
        vm.onQueryChanged("")
        advanceUntilIdle()

        assertTrue(vm.state.value is LiveSearchState.Idle)
        coVerify(exactly = 0) { repo.searchLiveTV(any()) }
    }

    @Test
    fun `after clearQuery isSingleLiveNowResult is false`() = runTest {
        val repo = mockk<ChannelRepository>()
        coEvery { repo.searchLiveTV("US Open") } returns LiveSearchResponse(liveNow = listOf(LIVE_NOW_A))

        val vm = LiveSearchViewModel(repo)
        vm.onQueryChanged("US Open")
        advanceUntilIdle()
        assertTrue(vm.isSingleLiveNowResult)

        vm.clearQuery()
        assertFalse(vm.isSingleLiveNowResult)
    }

    @Test
    fun `channel-name search without EPG still returns channels in Results`() = runTest {
        val repo = mockk<ChannelRepository>()
        coEvery { repo.searchLiveTV("TF1") } returns LiveSearchResponse(
            liveNow = emptyList(),
            upcoming = emptyList(),
            channels = listOf(CHANNEL_A),
        )

        val vm = LiveSearchViewModel(repo)
        vm.onQueryChanged("TF1")
        advanceUntilIdle()

        val state = vm.state.value as LiveSearchState.Results
        assertTrue(state.channels.isNotEmpty())
        assertEquals("ch-tf1", state.channels.first().channelId)
        assertTrue(state.liveNow.isEmpty())
        assertTrue(state.upcoming.isEmpty())
    }
}
