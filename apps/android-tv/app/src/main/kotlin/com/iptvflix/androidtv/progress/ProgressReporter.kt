package com.iptvflix.androidtv.progress

import android.util.Log
import androidx.media3.common.Player
import com.iptvflix.androidtv.network.ApiClient
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay

private const val TAG = "ProgressReporter"
private const val REPORT_INTERVAL_MS = 15_000L

class ProgressReporter(
    private val mediaType: String,
    private val mediaId: String,
    private val player: Player,
    private val apiClient: ApiClient,
) {
    suspend fun start() {
        try {
            while (true) {
                delay(REPORT_INTERVAL_MS)
                if (player.isPlaying) report()
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.w(TAG, "Progress loop error: ${e.message}")
        }
    }

    suspend fun reportNow() {
        report()
    }

    private suspend fun report() {
        val positionMs = runCatching { player.currentPosition }.getOrDefault(0L)
        val durationMs = runCatching { player.duration }.getOrDefault(0L)
        if (positionMs <= 0L) return
        runCatching {
            val body = """{"progressSeconds":${positionMs / 1000L},"durationSeconds":${maxOf(durationMs, 0L) / 1000L}}"""
            apiClient.put("/progress/$mediaType/$mediaId", body)
        }.onFailure { e ->
            Log.w(TAG, "Progress report failed: ${e.message}")
        }
    }
}
