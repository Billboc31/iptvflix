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

private val CHANNEL_A = ChannelResponse(id = "ch-a", name = "Channel A", categories = emptyList())
private val CHANNEL_B = ChannelResponse(
    id = "ch-b",
    name = "Channel B",
    categories = emptyList(),
    isFavorite = true,
)

@OptIn(ExperimentalCoroutinesApi::class)
class LiveTvHomeViewModelTest {

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
    fun `all three sections resolve to Ready with correct data`() = runTest {
        val repo = mockk<ChannelRepository>()
        coEvery { repo.recentChannels() } returns listOf(CHANNEL_A)
        coEvery { repo.favoriteChannels() } returns listOf(CHANNEL_B)
        coEvery { repo.allChannels() } returns listOf(CHANNEL_A, CHANNEL_B)

        val vm = LiveTvHomeViewModel(repo)
        val state = vm.state.value

        assertTrue(state is LiveTvHomeState.Ready)
        val ready = state as LiveTvHomeState.Ready
        assertEquals(1, ready.recent.size)
        assertEquals("ch-a", ready.recent.first().id)
        assertEquals(1, ready.favorites.size)
        assertEquals("ch-b", ready.favorites.first().id)
        assertEquals(2, ready.all.size)
    }

    @Test
    fun `all three sections empty resolves to Ready with empty lists, not Error`() = runTest {
        val repo = mockk<ChannelRepository>()
        coEvery { repo.recentChannels() } returns emptyList()
        coEvery { repo.favoriteChannels() } returns emptyList()
        coEvery { repo.allChannels() } returns emptyList()

        val vm = LiveTvHomeViewModel(repo)
        val state = vm.state.value

        assertTrue(state is LiveTvHomeState.Ready)
        val ready = state as LiveTvHomeState.Ready
        assertTrue(ready.recent.isEmpty())
        assertTrue(ready.favorites.isEmpty())
        assertTrue(ready.all.isEmpty())
    }

    @Test
    fun `failed section treated as empty does not block other sections`() = runTest {
        val repo = mockk<ChannelRepository>()
        coEvery { repo.recentChannels() } returns emptyList()
        coEvery { repo.favoriteChannels() } returns listOf(CHANNEL_B)
        coEvery { repo.allChannels() } returns listOf(CHANNEL_A, CHANNEL_B)

        val vm = LiveTvHomeViewModel(repo)
        val state = vm.state.value

        assertTrue(state is LiveTvHomeState.Ready)
        val ready = state as LiveTvHomeState.Ready
        assertTrue(ready.recent.isEmpty())
        assertEquals(1, ready.favorites.size)
        assertEquals(2, ready.all.size)
    }

    @Test
    fun `unexpected exception from repository results in Error state`() = runTest {
        val repo = mockk<ChannelRepository>()
        coEvery { repo.recentChannels() } throws RuntimeException("Network unreachable")
        coEvery { repo.favoriteChannels() } returns emptyList()
        coEvery { repo.allChannels() } returns emptyList()

        val vm = LiveTvHomeViewModel(repo)
        val state = vm.state.value

        assertTrue(state is LiveTvHomeState.Error)
        assertEquals("Network unreachable", (state as LiveTvHomeState.Error).message)
    }

    @Test
    fun `retry after error resolves to Ready on second attempt`() = runTest {
        val repo = mockk<ChannelRepository>()
        coEvery { repo.recentChannels() } throws RuntimeException("timeout") andThen listOf(CHANNEL_A)
        coEvery { repo.favoriteChannels() } returns emptyList()
        coEvery { repo.allChannels() } returns listOf(CHANNEL_B)

        val vm = LiveTvHomeViewModel(repo)
        assertTrue(vm.state.value is LiveTvHomeState.Error)

        vm.retry()
        assertTrue(vm.state.value is LiveTvHomeState.Ready)
        val ready = vm.state.value as LiveTvHomeState.Ready
        assertEquals(1, ready.recent.size)
        assertEquals("ch-a", ready.recent.first().id)
    }
}
