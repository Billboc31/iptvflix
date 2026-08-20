package com.iptvflix.androidtv.player

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
)

fun PlaybackDescriptor.toMediaItemSpec(): MediaItemSpec = MediaItemSpec(
    uri = streamUrl,
    drmSchemeUuid = drmConfig?.let { parseDrmScheme(it) },
    drmLicenseUrl = drmConfig?.licenseUrl,
    useLiveOffset = deliveryMode.contains("HLS", ignoreCase = true),
    // Let ExoPlayer sniff progressive MKV/MP4 from bytes — forced Matroska MIME
    // can fail when the provider serves application/octet-stream after redirects.
    mimeType = containerMimeType(containerExtension, deliveryMode),
)

private fun containerMimeType(containerExtension: String?, deliveryMode: String): String? {
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
    if (spec.useLiveOffset) {
        builder.setLiveConfiguration(
            MediaItem.LiveConfiguration.Builder()
                .setTargetOffsetMs(45_000)
                .setMinOffsetMs(20_000)
                .setMaxOffsetMs(90_000)
                .setMinPlaybackSpeed(0.94f)
                .setMaxPlaybackSpeed(1.0f)
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
