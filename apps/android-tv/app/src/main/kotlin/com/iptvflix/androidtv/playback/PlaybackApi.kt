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

private const val XTREAM_USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

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

        val streamUrl = resolveDirectStreamUrl(gatewayUrl)
        val resumeMs = (session.startPositionSeconds * 1000).toLong().coerceAtLeast(startPositionMs)
        return PlaybackDescriptor(
            streamUrl = streamUrl,
            deliveryMode = session.deliveryMode,
            containerExtension = session.containerExtension,
            startPositionMs = resumeMs,
        )
    }

    /**
     * Follow Railway 302 → Xtream CDN → origin (often cleartext HTTP).
     * ExoPlayer then opens the final URL with a browser UA.
     */
    private suspend fun resolveDirectStreamUrl(gatewayUrl: String): String {
        if (!gatewayUrl.contains("/playback/stream/")) return gatewayUrl
        return withContext(Dispatchers.IO) {
            val client = apiClient.httpClient.newBuilder()
                .followRedirects(true)
                .followSslRedirects(true)
                .build()

            val request = Request.Builder()
                .url(gatewayUrl)
                .get()
                .header("Range", "bytes=0-0")
                .header("User-Agent", XTREAM_USER_AGENT)
                .header("Accept", "*/*")
                .header("X-Client-Type", "android-tv")
                .build()

            client.newCall(request).execute().use { response ->
                val finalUrl = response.request.url.toString()
                Log.d(TAG, "Resolved playback URL host=${response.request.url.host} code=${response.code}")
                when {
                    response.isSuccessful || response.code == 206 -> finalUrl
                    response.isRedirect -> response.header("Location") ?: gatewayUrl
                    else -> {
                        Log.w(TAG, "Unexpected resolve status ${response.code}, falling back to gateway")
                        gatewayUrl
                    }
                }
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
