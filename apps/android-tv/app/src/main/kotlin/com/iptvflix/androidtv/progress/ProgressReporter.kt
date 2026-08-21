package com.iptvflix.androidtv.progress

import android.util.Log
import androidx.media3.common.C
import androidx.media3.common.Player
import com.iptvflix.androidtv.network.ApiClient
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlin.math.max

private const val TAG = "ProgressReporter"
private const val FIRST_REPORT_MS = 1_500L
private const val REPORT_INTERVAL_MS = 10_000L
/** Match web useProgressSync: ignore accidental regressions below the floor. */
private const val FLOOR_SLACK_S = 15
/** Align with API CW_MIN_PROGRESS_SECONDS — seed so CW keeps the title after a quick quit. */
private const val CW_SEED_SECONDS = 2
/**
 * Exo/HLS often reports a tiny fragment duration at start. Writing progress against
 * that marks the title 100% complete and drops it from Continuer à regarder.
 */
private const val MIN_RELIABLE_DURATION_MS = 120_000L

class ProgressReporter(
    mediaType: String,
    private val mediaId: String,
    private val player: Player,
    private val apiClient: ApiClient,
    /** Known resume / prior progress — prevents wiping continue-watching on early READY at 0. */
    initialFloorSeconds: Int = 0,
) {
    // API requires MOVIE | EPISODE (commands SSE use lowercase movie|episode).
    private val apiMediaType = when (mediaType.trim().lowercase()) {
        "movie", "movies" -> "MOVIE"
        "episode", "episodes", "series" -> "EPISODE"
        else -> mediaType.trim().uppercase()
    }

    @Volatile
    private var floorSeconds: Int = initialFloorSeconds.coerceAtLeast(0)

    suspend fun start() {
        try {
            delay(FIRST_REPORT_MS)
            reportFromPlayer(force = true)
            while (true) {
                delay(REPORT_INTERVAL_MS)
                if (player.isPlaying || player.playbackState == Player.STATE_READY) {
                    reportFromPlayer(force = false)
                }
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.w(TAG, "Progress loop error: ${e.message}")
        }
    }

    suspend fun reportNow() {
        reportFromPlayer(force = true)
    }

    /**
     * Flush an explicit position (e.g. Back / stop) before the player is torn down.
     * Always allowed to move the cursor (including scrubbing backwards).
     */
    suspend fun reportAt(positionMs: Long, durationMs: Long) {
        report(
            positionMs = positionMs.coerceAtLeast(0L),
            durationMs = durationMs,
            force = true,
            respectFloor = false,
        )
    }

    private suspend fun reportFromPlayer(force: Boolean) {
        val positionMs = runCatching { player.currentPosition }.getOrDefault(0L).coerceAtLeast(0L)
        val rawDuration = runCatching { player.duration }.getOrDefault(C.TIME_UNSET)
        val durationMs = if (rawDuration == C.TIME_UNSET || rawDuration <= 0L) 0L else rawDuration
        report(positionMs, durationMs, force = force, respectFloor = true)
    }

    private suspend fun report(
        positionMs: Long,
        durationMs: Long,
        force: Boolean,
        respectFloor: Boolean,
    ) {
        // Wait until we have a real duration — API rejects durationSeconds <= 0,
        // and ExoPlayer often reports TIME_UNSET for progressive MKV at start.
        if (durationMs <= 0L) {
            Log.d(TAG, "Skip progress: duration unknown (pos=${positionMs}ms)")
            return
        }
        if (durationMs < MIN_RELIABLE_DURATION_MS) {
            Log.d(
                TAG,
                "Skip progress: duration ${durationMs}ms looks like a fragment " +
                    "(need ≥${MIN_RELIABLE_DURATION_MS}ms)",
            )
            return
        }

        val progressSeconds = (positionMs / 1000L).toInt().coerceAtLeast(if (force) 1 else 0)
        if (progressSeconds <= 0 && !force) return

        if (respectFloor && floorSeconds > 0 && progressSeconds < floorSeconds - FLOOR_SLACK_S) {
            Log.d(
                TAG,
                "Skip regressive progress ${progressSeconds}s < floor ${floorSeconds}s " +
                    "(keeps continue-watching)",
            )
            return
        }

        val durationSeconds = (durationMs / 1000L).toInt().coerceAtLeast(1)
        // Bump tiny positions to the CW eligibility floor so "next episode → quit"
        // still leaves the title in Continuer à regarder.
        val effectiveProgress = when {
            force && progressSeconds in 1 until CW_SEED_SECONDS -> CW_SEED_SECONDS
            else -> progressSeconds
        }.coerceIn(1, durationSeconds)

        val path = "/progress/$apiMediaType/$mediaId"
        val body = """{"progressSeconds":$effectiveProgress,"durationSeconds":$durationSeconds}"""
        runCatching {
            val ok = apiClient.put(path, body)
            if (!ok) {
                Log.w(TAG, "Progress PUT rejected for $path body=$body")
            } else {
                floorSeconds = max(floorSeconds, effectiveProgress)
                Log.d(TAG, "Progress saved $effectiveProgress/$durationSeconds ($apiMediaType)")
            }
        }.onFailure { e ->
            Log.w(TAG, "Progress report failed: ${e.message}")
        }
    }
}
