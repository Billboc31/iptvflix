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
private const val RESUME_THRESHOLD_MS = 30_000L

private fun isHlsPlayback(descriptor: com.iptvflix.androidtv.playback.PlaybackDescriptor): Boolean {
    val ext = descriptor.containerExtension?.lowercase()?.removePrefix(".") ?: return false
    return ext == "m3u8" || ext == "m3u"
}

sealed class PlayerUiState {
    object Idle : PlayerUiState()
    object Buffering : PlayerUiState()
    object Playing : PlayerUiState()
    object Paused : PlayerUiState()
    object Ended : PlayerUiState()
    data class Error(val message: String) : PlayerUiState()
}

private data class ExoTrackRef(
    val group: Tracks.Group,
    val trackIndex: Int,
)

class PlayerViewModel(app: Application) : AndroidViewModel(app) {

    private val container get() = getApplication<App>()

    val player: ExoPlayer = ExoPlayerFactory.create(app, container.secureStorage)

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
    private var loadedCommandId: String? = null

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
                    state == Player.STATE_ENDED -> PlayerUiState.Ended
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
                Log.e(TAG, "Playback error: ${error.errorCodeName} ${error.message}", error)
                _uiState.value = PlayerUiState.Error(friendlyPlaybackError(error))
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
        if (loadedCommandId == command.id &&
            player.playbackState != Player.STATE_IDLE &&
            player.playbackState != Player.STATE_ENDED
        ) {
            Log.d(TAG, "Skipping duplicate load for command ${command.id}")
            return
        }
        loadedCommandId = command.id
        currentCommand = command
        hasEmittedPlay = false
        sessionId = null
        sessionEnded = false
        viewModelScope.launch {
            _uiState.value = PlayerUiState.Buffering
            runCatching {
                val descriptor = PlaybackResolver(PlaybackApi(container.apiClient)).resolve(command)
                val desiredStartMs = maxOf(command.startPositionMs, descriptor.startPositionMs)
                // Progressive MKV/MP4: seek only after the stream is READY.
                // Seeking immediately often causes long black screens then SOURCE_ERROR.
                val seekAfterReady = !isHlsPlayback(descriptor) && desiredStartMs > RESUME_THRESHOLD_MS
                val startMs = when {
                    isHlsPlayback(descriptor) && desiredStartMs > RESUME_THRESHOLD_MS -> desiredStartMs
                    seekAfterReady -> 0L
                    else -> desiredStartMs
                }

                val mediaItem = buildMediaItem(descriptor.toMediaItemSpec())
                player.stop()
                player.clearMediaItems()
                player.setMediaItem(mediaItem)
                player.prepare()
                player.playWhenReady = true
                if (startMs > 0L) player.seekTo(startMs)
                if (seekAfterReady) {
                    scheduleSeekAfterReady(desiredStartMs)
                }

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
                _uiState.value = PlayerUiState.Error(e.message ?: "Impossible de charger le média")
            }
        }
    }

    private fun scheduleSeekAfterReady(positionMs: Long) {
        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_READY) {
                    player.removeListener(this)
                    if (positionMs > 0L && player.duration > 0L) {
                        player.seekTo(positionMs.coerceAtMost(player.duration - 1_000L).coerceAtLeast(0L))
                    }
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                player.removeListener(this)
            }
        })
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
        loadedCommandId = null
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

private fun friendlyPlaybackError(error: PlaybackException): String {
    val code = error.errorCode
    val cause = error.cause?.message?.lowercase().orEmpty()
    val msg = (error.message ?: "").lowercase()
    return when {
        code == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED ||
            code == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT ->
            "Connexion au flux impossible. Vérifiez le Wi‑Fi de la TV."
        code == PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS ||
            msg.contains("403") || cause.contains("403") ->
            "Source refusée (403). Réessayez dans un instant."
        code == PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND ||
            msg.contains("404") ->
            "Source introuvable chez le fournisseur."
        code == PlaybackException.ERROR_CODE_IO_CLEARTEXT_NOT_PERMITTED ->
            "Flux HTTP bloqué. Réinstallez l'app IPTVFlix TV."
        code == PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED ||
            code == PlaybackException.ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED ->
            "Format non supporté par cette TV."
        code == PlaybackException.ERROR_CODE_DECODER_INIT_FAILED ||
            code == PlaybackException.ERROR_CODE_DECODING_FAILED ->
            "Décodage vidéo impossible sur cette TV."
        else -> error.message?.takeIf { it.isNotBlank() } ?: "Erreur source / lecture"
    }
}

