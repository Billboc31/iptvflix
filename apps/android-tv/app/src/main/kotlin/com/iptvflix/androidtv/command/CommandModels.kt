package com.iptvflix.androidtv.command

import kotlinx.serialization.Serializable

@Serializable
data class PlaybackCommand(
    val id: String,
    val mediaType: String,
    val mediaId: String,
    val availabilityId: String? = null,
    val startPositionMs: Long = 0L,
)

sealed class CommandState {
    object Pending : CommandState()
    object Acknowledged : CommandState()
}
