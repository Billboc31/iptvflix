package com.iptvflix.androidtv.player

import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import com.iptvflix.androidtv.playback.DrmConfig
import com.iptvflix.androidtv.playback.PlaybackDescriptor
import java.util.UUID

data class MediaItemSpec(
    val uri: String,
    val drmSchemeUuid: UUID?,
    val drmLicenseUrl: String?,
    val useLiveOffset: Boolean = false,
    val mimeType: String? = null,
    val subtitleUris: List<SubtitleSidecar> = emptyList(),
)

data class SubtitleSidecar(
    val uri: String,
    val mimeType: String = MimeTypes.APPLICATION_SUBRIP,
    val language: String? = null,
    val label: String? = null,
)

fun PlaybackDescriptor.toMediaItemSpec(
    subtitleUris: List<SubtitleSidecar> = emptyList(),
    /** Live TV only — never apply live edge offsets to VOD HLS. */
    isLive: Boolean = false,
): MediaItemSpec = MediaItemSpec(
    uri = streamUrl,
    drmSchemeUuid = drmConfig?.let { parseDrmScheme(it) },
    drmLicenseUrl = drmConfig?.licenseUrl,
    // Do NOT attach MediaItem.LiveConfiguration for channel HLS remux:
    // targetOffset (8–15s) makes Exo wait for a live cushion that ffmpeg
    // remux playlists don't have yet → perpetual BUFFERING, never PLAYING.
    useLiveOffset = false,
    // Let ExoPlayer sniff progressive MKV/MP4 from bytes — forced Matroska MIME
    // can fail when the provider serves application/octet-stream after redirects.
    mimeType = containerMimeType(streamUrl, containerExtension, deliveryMode),
    subtitleUris = subtitleUris,
)

private fun containerMimeType(
    streamUrl: String,
    containerExtension: String?,
    deliveryMode: String,
): String? {
    val url = streamUrl.lowercase()
    // Final HLS playlists only — never force M3U8 on media-relay /v1/play tickets.
    if (url.contains(".m3u8") || url.contains("/v1/hls/") || url.contains("/master.m3u8")) {
        return MimeTypes.APPLICATION_M3U8
    }
    if (url.contains("/v1/play")) return null
    if (deliveryMode.contains("HLS", ignoreCase = true)) return MimeTypes.APPLICATION_M3U8
    val ext = containerExtension?.lowercase()?.removePrefix(".") ?: return null
    return when (ext) {
        "m3u8", "m3u" -> MimeTypes.APPLICATION_M3U8
        // Progressive containers: null → ExoPlayer sniffs from stream
        else -> null
    }
}

fun buildMediaItem(spec: MediaItemSpec): MediaItem {
    val builder = MediaItem.Builder().setUri(spec.uri)
    spec.mimeType?.let { builder.setMimeType(it) }
    if (spec.subtitleUris.isNotEmpty()) {
        builder.setSubtitleConfigurations(
            spec.subtitleUris.map { sub ->
                MediaItem.SubtitleConfiguration.Builder(android.net.Uri.parse(sub.uri))
                    .setMimeType(sub.mimeType)
                    .setLanguage(sub.language)
                    .setLabel(sub.label)
                    .setSelectionFlags(0)
                    .build()
            },
        )
    }
    if (spec.useLiveOffset) {
        builder.setLiveConfiguration(
            MediaItem.LiveConfiguration.Builder()
                // Target only — do NOT lock playback speed to 1.0: Exo needs a tiny
                // catch-up range or many Xtream HLS feeds stay forever BUFFERING.
                .setTargetOffsetMs(12_000)
                .setMinOffsetMs(6_000)
                .setMaxOffsetMs(35_000)
                .setMinPlaybackSpeed(0.97f)
                .setMaxPlaybackSpeed(1.03f)
                .build(),
        )
    }
    if (spec.drmSchemeUuid != null && spec.drmLicenseUrl != null) {
        builder.setDrmConfiguration(
            MediaItem.DrmConfiguration.Builder(spec.drmSchemeUuid)
                .setLicenseUri(spec.drmLicenseUrl)
                .build(),
        )
    }
    return builder.build()
}

private fun parseDrmScheme(drm: DrmConfig): UUID? = runCatching {
    UUID.fromString(drm.schemeUuid)
}.getOrNull()
