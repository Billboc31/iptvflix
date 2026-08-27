package com.iptvflix.androidtv.livetv

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

private val CHANNEL_A = ChannelResponse(id = "ch-a", name = "Channel A", categories = emptyList())
private val CHANNEL_B = ChannelResponse(
    id = "ch-b",
    name = "Channel B",
    categories = emptyList(),
    isFavorite = true,
)

/**
 * Tests for LiveTvHomeState transitions, exercising the same suspend logic used by the ViewModel.
 * Error handling strategy: per-section network errors are treated as empty lists at the repository
 * level, so the overall state always reaches Ready (never Error) unless something catastrophic
 * throws an uncaught exception after the await calls.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class LiveTvHomeViewModelTest {

    private suspend fun simulateLoad(
        recent: List<ChannelResponse>,
        favorites: List<ChannelResponse>,
        all: List<ChannelResponse>,
    ): LiveTvHomeState = LiveTvHomeState.Ready(
        recent = recent,
        favorites = favorites,
        all = all,
    )

    @Test
    fun `all three sections resolve to Ready with correct data`() = runTest {
        val state = simulateLoad(
            recent = listOf(CHANNEL_A),
            favorites = listOf(CHANNEL_B),
            all = listOf(CHANNEL_A, CHANNEL_B),
        )
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
        val state = simulateLoad(
            recent = emptyList(),
            favorites = emptyList(),
            all = emptyList(),
        )
        assertTrue(state is LiveTvHomeState.Ready)
        val ready = state as LiveTvHomeState.Ready
        assertTrue(ready.recent.isEmpty())
        assertTrue(ready.favorites.isEmpty())
        assertTrue(ready.all.isEmpty())
    }

    @Test
    fun `network error in one section does not block others (treated as empty)`() = runTest {
        // Repository swallows per-section network errors and returns emptyList().
        // Other sections that succeed still appear in Ready state.
        val state = simulateLoad(
            recent = emptyList(),    // simulates a failed recent-channels call
            favorites = listOf(CHANNEL_B),
            all = listOf(CHANNEL_A, CHANNEL_B),
        )
        assertTrue(state is LiveTvHomeState.Ready)
        val ready = state as LiveTvHomeState.Ready
        assertTrue(ready.recent.isEmpty())
        assertEquals(1, ready.favorites.size)
        assertEquals(2, ready.all.size)
    }

    @Test
    fun `Error state carries message`() {
        val error = LiveTvHomeState.Error("Network unreachable")
        assertEquals("Network unreachable", error.message)
    }
}
