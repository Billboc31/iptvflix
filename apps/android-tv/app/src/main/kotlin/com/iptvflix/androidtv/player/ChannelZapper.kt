package com.iptvflix.androidtv.player

import com.iptvflix.androidtv.livetv.ChannelRepository
import com.iptvflix.androidtv.livetv.ChannelResponse
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

internal class ChannelZapper(
    private val repo: ChannelRepository,
    private val scope: CoroutineScope,
    private val onSwitch: (ChannelResponse) -> Unit,
) {
    private var zapChannels: List<ChannelResponse> = emptyList()
    private var zapIndex: Int = -1
    private var lastGoodIndex: Int = -1
    private var zapJob: Job? = null

    private val _hudChannel = MutableStateFlow<ChannelResponse?>(null)
    val hudChannel: StateFlow<ChannelResponse?> = _hudChannel.asStateFlow()

    /**
     * Loads the canonical channel list once (cached for the session) and sets
     * the current position to [channelId]. Safe to call on every channel load —
     * the list fetch is skipped on subsequent calls; the index is always updated.
     */
    suspend fun initZapContext(channelId: String) {
        if (zapChannels.isEmpty()) {
            val channels = repo.allChannels()
            if (channels.isEmpty()) return
            zapChannels = channels
        }
        val idx = zapChannels.indexOfFirst { it.id == channelId }
        zapIndex = if (idx >= 0) idx else 0
        lastGoodIndex = zapIndex
    }

    /**
     * DPAD_DOWN / KEYCODE_CHANNEL_UP → next channel (forward in the canonical list).
     * Wrap-around: last index → index 0.
     */
    fun zapNext() = enqueueZap(forward = true)

    /**
     * DPAD_UP / KEYCODE_CHANNEL_DOWN → previous channel.
     * Wrap-around: index 0 → last index.
     */
    fun zapPrevious() = enqueueZap(forward = false)

    private fun enqueueZap(forward: Boolean) {
        val channels = zapChannels
        if (channels.isEmpty()) return
        val nextIndex = if (forward) {
            (zapIndex + 1) % channels.size
        } else {
            (zapIndex - 1 + channels.size) % channels.size
        }
        zapIndex = nextIndex
        val target = channels[nextIndex]
        _hudChannel.value = target
        zapJob?.cancel()
        zapJob = scope.launch {
            // Debounce: last key press wins; rapid presses cancel each other.
            delay(DEBOUNCE_MS)
            onSwitch(target)
        }
    }

    fun clearHud() {
        _hudChannel.value = null
    }

    fun notifyPlaybackSuccess() {
        lastGoodIndex = zapIndex
    }

    fun notifyPlaybackError() {
        zapIndex = lastGoodIndex
    }

    companion object {
        const val DEBOUNCE_MS = 150L
    }
}
