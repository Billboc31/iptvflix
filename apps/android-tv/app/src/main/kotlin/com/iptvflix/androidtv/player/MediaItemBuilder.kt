package com.iptvflix.androidtv.player

import androidx.media3.common.MediaItem
import com.iptvflix.androidtv.playback.DrmConfig
import com.iptvflix.androidtv.playback.PlaybackDescriptor
import java.util.UUID

data class MediaItemSpec(
    val uri: String,
    val drmSchemeUuid: UUID?,
    val drmLicenseUrl: String?,
    val     useLiveOffset: Boolean = false,
)

fun PlaybackDescriptor.toMediaItemSpec(): MediaItemSpec = MediaItemSpec(
    uri = streamUrl,
    drmSchemeUuid = drmConfig?.let { parseDrmScheme(it) },
    drmLicenseUrl = drmConfig?.licenseUrl,
    useLiveOffset = false,
)

fun buildMediaItem(spec: MediaItemSpec): MediaItem {
    val builder = MediaItem.Builder().setUri(spec.uri)
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
