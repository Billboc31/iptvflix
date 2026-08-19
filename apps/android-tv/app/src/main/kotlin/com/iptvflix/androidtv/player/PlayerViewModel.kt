package com.iptvflix.androidtv.player

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.C
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.exoplayer.ExoPlayer
import com.iptvflix.androidtv.App
import com.iptvflix.androidtv.command.PlaybackCommand
import com.iptvflix.androidtv.network.InteractionEventService
import com.iptvflix.androidtv.playback.PlaybackApi
import com.iptvflix.androidtv.playback.PlaybackResolver
import com.iptvflix.androidtv.playback.TrackInfo
import com.iptvflix.androidtv.progress.ProgressReporter
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout

private const val TAG = "PlayerViewModel"
private const val SEEK_STEP_MS = 10_000L

sealed class PlayerUiState {
    object Idle : PlayerUiState()
    object Buffering : PlayerUiState()
    object Playing : PlayerUiState()
    object Paused : PlayerUiState()
    data class Error(val message: String) : PlayerUiState()
}

private data class ExoTrackRef(
    val group: Tracks.Group,
    val trackIndex: Int,
)

class PlayerViewModel(app: Application) : AndroidViewModel(app) {

    private val container get() = getApplication<App>()

    val player: ExoPlayer = ExoPlayer.Builder(app).build()

    private val _uiState = MutableStateFlow<PlayerUiState>(PlayerUiState.Idle)
    val uiState: StateFlow<PlayerUiState> = _uiState

    private val _availableTracks = MutableStateFlow<List<TrackInfo>>(emptyList())
    val availableTracks: StateFlow<List<TrackInfo>> = _availableTracks

    // Populated by onTracksChanged; read on main thread only (player listener runs on main looper)
    private var exoTracksMap = mapOf<String, ExoTrackRef>()

    private var progressReporter: ProgressReporter? = null
    private var reporterJob: Job? = null

    private val interactionEvents: InteractionEventService by lazy {
        InteractionEventService(container.apiClient)
    }
    private var currentCommand: PlaybackCommand? = null
    private var sessionId: String? = null
    private var hasEmittedPlay = false
    private var sessionEnded = false

    private fun emitEvent(eventType: String, extra: Map<String, Any?> = emptyMap()) {
        val cmd = currentCommand ?: return
        viewModelScope.launch {
            runCatching {
                val params = buildMap<String, Any?> {
                    put("eventType", eventType)
                    put("mediaType", cmd.mediaType.uppercase())
                    put("mediaId", cmd.mediaId)
                    put("clientType", "android-tv")
                    sessionId?.let { put("sessionId", it) }
                    put("positionMs", player.currentPosition)
                    putAll(extra)
                }
                interactionEvents.emit(params)
            }.onFailure { Log.w(TAG, "emitEvent $eventType failed: ${it.message}") }
        }
    }

