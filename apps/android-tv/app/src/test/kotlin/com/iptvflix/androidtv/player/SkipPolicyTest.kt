package com.iptvflix.androidtv.player

import com.iptvflix.androidtv.playback.EpisodeSegmentItem
import org.junit.Assert.*
import org.junit.Test

class SkipPolicyTest {
    private val intro = EpisodeSegmentItem("INTRO", 10000, 100000, true)
    @Test fun skipsOnlyInsideTheRange() {
        assertFalse(shouldSkipSegment(intro, 9000, 1440000, true, false, true, false, false))
        assertTrue(shouldSkipSegment(intro, 10000, 1440000, true, false, true, false, false))
        assertFalse(shouldSkipSegment(intro, 100000, 1440000, true, false, true, false, false))
    }
    @Test fun preservesPausedAndUnverifiedPlayback() {
        assertFalse(shouldSkipSegment(intro, 20000, 1440000, false, false, true, false, false))
        assertFalse(shouldSkipSegment(intro, 20000, 1440000, true, true, true, false, false))
        assertFalse(shouldSkipSegment(intro.copy(autoSkipSafe = false), 20000, 1440000, true, false, true, false, false))
    }
    @Test fun preservesPostCreditScenes() {
        val ending = EpisodeSegmentItem("CREDITS", 1200000, 1380000, true)
        assertFalse(segmentReachesEnd(ending, 1440000))
        assertTrue(segmentReachesEnd(ending.copy(endMs = 1440000), 1440000))
    }
}
