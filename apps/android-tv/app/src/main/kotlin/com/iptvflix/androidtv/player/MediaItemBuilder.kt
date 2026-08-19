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
    mimeType = containerMimeType(containerExtension, deliveryMode),
)

private fun containerMimeType(containerExtension: String?, deliveryMode: String): String? {
    if (deliveryMode.contains("HLS", ignoreCase = true)) return MimeTypes.APPLICATION_M3U8
    val ext = containerExtension?.lowercase()?.removePrefix(".") ?: return null
    return when (ext) {
        "mkv" -> MimeTypes.VIDEO_MATROSKA
        "mp4", "m4v" -> MimeTypes.VIDEO_MP4
        "ts", "m2ts", "mts" -> MimeTypes.VIDEO_MP2T
        "m3u8", "m3u" -> MimeTypes.APPLICATION_M3U8
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
