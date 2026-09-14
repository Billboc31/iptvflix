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
    val episodeId: String = "",
    val segments: List<EpisodeSegmentItem> = emptyList(),
)

class SegmentsApi(private val apiClient: ApiClient) {

    private val json = Json { ignoreUnknownKeys = true }

    suspend fun fetchEpisodeSegments(episodeId: String, durationSeconds: Double? = null, mediaType: String = "episode", availabilityId: String? = null): List<EpisodeSegmentItem> =
        runCatching {
            val params = mutableListOf<String>()
            durationSeconds?.takeIf { it.isFinite() && it > 0 }?.let { params.add("durationSeconds=$it") }
            availabilityId?.takeIf { it.matches(Regex("[0-9a-fA-F-]{36}")) }?.let { params.add("availabilityId=$it") }
            val query = if (params.isEmpty()) "" else "?" + params.joinToString("&")
            val collection = if (mediaType.equals("movie", true)) "movies" else "episodes"
            val body = apiClient.get("/$collection/$episodeId/segments$query")
            json.decodeFromString<EpisodeSegmentsResponse>(body).segments
        }.getOrDefault(emptyList())
}
