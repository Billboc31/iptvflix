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
    val availabilityId: String? = null,
    val alternatives: List<AvailabilityVariant> = emptyList(),
)

@Serializable
private data class PlaybackSessionResponse(
    val gatewayUrl: String,
    val deliveryMode: String,
    val containerExtension: String? = null,
    val availabilityId: String,
    val startPositionSeconds: Double = 0.0,
    val alternatives: List<AvailabilityVariant> = emptyList(),
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

        // Only resolve the Railway 302 → provider URL. Do NOT download bytes here —
        // following CDN redirects with Range can poison the session and crash ExoPlayer.
        val streamUrl = resolveGatewayRedirect(gatewayUrl)
        val resumeMs = (session.startPositionSeconds * 1000).toLong().coerceAtLeast(startPositionMs)
        val selected = session.alternatives.find { it.id == session.availabilityId }
        val alternatives = buildList {
            if (selected != null) add(selected)
            session.alternatives.filter { it.id != session.availabilityId }.forEach { add(it) }
            if (isEmpty() && session.availabilityId.isNotBlank()) {
                add(
                    AvailabilityVariant(
                        id = session.availabilityId,
                        rawTitle = "Source actuelle",
                    ),
                )
            }
        }
        return PlaybackDescriptor(
            streamUrl = streamUrl,
            deliveryMode = session.deliveryMode,
            containerExtension = session.containerExtension,
            startPositionMs = resumeMs,
            availabilityId = session.availabilityId,
            alternatives = alternatives,
        )
    }

    private suspend fun resolveGatewayRedirect(gatewayUrl: String): String {
        if (!gatewayUrl.contains("/playback/stream/")) return gatewayUrl
        return withContext(Dispatchers.IO) {
            val client = apiClient.httpClient.newBuilder()
                .followRedirects(false)
                .followSslRedirects(false)
                .build()

            val request = Request.Builder()
                .url(gatewayUrl)
                .head()
                .header("X-Client-Type", "android-tv")
                .build()

            runCatching {
                client.newCall(request).execute().use { response ->
                    when (response.code) {
                        301, 302, 303, 307, 308 -> {
                            val location = response.header("Location")
                            if (!location.isNullOrBlank()) {
                                Log.d(TAG, "Gateway redirect → ${response.request.url.host}")
                                return@withContext location
                            }
                        }
                    }
                    gatewayUrl
                }
            }.getOrElse {
                // Some gateways reject HEAD — fall back to GET without following.
                val getReq = Request.Builder()
                    .url(gatewayUrl)
                    .get()
                    .header("X-Client-Type", "android-tv")
                    .build()
                client.newCall(getReq).execute().use { response ->
                    response.header("Location")?.takeIf { it.isNotBlank() } ?: gatewayUrl
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
