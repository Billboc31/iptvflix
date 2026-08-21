package com.iptvflix.androidtv.playback

import com.iptvflix.androidtv.network.ApiClient
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class EpisodeSegmentItem(
    val type: String,
    val startMs: Long,
    val endMs: Long,
)

@Serializable
data class EpisodeSegmentsResponse(
    val episodeId: String,
    val segments: List<EpisodeSegmentItem> = emptyList(),
)

class SegmentsApi(private val apiClient: ApiClient) {

    private val json = Json { ignoreUnknownKeys = true }

    suspend fun fetchEpisodeSegments(episodeId: String): List<EpisodeSegmentItem> =
        runCatching {
            val body = apiClient.get("/episodes/$episodeId/segments")
            json.decodeFromString<EpisodeSegmentsResponse>(body).segments
        }.getOrDefault(emptyList())
}
