package com.iptvflix.androidtv.playback

import com.iptvflix.androidtv.command.PlaybackCommand

class PlaybackResolver(
    private val api: PlaybackApi,
    private val lastAvailability: LastAvailabilityStore? = null,
) {

    suspend fun resolve(command: PlaybackCommand): PlaybackDescriptor {
        val remembered = lastAvailability?.get(command.mediaType, command.mediaId)
        val preferredId = command.availabilityId?.takeIf { it.isNotBlank() } ?: remembered

        var descriptor = api.resolvePlayback(
            mediaType = command.mediaType,
            mediaId = command.mediaId,
            availabilityId = preferredId,
            startPositionMs = command.startPositionMs,
        )

        // No remembered source: avoid auto-picking UHD/4K which often fails on TV/emu.
        if (preferredId == null) {
            val safer = pickSaferVariant(descriptor.availabilityId, descriptor.alternatives)
            if (safer != null && safer != descriptor.availabilityId) {
                descriptor = api.resolvePlayback(
                    mediaType = command.mediaType,
                    mediaId = command.mediaId,
                    availabilityId = safer,
                    startPositionMs = command.startPositionMs,
                )
            }
        }

        descriptor.availabilityId?.let { id ->
            lastAvailability?.put(command.mediaType, command.mediaId, id)
        }
        return descriptor
    }

    companion object {
        fun pickSaferVariant(
            selectedId: String?,
            alternatives: List<AvailabilityVariant>,
        ): String? {
            val selected = alternatives.find { it.id == selectedId } ?: return null
            if (!isUhd(selected)) return null
            val safer = alternatives
                .filter { it.id != selectedId && !isUhd(it) }
                .sortedWith(
                    compareBy<AvailabilityVariant> { languageRank(it.audioLanguage) }
                        .thenByDescending { qualityRank(it.videoQuality) },
                )
            return safer.firstOrNull()?.id
        }

        private fun isUhd(v: AvailabilityVariant): Boolean {
            val q = v.videoQuality?.uppercase().orEmpty()
            val title = v.rawTitle?.uppercase().orEmpty()
            return q.contains("4K") || q.contains("UHD") || q.contains("2160") ||
                title.contains("4K") || title.contains("UHD")
        }

        private fun languageRank(code: String?): Int = when (code?.lowercase()) {
            "fr", "fra", "fre" -> 0
            "en", "eng" -> 1
            else -> 2
        }

        private fun qualityRank(q: String?): Int = when (q?.lowercase()) {
            "1080p", "1080", "fhd" -> 3
            "720p", "720", "hd" -> 2
            "480p", "480", "sd" -> 1
            else -> 0
        }
    }
}
