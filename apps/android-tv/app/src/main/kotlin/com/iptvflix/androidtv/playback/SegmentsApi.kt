package com.iptvflix.androidtv.playback

import com.iptvflix.androidtv.network.ApiClient
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class EpisodeSegmentItem(
    val type: String,
    val startMs: Long,
    val endMs: Long,
    val autoSkipSafe: Boolean = false,
    val source: String? = null,
)

@Serializable
data class EpisodeSegmentsResponse(
    val episodeId: String,
    val segments: List<EpisodeSegmentItem> = emptyList(),
)

class SegmentsApi(private val apiClient: ApiClient) {

    private val json = Json { ignoreUnknownKeys = true }

    suspend fun fetchEpisodeSegments(episodeId: String, durationSeconds: Double? = null): List<EpisodeSegmentItem> =
        runCatching {
            val query = durationSeconds?.takeIf { it.isFinite() && it > 0 }?.let { "?durationSeconds=$it" } ?: ""
            val body = apiClient.get("/episodes/$episodeId/segments$query")
            json.decodeFromString<EpisodeSegmentsResponse>(body).segments
        }.getOrDefault(emptyList())
}
