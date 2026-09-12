package com.iptvflix.androidtv.livetv

/** ISO-ish timestamp → local HH:mm for EPG rows. */
internal fun formatEpgTime(rawTime: String): String {
    val timePart = rawTime.substringAfter('T', rawTime)
    return timePart.take(5)
}

internal fun formatEpgRange(startTime: String, endTime: String): String =
    "${formatEpgTime(startTime)}–${formatEpgTime(endTime)}"
