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
import com.iptvflix.androidtv.playback.AvailabilityVariant
import com.iptvflix.androidtv.playback.PlaybackApi
import com.iptvflix.androidtv.playback.PlaybackResolver
import com.iptvflix.androidtv.playback.SegmentsApi
import com.iptvflix.androidtv.playback.TrackInfo
import com.iptvflix.androidtv.progress.ProgressReporter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private const val TAG = "PlayerViewModel"
private const val SEEK_STEP_MS = 10_000L
private const val SCRUB_STEP_MS = 10_000L
private const val SCRUB_FAST_STEP_MS = 30_000L

sealed class PlayerUiState {
    object Idle : PlayerUiState()
    object Buffering : PlayerUiState()
    object Playing : PlayerUiState()
    object Paused : PlayerUiState()
    object Ended : PlayerUiState()
    data class Error(val message: String) : PlayerUiState()
}

enum class PlayerPanel {
    None,
    Sources,
    Audio,
    Subtitles,
}

private data class ExoTrackRef(
    val group: Tracks.Group,
    val trackIndex: Int,
)

data class PlayerHudState(
    val positionMs: Long = 0L,
    val durationMs: Long = 0L,
    val bufferedPercent: Int = 0,
)

data class ScrubState(
    val active: Boolean = false,
    val previewMs: Long = 0L,
)

class PlayerViewModel(app: Application) : AndroidViewModel(app) {

    private val container get() = getApplication<App>()

    val player: ExoPlayer = ExoPlayerFactory.create(app, container.secureStorage)

    private val _uiState = MutableStateFlow<PlayerUiState>(PlayerUiState.Idle)
    val uiState: StateFlow<PlayerUiState> = _uiState

    private val _hud = MutableStateFlow(PlayerHudState())
    val hud: StateFlow<PlayerHudState> = _hud.asStateFlow()

    private val _scrub = MutableStateFlow(ScrubState())
    val scrub: StateFlow<ScrubState> = _scrub.asStateFlow()

    private val _overlayActions = MutableStateFlow<List<PlayerOverlayAction>>(emptyList())
    val overlayActions: StateFlow<List<PlayerOverlayAction>> = _overlayActions.asStateFlow()

    private val _availableTracks = MutableStateFlow<List<TrackInfo>>(emptyList())
    val availableTracks: StateFlow<List<TrackInfo>> = _availableTracks

    private val _variants = MutableStateFlow<List<AvailabilityVariant>>(emptyList())
    val variants: StateFlow<List<AvailabilityVariant>> = _variants.asStateFlow()

    private val _selectedVariantId = MutableStateFlow<String?>(null)
    val selectedVariantId: StateFlow<String?> = _selectedVariantId.asStateFlow()

    private val _selectedTrackIds = MutableStateFlow<Map<String, String>>(emptyMap())
    val selectedTrackIds: StateFlow<Map<String, String>> = _selectedTrackIds.asStateFlow()

    private val _openPanel = MutableStateFlow(PlayerPanel.None)
    val openPanel: StateFlow<PlayerPanel> = _openPanel.asStateFlow()

    private val _subtitleMessage = MutableStateFlow<String?>(null)
    val subtitleMessage: StateFlow<String?> = _subtitleMessage.asStateFlow()

    private var exoTracksMap = mapOf<String, ExoTrackRef>()

    private var progressReporter: ProgressReporter? = null
    private var reporterJob: Job? = null
    private var hudJob: Job? = null
    private var scrubCommitJob: Job? = null

