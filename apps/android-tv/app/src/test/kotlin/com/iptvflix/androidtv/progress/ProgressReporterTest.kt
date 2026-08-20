package com.iptvflix.androidtv.progress

import androidx.media3.common.C
import androidx.media3.common.Player
import com.iptvflix.androidtv.network.ApiClient
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runTest
import org.junit.Test

class ProgressReporterTest {

    private fun makePlayer(isPlaying: Boolean, positionMs: Long = 60_000L, durationMs: Long = 3_600_000L): Player {
        val player = mockk<Player>()
        every { player.isPlaying } returns isPlaying
        every { player.playbackState } returns if (isPlaying) Player.STATE_READY else Player.STATE_IDLE
        every { player.currentPosition } returns positionMs
        every { player.duration } returns durationMs
        return player
    }

    @Test
    fun `progress PUT uses uppercase MOVIE path`() = runTest {
        val player = makePlayer(isPlaying = true)
        val apiClient = mockk<ApiClient>()
        coEvery { apiClient.put(any(), any()) } returns true

        val reporter = ProgressReporter("movie", "m1", player, apiClient)
        val job = launch { reporter.start() }

        advanceTimeBy(6_000L)
        job.cancel()

        coVerify(atLeast = 1) { apiClient.put(match { it.contains("/progress/MOVIE/m1") }, any()) }
    }

    @Test
    fun `progress PUT is skipped while duration is unknown`() = runTest {
        val player = makePlayer(isPlaying = true, durationMs = C.TIME_UNSET)
        val apiClient = mockk<ApiClient>()
        coEvery { apiClient.put(any(), any()) } returns true

        val reporter = ProgressReporter("movie", "m2", player, apiClient)
        val job = launch { reporter.start() }

        advanceTimeBy(20_000L)
        job.cancel()

        coVerify(exactly = 0) { apiClient.put(any(), any()) }
    }

    @Test
    fun `reportNow calls PUT once immediately`() = runTest {
        val player = makePlayer(isPlaying = true)
        val apiClient = mockk<ApiClient>()
        coEvery { apiClient.put(any(), any()) } returns true

        val reporter = ProgressReporter("episode", "ep1", player, apiClient)
        reporter.reportNow()

        coVerify(exactly = 1) { apiClient.put(match { it.contains("/progress/EPISODE/ep1") }, any()) }
    }

    @Test
    fun `progress PUT is called periodically while playing`() = runTest {
        val player = makePlayer(isPlaying = true)
        val apiClient = mockk<ApiClient>()
        coEvery { apiClient.put(any(), any()) } returns true

        val reporter = ProgressReporter("movie", "m3", player, apiClient)
        val job = launch { reporter.start() }

        advanceTimeBy(26_000L)
        job.cancel()

        coVerify(atLeast = 2) { apiClient.put(match { it.contains("/progress/MOVIE/m3") }, any()) }
    }
}
