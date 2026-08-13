package com.iptvflix.androidtv.player

import androidx.media3.common.MediaItem
import com.iptvflix.androidtv.playback.DrmConfig
import com.iptvflix.androidtv.playback.PlaybackDescriptor
import java.util.UUID

data class MediaItemSpec(
    val uri: String,
    val drmSchemeUuid: UUID?,
    val drmLicenseUrl: String?,
)

fun PlaybackDescriptor.toMediaItemSpec(): MediaItemSpec = MediaItemSpec(
    uri = streamUrl,
    drmSchemeUuid = drmConfig?.let { parseDrmScheme(it) },
    drmLicenseUrl = drmConfig?.licenseUrl,
)

fun buildMediaItem(spec: MediaItemSpec): MediaItem {
    val builder = MediaItem.Builder().setUri(spec.uri)
    if (spec.drmSchemeUuid != null && spec.drmLicenseUrl != null) {
        builder.setDrmConfiguration(
            MediaItem.DrmConfiguration.Builder(spec.drmSchemeUuid)
                .setLicenseUri(spec.drmLicenseUrl)
                .build()
        )
    }
    return builder.build()
}

private fun parseDrmScheme(drm: DrmConfig): UUID? = runCatching {
    UUID.fromString(drm.schemeUuid)
}.getOrNull()
