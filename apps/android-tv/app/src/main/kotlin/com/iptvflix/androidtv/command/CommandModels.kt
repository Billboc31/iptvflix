package com.iptvflix.androidtv.command

import kotlinx.serialization.Serializable

@Serializable
data class PlaybackCommand(
    val id: String,
    val mediaType: String,
    val mediaId: String,
    val availabilityId: String? = null,
    val startPositionMs: Long = 0L,
    /** Optional display title (local resume / future SSE). */
    val title: String? = null,
    /** Episode context when known (continue-watching / local switch). */
    val seriesId: String? = null,
    val seasonNumber: Int? = null,
    /** Artwork for scrub preview card (poster / still). */
    val posterUrl: String? = null,
)

sealed class CommandState {
    object Pending : CommandState()
    object Acknowledged : CommandState()
}
