package com.iptvflix.androidtv.player

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.iptvflix.androidtv.App
import com.iptvflix.androidtv.command.PlaybackCommand
import com.iptvflix.androidtv.playback.PlaybackApi
import com.iptvflix.androidtv.playback.PlaybackResolver
import com.iptvflix.androidtv.playback.TrackInfo
import com.iptvflix.androidtv.progress.ProgressReporter
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

private const val TAG = "PlayerViewModel"
private const val SEEK_STEP_MS = 10_000L

sealed class PlayerUiState {
    object Idle : PlayerUiState()
    object Buffering : PlayerUiState()
    object Playing : PlayerUiState()
    object Paused : PlayerUiState()
    data class Error(val message: String) : PlayerUiState()
}

class PlayerViewModel(app: Application) : AndroidViewModel(app) {

    private val container get() = getApplication<App>()

    val player: ExoPlayer = ExoPlayer.Builder(app).build()

    private val _uiState = MutableStateFlow<PlayerUiState>(PlayerUiState.Idle)
    val uiState: StateFlow<PlayerUiState> = _uiState

    private val _availableTracks = MutableStateFlow<List<TrackInfo>>(emptyList())
    val availableTracks: StateFlow<List<TrackInfo>> = _availableTracks

    private var progressReporter: ProgressReporter? = null
    private var reporterJob: Job? = null

    init {
        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                _uiState.value = when {
                    state == Player.STATE_BUFFERING -> PlayerUiState.Buffering
                    state == Player.STATE_READY && player.playWhenReady -> PlayerUiState.Playing
                    state == Player.STATE_READY -> PlayerUiState.Paused
                    else -> _uiState.value
                }
            }

            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (player.playbackState == Player.STATE_READY) {
                    _uiState.value = if (isPlaying) PlayerUiState.Playing else PlayerUiState.Paused
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                Log.e(TAG, "Playback error: ${error.errorCodeName}")
                _uiState.value = PlayerUiState.Error(error.message ?: "Playback failed")
            }
        })
    }

    fun load(command: PlaybackCommand) {
        viewModelScope.launch {
            _uiState.value = PlayerUiState.Buffering
            runCatching {
                val descriptor = PlaybackResolver(PlaybackApi(container.apiClient)).resolve(command)
                _availableTracks.value = descriptor.tracks

                val mediaItem = buildMediaItem(descriptor.toMediaItemSpec())
                player.setMediaItem(mediaItem)
                player.prepare()
                player.seekTo(command.startPositionMs)
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
        viewModelScope.launch { progressReporter?.reportNow() }
        reporterJob?.cancel()
        player.stop()
        _uiState.value = PlayerUiState.Idle
    }

    fun selectTrack(trackId: String) {
        // Track selection hook — wires to ExoPlayer TrackSelectionParameters
        // when track group index is resolvable from the descriptor.
    }

    override fun onCleared() {
        viewModelScope.launch { progressReporter?.reportNow() }
        reporterJob?.cancel()
        player.release()
        super.onCleared()
    }
}