    private val interactionEvents: InteractionEventService by lazy {
        InteractionEventService(container.apiClient)
    }
    private var currentCommand: PlaybackCommand? = null
    private var sessionId: String? = null
    private var hasEmittedPlay = false
    private var sessionEnded = false
    private var loadedCommandId: String? = null
    private var pendingResumeMs: Long = 0L
    private var scrubHoldTicks: Int = 0

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
                    put("positionMs", runCatching { player.currentPosition }.getOrDefault(0L))
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
                if (state == Player.STATE_READY) {
                    val didResumeSeek = maybeApplyResumeSeek()
                    // Avoid PUT at t≈0 before resume seek lands — that wiped CW (<5%).
                    if (!didResumeSeek) {
                        viewModelScope.launch { progressReporter?.reportNow() }
                    }
                }
                if (state == Player.STATE_ENDED) {
                    sessionEnded = true
                    emitEvent("PLAY_COMPLETED")
                    viewModelScope.launch {
                        val pos = runCatching { player.currentPosition }.getOrDefault(0L)
                        val dur = runCatching { player.duration }.getOrDefault(C.TIME_UNSET)
                        if (dur != C.TIME_UNSET && dur > 0L) {
                            progressReporter?.reportAt(pos, dur)
                        } else {
                            progressReporter?.reportNow()
                        }
                    }
                }
                refreshHud()
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
                // Keep Sources reachable so the user can pick a playable stream (e.g. non-4K).
                _openPanel.value = PlayerPanel.Sources
            }

            override fun onTracksChanged(tracks: Tracks) {
                val map = mutableMapOf<String, ExoTrackRef>()
                val infoList = mutableListOf<TrackInfo>()
                val selected = mutableMapOf<String, String>()
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
                        if (group.isTrackSelected(trackIdx)) {
                            selected[type] = id
                        }
                    }
                }
                exoTracksMap = map
                _availableTracks.value = infoList
                _selectedTrackIds.value = selected
            }
        })
        hudJob = viewModelScope.launch {
            while (true) {
                delay(500)
                if (!_scrub.value.active) refreshHud()
            }
        }
    }

    private fun refreshHud() {
        val pos = runCatching { player.currentPosition }.getOrDefault(0L).coerceAtLeast(0L)
        val dur = runCatching { player.duration }.getOrDefault(C.TIME_UNSET)
        val durationMs = if (dur == C.TIME_UNSET || dur < 0L) 0L else dur
        val buffered = runCatching { player.bufferedPercentage }.getOrDefault(0)
        _hud.value = PlayerHudState(positionMs = pos, durationMs = durationMs, bufferedPercent = buffered)
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
        pendingResumeMs = 0L
        scrubHoldTicks = 0
        _scrub.value = ScrubState()
        _openPanel.value = PlayerPanel.None
        _subtitleMessage.value = null
        viewModelScope.launch {
            _uiState.value = PlayerUiState.Buffering
            runCatching {
                val descriptor = withContext(Dispatchers.IO) {
                    PlaybackResolver(
                        PlaybackApi(container.apiClient),
                        container.lastAvailabilityStore,
                    ).resolve(command)
                }
                val desiredStartMs = maxOf(command.startPositionMs, descriptor.startPositionMs)
                pendingResumeMs = if (desiredStartMs > 30_000L) desiredStartMs else 0L

                _variants.value = descriptor.alternatives
                _selectedVariantId.value = descriptor.availabilityId ?: command.availabilityId

                withContext(Dispatchers.Main) {
                    player.stop()
                    player.clearMediaItems()
                    player.setMediaItem(buildMediaItem(descriptor.toMediaItemSpec()))
                    player.prepare()
                    player.playWhenReady = true
                }

                _overlayActions.value = if (command.mediaType.equals("episode", ignoreCase = true)) {
                    withContext(Dispatchers.IO) {
                        SegmentsApi(container.apiClient)
                            .fetchEpisodeSegments(command.mediaId)
                            .mapNotNull { segment ->
                                when (segment.type.uppercase()) {
                                    "INTRO" -> PlayerOverlayAction.SkipIntro(
                                        untilMs = segment.endMs,
                                        seekToMs = segment.endMs,
                                    )
                                    "RECAP" -> PlayerOverlayAction.SkipRecap(
                                        untilMs = segment.endMs,
                                        seekToMs = segment.endMs,
                                    )
                                    else -> null
                                }
                            }
                    }
                } else {
                    emptyList()
                }

                val floorSeconds = (desiredStartMs / 1000L).toInt().coerceAtLeast(0)
                progressReporter = ProgressReporter(
                    mediaType = command.mediaType,
                    mediaId = command.mediaId,
                    player = player,
                    apiClient = container.apiClient,
                    initialFloorSeconds = floorSeconds,
                )
                reporterJob?.cancel()
                reporterJob = viewModelScope.launch { progressReporter!!.start() }
            }.onFailure { e ->
                Log.e(TAG, "Failed to load: ${e.message}", e)
                _uiState.value = PlayerUiState.Error(e.message ?: "Impossible de charger le média")
            }
        }
    }

    fun switchVariant(variantId: String) {
        val cmd = currentCommand ?: return
        if (variantId == _selectedVariantId.value) {
            _openPanel.value = PlayerPanel.None
            return
        }
        val positionMs = runCatching { player.currentPosition }.getOrDefault(0L)
            .coerceAtLeast(cmd.startPositionMs)
        container.lastAvailabilityStore.put(cmd.mediaType, cmd.mediaId, variantId)
        loadedCommandId = null
        _openPanel.value = PlayerPanel.None
        load(
            cmd.copy(
                id = "${cmd.id}-src-$variantId",
                availabilityId = variantId,
                startPositionMs = positionMs,
            ),
        )
    }

    /** @return true when a resume seek was issued (progress must not be reported at t=0). */
    private fun maybeApplyResumeSeek(): Boolean {
        val target = pendingResumeMs
        if (target <= 0L) return false
        val dur = runCatching { player.duration }.getOrDefault(C.TIME_UNSET)
        if (dur == C.TIME_UNSET || dur <= 0L) return false
        pendingResumeMs = 0L
        val safeTarget = target.coerceAtMost((dur - 5_000L).coerceAtLeast(0L))
        Log.d(TAG, "Applying resume seek to ${safeTarget}ms (duration=${dur}ms)")
        return runCatching {
            player.seekTo(safeTarget)
            true
        }.onFailure {
            Log.w(TAG, "Resume seek failed, continuing from start: ${it.message}")
        }.getOrDefault(false)
    }

    fun togglePlayPause() {
        viewModelScope.launch(Dispatchers.Main.immediate) {
            if (_scrub.value.active) {
                commitScrub()
                return@launch
            }
            player.playWhenReady = !player.playWhenReady
            if (!player.playWhenReady) {
                progressReporter?.reportNow()
            }
        }
    }

    fun openPanel(panel: PlayerPanel) {
        _openPanel.value = if (_openPanel.value == panel) PlayerPanel.None else panel
        if (panel == PlayerPanel.Subtitles) {
            maybePromptOnlineSubtitles()
        }
    }

    fun showPanel(panel: PlayerPanel) {
        _openPanel.value = panel
        if (panel == PlayerPanel.Subtitles) {
            maybePromptOnlineSubtitles()
        }
    }

    fun closePanel() {
        _openPanel.value = PlayerPanel.None
    }

    /** D-pad scrub: preview first, commit after short idle (Netflix-style). */
    fun nudgeScrub(forward: Boolean) {
        viewModelScope.launch(Dispatchers.Main.immediate) {
            val dur = player.duration
            val durationMs = if (dur == C.TIME_UNSET || dur < 0L) 0L else dur
            val base = if (_scrub.value.active) {
                _scrub.value.previewMs
            } else {
                player.currentPosition
            }
            scrubHoldTicks += 1
            val step = if (scrubHoldTicks >= 3) SCRUB_FAST_STEP_MS else SCRUB_STEP_MS
            val next = if (forward) {
                if (durationMs > 0L) (base + step).coerceAtMost(durationMs) else base + step
            } else {
                (base - step).coerceAtLeast(0L)
            }
            _scrub.value = ScrubState(active = true, previewMs = next)
            _hud.value = _hud.value.copy(positionMs = next, durationMs = durationMs)
            scheduleScrubCommit()
        }
    }

    fun seekForward() = nudgeScrub(forward = true)

    fun seekBack() = nudgeScrub(forward = false)

    /** Absolute scrub from progress bar drag / tap (0f..1f). */
    fun beginBarScrub(fraction: Float) {
        viewModelScope.launch(Dispatchers.Main.immediate) {
            scrubCommitJob?.cancel()
            scrubHoldTicks = 0
            applyScrubFraction(fraction, active = true)
        }
    }

    fun updateBarScrub(fraction: Float) {
        viewModelScope.launch(Dispatchers.Main.immediate) {
            applyScrubFraction(fraction, active = true)
        }
    }

    fun endBarScrub() {
        viewModelScope.launch(Dispatchers.Main.immediate) {
            commitScrub()
        }
    }

    fun seekToFraction(fraction: Float) {
        viewModelScope.launch(Dispatchers.Main.immediate) {
            scrubCommitJob?.cancel()
            applyScrubFraction(fraction, active = true)
            commitScrub()
        }
    }

    private fun applyScrubFraction(fraction: Float, active: Boolean) {
        val dur = player.duration
        val durationMs = if (dur == C.TIME_UNSET || dur < 0L) 0L else dur
        if (durationMs <= 0L) return
        val next = (durationMs * fraction.coerceIn(0f, 1f)).toLong().coerceIn(0L, durationMs)
        _scrub.value = ScrubState(active = active, previewMs = next)
        _hud.value = _hud.value.copy(positionMs = next, durationMs = durationMs)
    }

    private fun scheduleScrubCommit() {
        scrubCommitJob?.cancel()
        scrubCommitJob = viewModelScope.launch {
            delay(450)
            commitScrub()
        }
    }

    private fun commitScrub() {
        val scrub = _scrub.value
        if (!scrub.active) return
        scrubHoldTicks = 0
        _scrub.value = ScrubState(active = false, previewMs = scrub.previewMs)
        viewModelScope.launch(Dispatchers.Main.immediate) {
            runCatching { player.seekTo(scrub.previewMs) }
            refreshHud()
        }
    }

    fun onOverlayAction(action: PlayerOverlayAction) {
        viewModelScope.launch(Dispatchers.Main.immediate) {
            when (action) {
                is PlayerOverlayAction.SkipIntro -> {
                    player.seekTo(action.seekToMs.coerceAtLeast(0L))
                    _overlayActions.value = _overlayActions.value.filterNot { it.id == action.id }
                    emitEvent("SKIP_INTRO")
                }
                is PlayerOverlayAction.SkipRecap -> {
                    player.seekTo(action.seekToMs.coerceAtLeast(0L))
                    _overlayActions.value = _overlayActions.value.filterNot { it.id == action.id }
                    emitEvent("SKIP_RECAP")
                }
                is PlayerOverlayAction.NextEpisode,
                is PlayerOverlayAction.Custom,
                -> Log.d(TAG, "Overlay action not wired yet: ${action.id}")
            }
        }
    }

    fun stop() {
        // Capture before player.stop() — Exo often resets position to 0 and that
        // used to PUT ~1s progress, dropping the title from continue-watching (<5%).
        val positionMs = runCatching { player.currentPosition }.getOrDefault(0L)
        val rawDuration = runCatching { player.duration }.getOrDefault(C.TIME_UNSET)
        val durationMs = if (rawDuration == C.TIME_UNSET || rawDuration <= 0L) 0L else rawDuration
        viewModelScope.launch(NonCancellable) {
            if (durationMs > 0L) {
                progressReporter?.reportAt(positionMs, durationMs)
            } else {
                progressReporter?.reportNow()
            }
            emitAbandonIfNeeded(positionMs)
        }
        reporterJob?.cancel()
        scrubCommitJob?.cancel()
        loadedCommandId = null
        viewModelScope.launch(Dispatchers.Main.immediate) {
            runCatching { player.stop() }
            _uiState.value = PlayerUiState.Idle
        }
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
        _openPanel.value = PlayerPanel.None
    }

    fun disableSubtitles() {
        player.trackSelectionParameters = player.trackSelectionParameters
            .buildUpon()
            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
            .build()
        _selectedTrackIds.value = _selectedTrackIds.value - "subtitle"
        _openPanel.value = PlayerPanel.None
    }

    fun enableSubtitlesAndSelect(trackId: String) {
        player.trackSelectionParameters = player.trackSelectionParameters
            .buildUpon()
            .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
            .build()
        selectTrack(trackId)
    }

    /**
     * Online subtitle fetch (OpenSubtitles-style) is not wired server-side yet.
     * Keep a clear UX so the menu is ready when the API lands.
     */
    fun searchOnlineSubtitles() {
        val hasEmbedded = _availableTracks.value.any { it.type == "subtitle" }
        _subtitleMessage.value = if (hasEmbedded) {
            "Sous-titres du fichier disponibles ci-dessous."
        } else {
            "Recherche en ligne bientôt disponible — aucun ST embarqué dans cette source."
        }
    }

    private fun maybePromptOnlineSubtitles() {
        if (_availableTracks.value.none { it.type == "subtitle" }) {
            searchOnlineSubtitles()
        } else {
            _subtitleMessage.value = null
        }
    }

    override fun onCleared() {
        hudJob?.cancel()
        reporterJob?.cancel()
        scrubCommitJob?.cancel()
        runCatching { player.release() }
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
