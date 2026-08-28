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
import java.util.concurrent.TimeUnit

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

@Serializable
private data class ChannelPlaybackResponse(
    val gatewayUrl: String,
    val deliveryMode: String = "DIRECT",
    val containerExtension: String? = null,
    val correlationId: String? = null,
)

class PlaybackApi(private val apiClient: ApiClient) {

    private val json = Json { ignoreUnknownKeys = true }

    suspend fun resolvePlayback(
        mediaType: String,
        mediaId: String,
        availabilityId: String?,
        startPositionMs: Long = 0L,
    ): PlaybackDescriptor {
        if (mediaType.equals("channel", ignoreCase = true)) {
            return resolveChannelPlayback(mediaId)
        }

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

    /** Live TV: POST /channels/{id}/playback/resolve (not the VOD /playback/resolve path). */
    private suspend fun resolveChannelPlayback(channelId: String): PlaybackDescriptor {
        val apiPath = "/channels/$channelId/playback/resolve"
        val responseBody = apiClient.post(apiPath, "{}", clientType = "android-tv")
        val session = json.decodeFromString<ChannelPlaybackResponse>(responseBody)
        if (session.gatewayUrl.isBlank()) {
            error("Chaîne indisponible pour le moment.")
        }

        val gatewayUrl = resolveGatewayUrl(session.gatewayUrl)
        // Live TV may return media-relay (/v1/play) — that is a valid delivery path,
        // unlike VOD where media-relay usually means a mis-deployed gateway.
        // /v1/play blocks until ffmpeg remux is ready then 302 → .m3u8. Resolve that
        // here so Exo gets a real playlist instead of hanging forever on /v1/play.
        val streamUrl = resolveGatewayRedirect(gatewayUrl)
        val host = runCatching { java.net.URI(streamUrl).host }.getOrNull() ?: "?"
        val streamPath = runCatching { java.net.URI(streamUrl).path }.getOrNull() ?: streamUrl.takeLast(48)
        Log.i(
            TAG,
            "Channel $channelId resolved mode=${session.deliveryMode} ext=${session.containerExtension} " +
                "corr=${session.correlationId} → $host$streamPath",
        )
        return PlaybackDescriptor(
            streamUrl = streamUrl,
            deliveryMode = when {
                streamUrl.contains(".m3u8", ignoreCase = true) ||
                    streamUrl.contains("/v1/hls/") -> "HLS_REMUX"
                else -> session.deliveryMode
            },
            containerExtension = session.containerExtension,
            startPositionMs = 0L,
            availabilityId = null,
            alternatives = emptyList(),
        )
    }

    private suspend fun resolveGatewayRedirect(gatewayUrl: String): String {
        if (isMediaRelayPlayUrl(gatewayUrl)) {
            return resolveMediaRelayPlaylist(gatewayUrl)
        }
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
                                val host = runCatching {
                                    java.net.URI(location).host
                                }.getOrNull() ?: location.take(64)
                                Log.d(TAG, "Gateway redirect → $host")
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

    /**
     * Media-relay `/v1/play` holds the HTTP response open until remux produces
     * `index.m3u8`, then 302s. Hand Exo the final playlist URL so playback can start.
     */
    private suspend fun resolveMediaRelayPlaylist(playUrl: String): String = withContext(Dispatchers.IO) {
        // Quick probe: dead localhost.run tunnels return 503 "no tunnel here" immediately.
        runCatching {
            val probeClient = apiClient.httpClient.newBuilder()
                .followRedirects(false)
                .connectTimeout(5, TimeUnit.SECONDS)
                .readTimeout(5, TimeUnit.SECONDS)
                .callTimeout(8, TimeUnit.SECONDS)
                .build()
            val base = playUrl.substringBefore("/v1/play").trimEnd('/')
            if (base.startsWith("http")) {
                probeClient.newCall(Request.Builder().url("$base/health").get().build()).execute().use { probe ->
                    val body = probe.body?.string().orEmpty()
                    if (probe.code == 503 || body.contains("no tunnel", ignoreCase = true)) {
                        error("Tunnel media-relay hors service — redémarrez le relais maison")
                    }
                }
            }
        }

        Log.i(TAG, "Media-relay remux starting (may take up to ~35s)…")
        val client = apiClient.httpClient.newBuilder()
            .followRedirects(true)
            .followSslRedirects(true)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(35, TimeUnit.SECONDS)
            .callTimeout(40, TimeUnit.SECONDS)
            .build()
        val request = Request.Builder()
            .url(playUrl)
            .get()
            .header(
                "User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            )
            .build()
        client.newCall(request).execute().use { response ->
            val finalUrl = response.request.url.toString()
            val safe = finalUrl.replace(Regex("ticket=[^&]+"), "ticket=…")
            Log.i(TAG, "Media-relay done code=${response.code} url=$safe")
            val errBody = if (!response.isSuccessful) {
                runCatching { response.body?.string()?.take(180) }.getOrNull()
            } else null
            if (!response.isSuccessful) {
                if (response.code == 503 || errBody.orEmpty().contains("no tunnel", ignoreCase = true)) {
                    error("Tunnel media-relay hors service — redémarrez le relais maison")
                }
                error("Remux relay échoué (${response.code})${errBody?.let { ": $it" } ?: ""}")
            }
            if (finalUrl.contains("/v1/play")) {
                error("Remux relay n'a pas renvoyé de playlist HLS")
            }
            finalUrl
        }
    }

    private fun isMediaRelayPlayUrl(url: String): Boolean {
        val lower = url.lowercase()
        return lower.contains("/v1/play") && lower.contains("ticket=")
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
