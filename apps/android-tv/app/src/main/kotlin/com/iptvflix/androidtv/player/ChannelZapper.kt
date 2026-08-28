package com.iptvflix.androidtv.player

import com.iptvflix.androidtv.livetv.ChannelRepository
import com.iptvflix.androidtv.livetv.ChannelResponse
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlin.math.min

data class ZapPreviewState(
    val window: List<ChannelResponse>,
    val selectedIndex: Int,
    val playingChannelId: String?,
) {
    val selectedChannel: ChannelResponse get() = window[selectedIndex]
}

internal class ChannelZapper(
    private val repo: ChannelRepository,
    @Suppress("unused") private val scope: CoroutineScope,
    private val onSwitch: (ChannelResponse) -> Unit,
) {
    private var zapChannels: List<ChannelResponse> = emptyList()
    private var zapIndex: Int = -1
    private var lastGoodIndex: Int = -1
    private var previewIndex: Int = -1

    private val _preview = MutableStateFlow<ZapPreviewState?>(null)
    val previewState: StateFlow<ZapPreviewState?> = _preview.asStateFlow()

    suspend fun initZapContext(channelId: String) {
        if (zapChannels.isEmpty()) {
            val channels = repo.allChannels()
            if (channels.isEmpty()) return
            zapChannels = channels
        }
        syncIndicesToChannel(channelId)
    }

    fun previewNext() = movePreview(forward = true)

    fun previewPrevious() = movePreview(forward = false)

    fun zapNext() = previewNext()

    fun zapPrevious() = previewPrevious()

    private fun movePreview(forward: Boolean) {
        val channels = zapChannels
        if (channels.isEmpty()) return
        if (_preview.value == null) {
            previewIndex = lastGoodIndex
        }
        previewIndex = if (forward) {
            (previewIndex + 1) % channels.size
        } else {
            (previewIndex - 1 + channels.size) % channels.size
        }
        _preview.value = buildPreviewState(channels, previewIndex)
    }

    fun confirmPreview() {
        val channels = zapChannels
        val preview = _preview.value ?: return
        if (channels.isEmpty()) return
        val targetIndex = channels.indexOfFirst { it.id == preview.selectedChannel.id }
        if (targetIndex < 0) {
            cancelPreview()
            return
        }
        _preview.value = null
        if (targetIndex == lastGoodIndex) return
        // Do NOT update lastGoodIndex here — wait until the new stream is READY.
        onSwitch(channels[targetIndex])
    }

    fun cancelPreview() {
        previewIndex = lastGoodIndex
        zapIndex = lastGoodIndex
        _preview.value = null
    }

    fun clearHud() = cancelPreview()

    /** Called when Exo reaches READY for [channelId] — only then commit the zap index. */
    fun notifyPlaybackSuccess(channelId: String) {
        syncIndicesToChannel(channelId)
        _preview.value = null
    }

    fun notifyPlaybackError() {
        previewIndex = lastGoodIndex
        zapIndex = lastGoodIndex
        _preview.value = null
    }

    private fun syncIndicesToChannel(channelId: String) {
        val idx = zapChannels.indexOfFirst { it.id == channelId }
        if (idx < 0) return
        zapIndex = idx
        lastGoodIndex = idx
        previewIndex = idx
    }

    private fun buildPreviewState(channels: List<ChannelResponse>, centerIndex: Int): ZapPreviewState {
        val n = channels.size
        val radius = min(PREVIEW_RADIUS, (n - 1) / 2)
        val window = (-radius..radius).map { offset ->
            channels[(centerIndex + offset + n) % n]
        }
        return ZapPreviewState(
            window = window,
            selectedIndex = radius,
            playingChannelId = channels.getOrNull(lastGoodIndex)?.id,
        )
    }

    companion object {
        const val PREVIEW_RADIUS = 3
        const val PREVIEW_IDLE_MS = 5_000L
    }
}
