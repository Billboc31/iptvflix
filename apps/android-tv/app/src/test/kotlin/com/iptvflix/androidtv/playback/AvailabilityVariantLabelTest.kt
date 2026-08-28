package com.iptvflix.androidtv.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AvailabilityVariantLabelTest {

    @Test
    fun `provider code alone stays readable`() {
        val v = AvailabilityVariant(id = "1", rawTitle = "UNIV", sourceDisplayName = "UNIV")
        assertEquals("UNIV", v.label())
    }

    @Test
    fun `multi audio tracks mark selected univ source`() {
        val v = AvailabilityVariant(
            id = "1",
            rawTitle = "UNIV",
            sourceDisplayName = "UNIV",
            videoQuality = "1080p",
        )
        val label = v.label(embeddedAudioTrackCount = 3)
        assertTrue(label.contains("Multi"))
        assertTrue(label.contains("1080p"))
        assertTrue(label.contains("UNIV"))
    }

    @Test
    fun `structured fr quality keeps univ as suffix`() {
        val v = AvailabilityVariant(
            id = "1",
            audioLanguage = "fr",
            videoQuality = "1080p",
            sourceDisplayName = "UNIV",
        )
    @Test
    fun `live source label uses display label from api`() {
        val v = AvailabilityVariant(
            id = "1",
            rawTitle = "FR| GÉNÉRAL HD/4K",
            displayLabel = "FR| GÉNÉRAL HD/4K · 1687220",
        )
        assertEquals("FR| GÉNÉRAL HD/4K · 1687220", v.liveSourceLabel())
    }

    @Test
    fun `live source label falls back to raw title`() {
        val v = AvailabilityVariant(id = "1", rawTitle = "FR| FRANCE HEVC VIP")
        assertEquals("FR| FRANCE HEVC VIP", v.liveSourceLabel())
    }
}
