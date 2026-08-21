package com.iptvflix.androidtv.playback

import android.content.Context

/**
 * Remembers the last working availability per title so continue-watching
 * resumes the same source (avoids jumping back to default 4K).
 */
class LastAvailabilityStore(context: Context) {
    private val prefs = context.applicationContext
        .getSharedPreferences("last_availability", Context.MODE_PRIVATE)

    fun get(mediaType: String, mediaId: String): String? {
        val key = key(mediaType, mediaId)
        return prefs.getString(key, null)?.takeIf { it.isNotBlank() }
    }

    fun put(mediaType: String, mediaId: String, availabilityId: String) {
        if (availabilityId.isBlank()) return
        prefs.edit().putString(key(mediaType, mediaId), availabilityId).apply()
    }

    private fun key(mediaType: String, mediaId: String): String =
        "${mediaType.trim().lowercase()}:$mediaId"
}
