package com.iptvflix.androidtv.playback

import com.iptvflix.androidtv.network.ApiClient
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

// ASSUMPTION: route shape from #99 — GET /playback/{mediaType}/{mediaId}?availabilityId=…
// If the route differs in #99, only this file changes.

@Serializable
data class DrmConfig(
    val schemeUuid: String,
    val licenseUrl: String,
)

@Serializable
data class TrackInfo(
    val id: String,
    val label: String,
    val language: String? = null,
    val type: String, // "audio" | "subtitle"
)

@Serializable
data class PlaybackDescriptor(
    val streamUrl: String,
    val drmConfig: DrmConfig? = null,
    val tracks: List<TrackInfo> = emptyList(),
)

class PlaybackApi(private val apiClient: ApiClient) {

    private val json = Json { ignoreUnknownKeys = true }

    suspend fun resolvePlayback(
        mediaType: String,
        mediaId: String,
        availabilityId: String?,
    ): PlaybackDescriptor {
        val query = if (availabilityId != null) "?availabilityId=$availabilityId" else ""
        val body = apiClient.get("/playback/$mediaType/$mediaId$query")
        return json.decodeFromString(body)
    }
}
