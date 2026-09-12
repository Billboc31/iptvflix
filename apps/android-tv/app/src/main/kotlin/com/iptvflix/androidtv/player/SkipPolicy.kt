package com.iptvflix.androidtv.player

import com.iptvflix.androidtv.playback.EpisodeSegmentItem

internal fun shouldSkipSegment(segment: EpisodeSegmentItem, positionMs: Long, durationMs: Long, playing: Boolean, scrubbing: Boolean, neverStop: Boolean, intro: Boolean, recap: Boolean): Boolean =
    playing && !scrubbing && segment.autoSkipSafe && segment.startMs >= 0 && segment.endMs > segment.startMs &&
        segment.endMs <= durationMs && positionMs >= segment.startMs && positionMs < segment.endMs &&
        (neverStop || segment.type == "INTRO" && intro || segment.type == "RECAP" && recap)

internal fun segmentReachesEnd(segment: EpisodeSegmentItem, durationMs: Long): Boolean =
    segment.autoSkipSafe && durationMs > 0 && segment.type in listOf("CREDITS", "OUTRO", "PREVIEW") &&
        segment.endMs <= durationMs && segment.endMs >= durationMs - 1000L
