package com.iptvflix.androidtv.progress

import android.util.Log
import androidx.media3.common.C
import androidx.media3.common.Player
import com.iptvflix.androidtv.network.ApiClient
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay

private const val TAG = "ProgressReporter"
private const val FIRST_REPORT_MS = 5_000L
private const val REPORT_INTERVAL_MS = 10_000L

class ProgressReporter(
    mediaType: String,
    private val mediaId: String,
    private val player: Player,
    private val apiClient: ApiClient,
) {
    // API requires MOVIE | EPISODE (commands SSE use lowercase movie|episode).
    private val apiMediaType = when (mediaType.trim().lowercase()) {
        "movie", "movies" -> "MOVIE"
        "episode", "episodes", "series" -> "EPISODE"
        else -> mediaType.trim().uppercase()
    }

    suspend fun start() {
        try {
            delay(FIRST_REPORT_MS)
            report(force = true)
            while (true) {
                delay(REPORT_INTERVAL_MS)
                if (player.isPlaying || player.playbackState == Player.STATE_READY) {
                    report(force = false)
                }
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.w(TAG, "Progress loop error: ${e.message}")
        }
    }

    suspend fun reportNow() {
        report(force = true)
    }

    private suspend fun report(force: Boolean) {
        val positionMs = runCatching { player.currentPosition }.getOrDefault(0L).coerceAtLeast(0L)
        val rawDuration = runCatching { player.duration }.getOrDefault(C.TIME_UNSET)
        val durationMs = if (rawDuration == C.TIME_UNSET || rawDuration <= 0L) 0L else rawDuration

        // Wait until we have a real duration — API rejects durationSeconds <= 0,
        // and ExoPlayer often reports TIME_UNSET for progressive MKV at start.
        if (durationMs <= 0L) {
            Log.d(TAG, "Skip progress: duration unknown (pos=${positionMs}ms)")
            return
        }

        val progressSeconds = (positionMs / 1000L).toInt().coerceAtLeast(if (force) 1 else 0)
        if (progressSeconds <= 0 && !force) return

        val durationSeconds = (durationMs / 1000L).toInt().coerceAtLeast(1)
        val clampedProgress = progressSeconds.coerceIn(1, durationSeconds)

        val path = "/progress/$apiMediaType/$mediaId"
        val body = """{"progressSeconds":$clampedProgress,"durationSeconds":$durationSeconds}"""
        runCatching {
            val ok = apiClient.put(path, body)
            if (!ok) {
                Log.w(TAG, "Progress PUT rejected for $path body=$body")
            } else {
                Log.d(TAG, "Progress saved $clampedProgress/$durationSeconds ($apiMediaType)")
            }
        }.onFailure { e ->
            Log.w(TAG, "Progress report failed: ${e.message}")
        }
    }
}
