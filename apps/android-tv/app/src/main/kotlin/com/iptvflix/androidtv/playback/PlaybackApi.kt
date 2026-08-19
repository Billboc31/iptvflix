package com.iptvflix.androidtv.playback

import com.iptvflix.androidtv.BuildConfig
import com.iptvflix.androidtv.network.ApiClient
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

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
    val deliveryMode: String = "DIRECT",
    val containerExtension: String? = null,
    val drmConfig: DrmConfig? = null,
    val tracks: List<TrackInfo> = emptyList(),
    val startPositionMs: Long = 0L,
)

@Serializable
private data class PlaybackSessionResponse(
    val gatewayUrl: String,
    val deliveryMode: String,
    val containerExtension: String? = null,
    val availabilityId: String,
    val startPositionSeconds: Double = 0.0,
)

class PlaybackApi(private val apiClient: ApiClient) {

    private val json = Json { ignoreUnknownKeys = true }

    suspend fun resolvePlayback(
        mediaType: String,
        mediaId: String,
        availabilityId: String?,
        startPositionMs: Long = 0L,
    ): PlaybackDescriptor {
        val body = buildJsonObject {
            put("clientType", "android-tv")
            availabilityId?.let { put("availabilityId", it) }
        }.toString()
        val responseBody = apiClient.post("/playback/resolve/$mediaType/$mediaId", body)
        val session = json.decodeFromString<PlaybackSessionResponse>(responseBody)
        val resumeMs = (session.startPositionSeconds * 1000).toLong().coerceAtLeast(startPositionMs)
        return PlaybackDescriptor(
            streamUrl = resolveGatewayUrl(session.gatewayUrl),
            deliveryMode = session.deliveryMode,
            containerExtension = session.containerExtension,
            startPositionMs = resumeMs,
        )
    }

    /**
     * Native TV playback: Railway gateway redirects (302) to the Xtream URL.
     * ExoPlayer follows the redirect and reads the provider stream directly — no Mac relay.
     */
    private fun resolveGatewayUrl(path: String): String {
        if (path.startsWith("http://") || path.startsWith("https://")) return path
        val base = BuildConfig.API_BASE_URL.trimEnd('/')
        var normalized = if (path.startsWith("/")) path else "/$path"
        if (normalized.startsWith("/api/")) normalized = normalized.removePrefix("/api")
        return "$base$normalized"
    }
}
