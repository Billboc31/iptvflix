package com.iptvflix.androidtv.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PlaybackResolverTest {

    @Test
    fun `pickSaferVariant leaves non-uhd selection alone`() {
        val alts = listOf(
            AvailabilityVariant(id = "a", videoQuality = "1080p", audioLanguage = "fr"),
            AvailabilityVariant(id = "b", videoQuality = "4K", audioLanguage = "fr"),
        )
        assertNull(PlaybackResolver.pickSaferVariant("a", alts))
    }

    @Test
    fun `pickSaferVariant prefers fr 1080p over 4K`() {
        val alts = listOf(
            AvailabilityVariant(id = "uhd", videoQuality = "4K", audioLanguage = "fr"),
            AvailabilityVariant(id = "en720", videoQuality = "720p", audioLanguage = "en"),
            AvailabilityVariant(id = "fr1080", videoQuality = "1080p", audioLanguage = "fr"),
        )
        assertEquals("fr1080", PlaybackResolver.pickSaferVariant("uhd", alts))
    }
}