    init {
        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                _uiState.value = when {
                    state == Player.STATE_BUFFERING -> PlayerUiState.Buffering
                    state == Player.STATE_READY && player.playWhenReady -> PlayerUiState.Playing
                    state == Player.STATE_READY -> PlayerUiState.Paused
                    else -> _uiState.value
                }
                if (state == Player.STATE_ENDED) {
                    sessionEnded = true
                    emitEvent("PLAY_COMPLETED")
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (player.playbackState == Player.STATE_READY) {
                    _uiState.value = if (isPlaying) PlayerUiState.Playing else PlayerUiState.Paused
                    if (isPlaying && !hasEmittedPlay) {
                        hasEmittedPlay = true
                        viewModelScope.launch {
                            runCatching {
                                val cmd = currentCommand ?: return@runCatching
                                val params = buildMap<String, Any?> {
                                    put("eventType", "PLAY_STARTED")
                                    put("mediaType", cmd.mediaType.uppercase())
                                    put("mediaId", cmd.mediaId)
                                    put("clientType", "android-tv")
                                    put("positionMs", cmd.startPositionMs)
                                }
                                sessionId = interactionEvents.emitBatch(listOf(params))
                            }.onFailure { Log.w(TAG, "PLAY_STARTED failed: ${it.message}") }
                        }
                    } else if (isPlaying && hasEmittedPlay) {
                        emitEvent("PLAY_RESUMED")
                    } else if (!isPlaying) {
                        emitEvent("PLAY_PAUSED")
                    }
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                Log.e(TAG, "Playback error: ${error.errorCodeName}")
                _uiState.value = PlayerUiState.Error(error.message ?: "Playback failed")
            }

            override fun onTracksChanged(tracks: Tracks) {
                val map = mutableMapOf<String, ExoTrackRef>()
                val infoList = mutableListOf<TrackInfo>()
                tracks.groups.forEachIndexed { groupIdx, group ->
                    val type = when (group.type) {
                        C.TRACK_TYPE_AUDIO -> "audio"
                        C.TRACK_TYPE_TEXT -> "subtitle"
                        else -> return@forEachIndexed
                    }
                    for (trackIdx in 0 until group.length) {
                        val format = group.getTrackFormat(trackIdx)
                        val id = "g${groupIdx}t${trackIdx}"
                        val label = format.label ?: format.language ?: "$type $trackIdx"
                        map[id] = ExoTrackRef(group, trackIdx)
                        infoList.add(TrackInfo(id = id, label = label, language = format.language, type = type))
                    }
                }
                exoTracksMap = map
                _availableTracks.value = infoList
            }
        })
    }

    fun load(command: PlaybackCommand) {
        currentCommand = command
        hasEmittedPlay = false
        sessionId = null
        sessionEnded = false
        viewModelScope.launch {
            _uiState.value = PlayerUiState.Buffering
            runCatching {
                val descriptor = PlaybackResolver(PlaybackApi(container.apiClient)).resolve(command)
                val startMs = maxOf(command.startPositionMs, descriptor.startPositionMs)

                val mediaItem = buildMediaItem(descriptor.toMediaItemSpec())
                player.setMediaItem(mediaItem)
                player.prepare()
                player.seekTo(startMs)
                player.playWhenReady = true

                progressReporter = ProgressReporter(
                    mediaType = command.mediaType,
                    mediaId = command.mediaId,
                    player = player,
                    apiClient = container.apiClient,
                )
                reporterJob?.cancel()
                reporterJob = viewModelScope.launch { progressReporter!!.start() }
            }.onFailure { e ->
                Log.e(TAG, "Failed to load: ${e.message}")
                _uiState.value = PlayerUiState.Error(e.message ?: "Failed to load media")
            }
        }
    }

    fun togglePlayPause() {
        player.playWhenReady = !player.playWhenReady
        if (!player.playWhenReady) {
            viewModelScope.launch { progressReporter?.reportNow() }
        }
    }

    fun seekForward() = player.seekTo(player.currentPosition + SEEK_STEP_MS)

    fun seekBack() = player.seekTo(maxOf(0L, player.currentPosition - SEEK_STEP_MS))

    fun stop() {
        val positionMs = player.currentPosition
        viewModelScope.launch(NonCancellable) {
            progressReporter?.reportNow()
            emitAbandonIfNeeded(positionMs)
        }
        reporterJob?.cancel()
        player.stop()
        _uiState.value = PlayerUiState.Idle
    }

    private suspend fun emitAbandonIfNeeded(positionMs: Long) {
        if (sessionEnded) return
        val cmd = currentCommand ?: return
        sessionEnded = true
        runCatching {
            val params = buildMap<String, Any?> {
                put("eventType", "PLAY_ABANDONED")
                put("mediaType", cmd.mediaType.uppercase())
                put("mediaId", cmd.mediaId)
                put("clientType", "android-tv")
                sessionId?.let { put("sessionId", it) }
                put("positionMs", positionMs)
            }
            interactionEvents.emitBatch(listOf(params))
        }.onFailure { Log.w(TAG, "PLAY_ABANDONED failed: ${it.message}") }
    }

    fun selectTrack(trackId: String) {
        val ref = exoTracksMap[trackId] ?: return
        player.trackSelectionParameters = player.trackSelectionParameters
            .buildUpon()
            .clearOverridesOfType(ref.group.type)
            .addOverride(TrackSelectionOverride(ref.group.mediaTrackGroup, listOf(ref.trackIndex)))
            .build()
    }

    override fun onCleared() {
        val positionMs = player.currentPosition
        // runBlocking with NonCancellable ensures final progress/abandon are flushed
        // before viewModelScope cancels — without this the coroutines are dropped silently.
        runBlocking(NonCancellable) {
            runCatching { withTimeout(2_000L) {
                progressReporter?.reportNow()
                emitAbandonIfNeeded(positionMs)
            } }
        }
        reporterJob?.cancel()
        player.release()
        super.onCleared()
    }
}
