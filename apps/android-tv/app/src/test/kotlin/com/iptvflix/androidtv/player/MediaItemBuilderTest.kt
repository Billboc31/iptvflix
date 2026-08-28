package com.iptvflix.androidtv.player

import com.iptvflix.androidtv.playback.DrmConfig
import com.iptvflix.androidtv.playback.PlaybackDescriptor
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.UUID

class MediaItemBuilderTest {

    private val widevineUuid = "edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"

    @Test
    fun `plain URI produces spec with no DRM`() {
        val descriptor = PlaybackDescriptor(streamUrl = "https://cdn.example.com/stream.m3u8")
        val spec = descriptor.toMediaItemSpec()

        assertEquals("https://cdn.example.com/stream.m3u8", spec.uri)
        assertNull(spec.drmSchemeUuid)
        assertNull(spec.drmLicenseUrl)
    }

    @Test
    fun `descriptor with DRM config produces spec with scheme UUID and license URL`() {
        val descriptor = PlaybackDescriptor(
            streamUrl = "https://cdn.example.com/drm.mpd",
            drmConfig = DrmConfig(schemeUuid = widevineUuid, licenseUrl = "https://lic.example.com"),
        )
        val spec = descriptor.toMediaItemSpec()

        assertNotNull(spec.drmSchemeUuid)
        assertEquals(UUID.fromString(widevineUuid), spec.drmSchemeUuid)
        assertEquals("https://lic.example.com", spec.drmLicenseUrl)
    }

    @Test
    fun `invalid DRM scheme UUID results in null scheme`() {
        val descriptor = PlaybackDescriptor(
            streamUrl = "https://cdn.example.com/stream.m3u8",
            drmConfig = DrmConfig(schemeUuid = "not-a-valid-uuid", licenseUrl = "https://lic.example.com"),
        )
        val spec = descriptor.toMediaItemSpec()

        assertNull(spec.drmSchemeUuid)
    }

    @Test
    fun `descriptor streamUrl is preserved as spec uri`() {
        val descriptor = PlaybackDescriptor(streamUrl = "https://cdn.example.com/ep.m3u8")
        val spec = descriptor.toMediaItemSpec()
        assertEquals("https://cdn.example.com/ep.m3u8", spec.uri)
    }

    @Test
    fun `VOD HLS does not enable live offset`() {
        val spec = PlaybackDescriptor(
            streamUrl = "https://cdn.example.com/movie.m3u8",
            deliveryMode = "HLS_REMUX",
            containerExtension = "m3u8",
        ).toMediaItemSpec(isLive = false)
        assertEquals(false, spec.useLiveOffset)
    }

    @Test
    fun `Live TV HLS does not force LiveConfiguration (avoids remux stall)`() {
        val spec = PlaybackDescriptor(
            streamUrl = "https://cdn.example.com/live.m3u8",
            deliveryMode = "HLS_REMUX",
            containerExtension = "m3u8",
        ).toMediaItemSpec(isLive = true)
        assertEquals(false, spec.useLiveOffset)
    }
}
