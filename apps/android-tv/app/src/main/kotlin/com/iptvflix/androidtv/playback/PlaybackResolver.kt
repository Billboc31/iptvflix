package com.iptvflix.androidtv.playback

import com.iptvflix.androidtv.command.PlaybackCommand

class PlaybackResolver(private val api: PlaybackApi) {

    suspend fun resolve(command: PlaybackCommand): PlaybackDescriptor =
        api.resolvePlayback(
            mediaType = command.mediaType,
            mediaId = command.mediaId,
            availabilityId = command.availabilityId,
        )
}
