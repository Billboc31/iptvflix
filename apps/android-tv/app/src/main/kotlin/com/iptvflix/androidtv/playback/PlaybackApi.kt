package com.iptvflix.androidtv.playback

import android.util.Log
import com.iptvflix.androidtv.BuildConfig
import com.iptvflix.androidtv.network.ApiClient
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Request

private const val TAG = "PlaybackApi"

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

        val path = "/playback/resolve/$mediaType/$mediaId?clientType=android-tv"
        val responseBody = apiClient.post(path, body, clientType = "android-tv")
        val session = json.decodeFromString<PlaybackSessionResponse>(responseBody)

        val gatewayUrl = resolveGatewayUrl(session.gatewayUrl)
        if (isMediaRelayUrl(gatewayUrl)) {
            Log.e(TAG, "API returned media-relay URL — deploy may be pending: $gatewayUrl")
            error("Lecture directe indisponible (serveur en mise à jour). Réessayez dans 2 minutes.")
        }

        val streamUrl = resolveDirectStreamUrl(gatewayUrl, session.containerExtension)
        val resumeMs = (session.startPositionSeconds * 1000).toLong().coerceAtLeast(startPositionMs)
        return PlaybackDescriptor(
            streamUrl = streamUrl,
            deliveryMode = session.deliveryMode,
            containerExtension = session.containerExtension,
            startPositionMs = resumeMs,
        )
    }

    /**
     * Railway gateway redirects (302) to the Xtream URL.
     * Resolve the redirect once so ExoPlayer reads the provider stream directly — no Mac relay.
     */
    private suspend fun resolveDirectStreamUrl(gatewayUrl: String, containerExtension: String?): String {
        if (!gatewayUrl.contains("/playback/stream/")) return gatewayUrl
        return withContext(Dispatchers.IO) {
            val noRedirectClient = apiClient.httpClient.newBuilder()
                .followRedirects(false)
                .followSslRedirects(false)
                .build()

            val request = Request.Builder()
                .url(gatewayUrl)
                .get()
                .header("Range", "bytes=0-0")
                .header("X-Client-Type", "android-tv")
                .build()

            noRedirectClient.newCall(request).execute().use { response ->
                when (response.code) {
                    301, 302, 303, 307, 308 -> {
                        val location = response.header("Location")
                        if (!location.isNullOrBlank()) {
                            Log.d(TAG, "Resolved Xtream redirect for native playback")
                            return@withContext location
                        }
                    }
                    200, 206 -> {
                        Log.d(TAG, "Gateway serves stream directly")
                        return@withContext gatewayUrl
                    }
                    else -> Log.w(TAG, "Unexpected gateway response ${response.code}, using gateway URL")
                }
                gatewayUrl
            }
        }
    }

    private fun isMediaRelayUrl(url: String): Boolean {
        val lower = url.lowercase()
        return lower.contains("/v1/play") ||
            lower.contains("lhr.life") ||
            lower.contains("localhost.run") ||
            (lower.contains("ticket=") && !lower.contains("/playback/stream/"))
    }

    private fun resolveGatewayUrl(path: String): String {
        if (path.startsWith("http://") || path.startsWith("https://")) return path
        val base = BuildConfig.API_BASE_URL.trimEnd('/')
        var normalized = if (path.startsWith("/")) path else "/$path"
        if (normalized.startsWith("/api/")) normalized = normalized.removePrefix("/api")
        return "$base$normalized"
    }
}
