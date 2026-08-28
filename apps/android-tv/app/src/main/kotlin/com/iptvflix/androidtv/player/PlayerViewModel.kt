package com.iptvflix.androidtv.player

import android.app.Application
import android.os.SystemClock
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
import com.iptvflix.androidtv.livetv.ChannelResponse
import com.iptvflix.androidtv.network.InteractionEventService
import com.iptvflix.androidtv.playback.AvailabilityVariant
import com.iptvflix.androidtv.playback.CatalogApi
import com.iptvflix.androidtv.playback.EpisodeListItem
import com.iptvflix.androidtv.playback.PlaybackApi
import com.iptvflix.androidtv.playback.PlaybackDescriptor
import com.iptvflix.androidtv.playback.PlaybackResolver
import com.iptvflix.androidtv.playback.SeasonSummary
import com.iptvflix.androidtv.playback.SegmentsApi
import com.iptvflix.androidtv.playback.StreamExtensionFallback
import com.iptvflix.androidtv.playback.TrackInfo
import com.iptvflix.androidtv.progress.ProgressReporter
import java.util.UUID
import kotlinx.coroutines.CancellationException
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
/** Slack for "at live edge" — keep tight so a short pause doesn't still read as DIRECT. */
private const val LIVE_EDGE_TOLERANCE_MS = 5_000L
/** Ignore tiny fake durations (HLS fragment windows) as DVR length. */
private const val MIN_LIVE_DVR_WINDOW_MS = 60_000L

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
    Episodes,
}

data class EpisodeBrowserState(
    val seriesId: String? = null,
    val seasonNumber: Int? = null,
    val seasons: List<SeasonSummary> = emptyList(),
    val episodes: List<EpisodeListItem> = emptyList(),
    val currentEpisodeId: String? = null,
    val nextEpisodeId: String? = null,
    val loading: Boolean = false,
    val posterUrl: String? = null,
    val episodeLabel: String? = null,
)

private data class ExoTrackRef(
    val group: Tracks.Group,
    val trackIndex: Int,
)

data class PlayerHudState(
    val positionMs: Long = 0L,
    val durationMs: Long = 0L,
    val bufferedPercent: Int = 0,
    /** Live TV channel currently loaded. */
    val isLiveChannel: Boolean = false,
    /** True when playhead is at (or very near) the live edge and playing. */
    val atLiveEdge: Boolean = true,
    /** How far behind the live edge, when known. */
    val liveOffsetMs: Long = 0L,
)

data class ScrubState(
    val active: Boolean = false,
    val previewMs: Long = 0L,
)

/** What the chrome should show — updated on every load/switch (parent command may be stale). */
data class NowPlayingInfo(
    val mediaId: String,
    val mediaType: String,
    val title: String? = null,
    val posterUrl: String? = null,
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

    private val _nowPlaying = MutableStateFlow<NowPlayingInfo?>(null)
    val nowPlaying: StateFlow<NowPlayingInfo?> = _nowPlaying.asStateFlow()

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

    private val _episodeBrowser = MutableStateFlow(EpisodeBrowserState())
    val episodeBrowser: StateFlow<EpisodeBrowserState> = _episodeBrowser.asStateFlow()

    private val zapper: ChannelZapper by lazy {
        ChannelZapper(
            repo = container.channelRepository,
            scope = viewModelScope,
            onSwitch = { channel -> switchChannel(channel.id, channel.name, channel.logoUrl) },
        )
    }
    val zapPreview: StateFlow<ZapPreviewState?> get() = zapper.previewState

    private val channelPrefetch: ChannelStreamPrefetcher by lazy {
        ChannelStreamPrefetcher(viewModelScope) { channelId ->
            PlaybackResolver(
                PlaybackApi(container.apiClient),
                container.lastAvailabilityStore,
            ).resolve(buildChannelSwitchCommand(channelId, null, null))
        }
    }

    private var exoTracksMap = mapOf<String, ExoTrackRef>()

    private var progressReporter: ProgressReporter? = null
    private var reporterJob: Job? = null
    private var loadJob: Job? = null
    private var hudJob: Job? = null
    private var scrubCommitJob: Job? = null
    private var episodeNavJob: Job? = null
    private var nearEndNextShown = false
    /** When false (chrome hidden), poll HUD slowly to avoid Compose jank on the video surface. */
    @Volatile
    private var hudPollingFast: Boolean = false

    private val interactionEvents: InteractionEventService by lazy {
        InteractionEventService(container.apiClient)
    }
    private var currentCommand: PlaybackCommand? = null
    /** Previous live channel while a zap remux is resolving — restored on timeout/cancel. */
    private var channelSwitchFallback: PlaybackCommand? = null
    private var sessionId: String? = null
    private var hasEmittedPlay = false
    private var sessionEnded = false
    private var loadedCommandId: String? = null
    private var pendingResumeMs: Long = 0L
    /** ElapsedRealtime when user last paused — used to soften post-pause recovery. */
    private var lastPausedAtElapsedMs: Long = 0L
    /**
     * Live TV: wall-clock pause debt. Remux HLS often reports liveOffset≈0 after resume
     * (no real DVR), so without this the UI falsely shows DIRECT.
     */
    private var livePauseStartedElapsedMs: Long = 0L
    private var livePauseDebtMs: Long = 0L
    private var sameUrlResumeRetryDone: Boolean = false
    private var scrubHoldTicks: Int = 0
    private var contentPosterUrl: String? = null
    private var currentStreamUrl: String? = null
    private var currentDeliveryMode: String = "DIRECT"
    private val triedStreamExtensions = mutableSetOf<String>()

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
        runCatching { player.setForegroundMode(true) }
        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                val stateName = when (state) {
                    Player.STATE_IDLE -> "IDLE"
                    Player.STATE_BUFFERING -> "BUFFERING"
                    Player.STATE_READY -> "READY"
                    Player.STATE_ENDED -> "ENDED"
                    else -> "OTHER($state)"
                }
                Log.i(TAG, "playbackState=$stateName playWhenReady=${player.playWhenReady} isPlaying=${player.isPlaying}")
                _uiState.value = when {
                    state == Player.STATE_ENDED -> PlayerUiState.Ended
                    // Background fill while paused must not flash "Chargement…"
                    state == Player.STATE_BUFFERING && !player.playWhenReady -> PlayerUiState.Paused
                    state == Player.STATE_BUFFERING -> PlayerUiState.Buffering
                    state == Player.STATE_READY && player.playWhenReady -> PlayerUiState.Playing
                    state == Player.STATE_READY -> PlayerUiState.Paused
                    else -> _uiState.value
                }
                if (state == Player.STATE_READY) {
                    maybeApplyResumeSeek()
                    // Do NOT PUT progress on every READY — pause→resume rebuffers fire READY
                    // and the network call contends with the stream reconnect (VOD lag).
                    if (currentCommand?.mediaType.equals("channel", ignoreCase = true)) {
                        currentCommand?.mediaId?.let { zapper.notifyPlaybackSuccess(it) }
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
                        // Defer analytics so resume bandwidth stays with the media socket.
                        viewModelScope.launch(Dispatchers.IO) {
                            delay(750)
                            emitEvent("PLAY_RESUMED")
                        }
                    } else if (!isPlaying) {
                        viewModelScope.launch(Dispatchers.IO) {
                            delay(250)
                            emitEvent("PLAY_PAUSED")
                        }
                    }
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                Log.e(TAG, "Playback error: ${error.errorCodeName} ${error.message}", error)
                if (retrySameUrlAfterPause(error)) return
                if (tryExtensionFallback(error)) return
                _uiState.value = PlayerUiState.Error(friendlyPlaybackError(error))
                // Keep Sources reachable so the user can pick a playable stream (e.g. non-4K).
                _openPanel.value = PlayerPanel.Sources
                if (currentCommand?.mediaType.equals("channel", ignoreCase = true)) {
                    zapper.notifyPlaybackError()
                    zapper.clearHud()
                }
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
                val live = currentCommand?.mediaType.equals("channel", ignoreCase = true) == true
                // Fast only while chrome/scrub needs a smooth scrubber; otherwise stay out
                // of the UI thread (was 250ms live → ~70% janky frames on emulator).
                val period = when {
                    hudPollingFast -> 400L
                    live -> 2_000L
                    else -> 1_000L
                }
                delay(period)
                if (!_scrub.value.active) refreshHud()
            }
        }
    }

    /** Call from PlayerScreen when controls / scrub / guide visibility changes. */
    fun setHudPollingFast(enabled: Boolean) {
        hudPollingFast = enabled
        if (enabled) refreshHud()
    }

    private fun refreshHud() {
        val pos = runCatching { player.currentPosition }.getOrDefault(0L).coerceAtLeast(0L)
        val dur = runCatching { player.duration }.getOrDefault(C.TIME_UNSET)
        val durationMs = if (dur == C.TIME_UNSET || dur < 0L) 0L else dur
        val buffered = runCatching { player.bufferedPercentage }.getOrDefault(0)
        val isLiveChannel = currentCommand?.mediaType.equals("channel", ignoreCase = true) == true
        val (atLiveEdge, liveOffsetMs) = computeLiveEdgeState(
            isLiveChannel = isLiveChannel,
            positionMs = pos,
            durationMs = durationMs,
        )
        val next = PlayerHudState(
            positionMs = pos,
            durationMs = durationMs,
            bufferedPercent = buffered,
            isLiveChannel = isLiveChannel,
            atLiveEdge = atLiveEdge,
            liveOffsetMs = liveOffsetMs,
        )
        val prev = _hud.value
        val changed = if (hudPollingFast || _scrub.value.active) {
            next != prev
        } else {
            // Chrome hidden: ignore playhead tick — it was recomposing the player ~4×/s.
            prev.isLiveChannel != next.isLiveChannel ||
                prev.atLiveEdge != next.atLiveEdge ||
                kotlin.math.abs(prev.liveOffsetMs - next.liveOffsetMs) > 2_000L ||
                kotlin.math.abs(prev.bufferedPercent - next.bufferedPercent) >= 8 ||
                prev.durationMs != next.durationMs
        }
        if (changed) {
            _hud.value = next
        }
        maybeShowNearEndNextEpisode(pos, durationMs)
    }

    private fun computeLiveEdgeState(
        isLiveChannel: Boolean,
        positionMs: Long,
        durationMs: Long,
    ): Pair<Boolean, Long> {
        if (!isLiveChannel) return true to 0L
        val behind = liveBehindMs(positionMs, durationMs)
        // Paused live is never "DIRECT" — delay keeps growing with wall clock.
        if (!player.playWhenReady) {
            return false to behind
        }
        return (behind <= LIVE_EDGE_TOLERANCE_MS) to behind
    }

    /**
     * How far the playhead is behind the live head.
     * Combines Exo currentLiveOffset (when meaningful) with wall-clock pause debt,
     * because media-relay remux playlists often don't expose a real DVR offset.
     */
    private fun liveBehindMs(positionMs: Long, durationMs: Long): Long {
        val raw = rawLiveBehindMs(positionMs, durationMs)
        val debt = livePauseDebtMs + activeLivePauseMs()
        return maxOf(raw, debt)
    }

    private fun rawLiveBehindMs(positionMs: Long, durationMs: Long): Long {
        val liveOffset = runCatching { player.currentLiveOffset }.getOrDefault(C.TIME_UNSET)
        if (liveOffset != C.TIME_UNSET && liveOffset >= 0L) {
            // Cap absurd offsets from broken playlists / progressive mis-detect.
            return liveOffset.coerceAtMost(30 * 60_000L)
        }
        // Only treat (duration − position) as live delay for a real Exo live window.
        // Progressive mkv/ts fallbacks report a long VOD-like duration — using that
        // as "behind live" produced −1:15 after a bad resume seek.
        val isLiveItem = runCatching { player.isCurrentMediaItemLive }.getOrDefault(false)
        if (isLiveItem && durationMs >= MIN_LIVE_DVR_WINDOW_MS) {
            return (durationMs - positionMs).coerceIn(0L, 30 * 60_000L)
        }
        return 0L
    }

    private fun activeLivePauseMs(): Long {
        if (livePauseStartedElapsedMs <= 0L) return 0L
        return (SystemClock.elapsedRealtime() - livePauseStartedElapsedMs).coerceAtLeast(0L)
    }

    private fun clearLivePauseDebt() {
        livePauseStartedElapsedMs = 0L
        livePauseDebtMs = 0L
    }

    private fun beginLivePauseDebt() {
        if (!currentCommand?.mediaType.equals("channel", ignoreCase = true)) return
        if (livePauseStartedElapsedMs > 0L) return
        livePauseStartedElapsedMs = SystemClock.elapsedRealtime()
    }

    private fun endLivePauseDebtSegment() {
        if (livePauseStartedElapsedMs <= 0L) return
        livePauseDebtMs += activeLivePauseMs()
        livePauseStartedElapsedMs = 0L
    }

    /** Jump playhead back to the configured live edge (stable HLS default). */
    fun jumpToLiveEdge() {
        viewModelScope.launch(Dispatchers.Main.immediate) {
            if (!currentCommand?.mediaType.equals("channel", ignoreCase = true)) return@launch
            _scrub.value = ScrubState()
            clearLivePauseDebt()
            runCatching {
                // Always use Exo's live default — seeking to duration−N overshoots the
                // available segments on many HLS feeds and freezes playback ("ça marche plus").
                if (player.isCurrentMediaItemLive) {
                    player.seekToDefaultPosition()
                } else {
                    val dur = player.duration
                    if (dur != C.TIME_UNSET && dur >= MIN_LIVE_DVR_WINDOW_MS) {
                        player.seekTo((dur - 3_000L).coerceAtLeast(0L))
                    }
                }
            }.onFailure { Log.w(TAG, "jumpToLiveEdge failed: ${it.message}") }
            player.playWhenReady = true
            refreshHud()
        }
    }

    private fun maybeShowNearEndNextEpisode(positionMs: Long, durationMs: Long) {
        if (nearEndNextShown || durationMs <= 0L) return
        val nextId = _episodeBrowser.value.nextEpisodeId ?: return
        if (nextId.isBlank()) return
        if (positionMs < (durationMs * 0.90).toLong()) return
        nearEndNextShown = true
        val already = _overlayActions.value.any { it is PlayerOverlayAction.NextEpisode }
        if (!already) {
            _overlayActions.value = _overlayActions.value + PlayerOverlayAction.NextEpisode()
        }
    }

    fun zapNext() {
        zapper.previewNext()
        prefetchZapTarget()
    }

    fun zapPrevious() {
        zapper.previewPrevious()
        prefetchZapTarget()
    }

    private fun prefetchZapTarget() {
        zapper.previewState.value?.selectedChannel?.id?.let { channelPrefetch.prefetch(it) }
    }

    fun confirmZapPreview() { zapper.confirmPreview() }
    fun cancelZapPreview() { zapper.cancelPreview() }
    fun clearZapHud() { zapper.cancelPreview() }

    fun load(command: PlaybackCommand, prefetched: PlaybackDescriptor? = null) {
        if (loadedCommandId == command.id &&
            player.playbackState != Player.STATE_IDLE &&
            player.playbackState != Player.STATE_ENDED
        ) {
            Log.d(TAG, "Skipping duplicate load for command ${command.id}")
            return
        }
        val softLiveSwitch = command.mediaType.equals("channel", ignoreCase = true) &&
            channelSwitchFallback != null &&
            channelSwitchFallback?.mediaId != command.mediaId &&
            prefetched == null
        loadedCommandId = command.id
        currentCommand = command
        // Soft zap: keep previous title on screen until the new stream is READY.
        if (!softLiveSwitch) {
            _nowPlaying.value = NowPlayingInfo(
                mediaId = command.mediaId,
                mediaType = command.mediaType,
                title = command.title,
                posterUrl = command.posterUrl,
            )
        }
        hasEmittedPlay = false
        sessionId = null
        sessionEnded = false
        pendingResumeMs = 0L
        lastPausedAtElapsedMs = 0L
        clearLivePauseDebt()
        sameUrlResumeRetryDone = false
        scrubHoldTicks = 0
        nearEndNextShown = false
        contentPosterUrl = command.posterUrl
        if (!softLiveSwitch) {
            currentStreamUrl = null
            currentDeliveryMode = "DIRECT"
            triedStreamExtensions.clear()
        }
        _scrub.value = ScrubState()
        _openPanel.value = PlayerPanel.None
        _subtitleMessage.value = null
        if (command.mediaType.equals("channel", ignoreCase = true) && !softLiveSwitch) {
            viewModelScope.launch(Dispatchers.IO) { zapper.initZapContext(command.mediaId) }
        }
        _episodeBrowser.value = EpisodeBrowserState(
            seriesId = command.seriesId,
            seasonNumber = command.seasonNumber,
            currentEpisodeId = command.mediaId.takeIf {
                command.mediaType.equals("episode", ignoreCase = true)
            },
            posterUrl = command.posterUrl,
        )
        loadJob?.cancel()
        reporterJob?.cancel()
        loadJob = viewModelScope.launch {
            val isChannel = command.mediaType.equals("channel", ignoreCase = true)
            val softLiveSwitch = isChannel && channelSwitchFallback != null && prefetched == null
            if (prefetched != null) {
                _uiState.value = PlayerUiState.Buffering
                withContext(Dispatchers.Main) {
                    player.stop()
                    player.clearMediaItems()
                }
            } else if (!softLiveSwitch) {
                _uiState.value = PlayerUiState.Buffering
            }
            runCatching {
                val descriptor = prefetched ?: withContext(Dispatchers.IO) {
                    PlaybackResolver(
                        PlaybackApi(container.apiClient),
                        container.lastAvailabilityStore,
                    ).resolve(command)
                }
                // A newer load superseded this one.
                if (loadedCommandId != command.id) return@launch
                // Live TV must never resume mid-window — that seeks into a fake DVR and
                // shows −1h "retard" while the playhead is nowhere near live.
                val desiredStartMs = if (isChannel) {
                    0L
                } else {
                    maxOf(command.startPositionMs, descriptor.startPositionMs)
                }
                pendingResumeMs = if (!isChannel && desiredStartMs > 30_000L) desiredStartMs else 0L

                _variants.value = descriptor.alternatives
                _selectedVariantId.value = descriptor.availabilityId ?: command.availabilityId
                currentStreamUrl = descriptor.streamUrl
                currentDeliveryMode = descriptor.deliveryMode
                StreamExtensionFallback.extractExtension(descriptor.streamUrl)?.let {
                    triedStreamExtensions.add(it)
                }

                withContext(Dispatchers.Main) {
                    if (loadedCommandId != command.id) return@withContext
                    player.stop()
                    player.clearMediaItems()
                    player.setMediaItem(
                        buildMediaItem(
                            descriptor.toMediaItemSpec(
                                isLive = isChannel,
                            ),
                        ),
                    )
                    player.playWhenReady = true
                    player.prepare()
                    player.play()
                }
                if (loadedCommandId != command.id) return@launch
                channelSwitchFallback = null
                _nowPlaying.value = NowPlayingInfo(
                    mediaId = command.mediaId,
                    mediaType = command.mediaType,
                    title = command.title,
                    posterUrl = command.posterUrl,
                )

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

                if (command.mediaType.equals("episode", ignoreCase = true)) {
                    loadEpisodeNavigation(command)
                }
            }.onFailure { e ->
                if (e is CancellationException) return@onFailure
                if (loadedCommandId != command.id) return@onFailure
                Log.e(TAG, "Failed to load: ${e.message}", e)
                if (isChannel) {
                    zapper.notifyPlaybackError()
                    val fallback = channelSwitchFallback
                    channelSwitchFallback = null
                    if (fallback != null && fallback.id != command.id) {
                        Log.w(TAG, "Zap failed — restoring ${fallback.title ?: fallback.mediaId}")
                        // Player may still be on the previous stream (soft switch).
                        val stillOnFallback = runCatching {
                            player.playbackState == Player.STATE_READY ||
                                player.playbackState == Player.STATE_BUFFERING
                        }.getOrDefault(false) && currentStreamUrl != null
                        if (stillOnFallback) {
                            loadedCommandId = fallback.id
                            currentCommand = fallback
                            _nowPlaying.value = NowPlayingInfo(
                                mediaId = fallback.mediaId,
                                mediaType = fallback.mediaType,
                                title = fallback.title,
                                posterUrl = fallback.posterUrl,
                            )
                            _uiState.value = if (player.isPlaying) {
                                PlayerUiState.Playing
                            } else {
                                PlayerUiState.Paused
                            }
                            _openPanel.value = PlayerPanel.None
                            return@onFailure
                        }
                        load(fallback)
                        return@onFailure
                    }
                }
                _uiState.value = PlayerUiState.Error(e.message ?: "Impossible de charger le média")
            }
        }
    }

    private fun loadEpisodeNavigation(command: PlaybackCommand) {
        episodeNavJob?.cancel()
        episodeNavJob = viewModelScope.launch {
            _episodeBrowser.value = _episodeBrowser.value.copy(loading = true)
            runCatching {
                val catalog = CatalogApi(container.apiClient)
                val profileId = container.secureStorage.getLastUsedProfileId()
                var seriesId = command.seriesId
                var seasonNumber = command.seasonNumber
                var posterUrl = command.posterUrl
                var episodeLabel: String? = null

                if (seriesId.isNullOrBlank() || seasonNumber == null) {
                    val ctx = withContext(Dispatchers.IO) {
                        catalog.getEpisodeContext(command.mediaId)
                    }
                    seriesId = ctx.seriesId
                    seasonNumber = ctx.seasonNumber
                    posterUrl = posterUrl ?: ctx.posterUrl
                    episodeLabel = formatEpisodeLabel(ctx.seasonNumber, ctx.episodeNumber, ctx.title)
                    contentPosterUrl = contentPosterUrl ?: ctx.posterUrl
                }

                val sid = seriesId ?: return@runCatching
                val season = seasonNumber ?: return@runCatching

                val seasons = withContext(Dispatchers.IO) {
                    runCatching { catalog.getSeriesSeasons(sid) }.getOrDefault(emptyList())
                }
                val episodes = withContext(Dispatchers.IO) {
                    catalog.getSeasonEpisodes(sid, season, profileId)
                }
                val idx = episodes.indexOfFirst { it.id == command.mediaId }
                val current = episodes.getOrNull(idx)
                val next = episodes.getOrNull(idx + 1)
                if (episodeLabel == null && current != null) {
                    episodeLabel = formatEpisodeLabel(season, current.episodeNumber, current.title)
                }
                val scrubPoster = posterUrl
                    ?: current?.posterUrl
                    ?: episodes.firstOrNull()?.posterUrl
                contentPosterUrl = contentPosterUrl ?: scrubPoster

                _episodeBrowser.value = EpisodeBrowserState(
                    seriesId = sid,
                    seasonNumber = season,
                    seasons = seasons.ifEmpty {
                        listOf(SeasonSummary(seasonNumber = season, episodeCount = episodes.size))
                    },
                    episodes = episodes,
                    currentEpisodeId = command.mediaId,
                    nextEpisodeId = next?.id,
                    loading = false,
                    posterUrl = scrubPoster,
                    episodeLabel = episodeLabel,
                )
            }.onFailure { e ->
                Log.w(TAG, "Episode navigation load failed: ${e.message}")
                _episodeBrowser.value = _episodeBrowser.value.copy(loading = false)
            }
        }
    }

    fun selectSeason(seasonNumber: Int) {
        val seriesId = _episodeBrowser.value.seriesId ?: return
        if (seasonNumber == _episodeBrowser.value.seasonNumber &&
            _episodeBrowser.value.episodes.isNotEmpty()
        ) {
            return
        }
        viewModelScope.launch {
            _episodeBrowser.value = _episodeBrowser.value.copy(loading = true, seasonNumber = seasonNumber)
            runCatching {
                val catalog = CatalogApi(container.apiClient)
                val profileId = container.secureStorage.getLastUsedProfileId()
                val episodes = withContext(Dispatchers.IO) {
                    catalog.getSeasonEpisodes(seriesId, seasonNumber, profileId)
                }
                val currentId = currentCommand?.mediaId
                val idx = episodes.indexOfFirst { it.id == currentId }
                val next = if (idx >= 0) episodes.getOrNull(idx + 1) else null
                _episodeBrowser.value = _episodeBrowser.value.copy(
                    seasonNumber = seasonNumber,
                    episodes = episodes,
                    nextEpisodeId = next?.id,
                    loading = false,
                )
            }.onFailure { e ->
                Log.w(TAG, "selectSeason failed: ${e.message}")
                _episodeBrowser.value = _episodeBrowser.value.copy(loading = false)
            }
        }
    }

    fun playEpisode(episode: EpisodeListItem) {
        val browser = _episodeBrowser.value
        val seriesId = browser.seriesId ?: return
        if (episode.id == currentCommand?.mediaId) {
            closePanel()
            return
        }
        if (episode.availabilityStatus.equals("UNAVAILABLE", ignoreCase = true) &&
            episode.availabilityCount <= 0
        ) {
            return
        }
        emitEvent("NEXT_EPISODE_MANUAL", mapOf("targetMediaId" to episode.id))
        viewModelScope.launch {
            // Flush current episode, then seed the next so CW keeps the series
            // even if the user quits before ExoPlayer reports a duration.
            progressReporter?.reportNow()
            seedEpisodeStarted(episode)
        }
        val season = browser.seasonNumber
        val title = formatEpisodeLabel(season, episode.episodeNumber, episode.title)
            ?: episode.title
            ?: currentCommand?.title
        load(
            PlaybackCommand(
                id = "ep-${UUID.randomUUID()}",
                mediaType = "episode",
                mediaId = episode.id,
                availabilityId = episode.selectedVariantId
                    ?: container.lastAvailabilityStore.get("episode", episode.id),
                startPositionMs = 0L,
                title = title,
                seriesId = seriesId,
                seasonNumber = season,
                posterUrl = episode.posterUrl ?: browser.posterUrl,
            ),
        )
    }

    /** Ensure new episode is CW-eligible (≥2s) as soon as we switch to it. */
    private suspend fun seedEpisodeStarted(episode: EpisodeListItem) {
        val durationSeconds = ((episode.durationMinutes ?: 45).coerceAtLeast(1) * 60)
        val body = """{"progressSeconds":2,"durationSeconds":$durationSeconds}"""
        runCatching {
            withContext(Dispatchers.IO) {
                container.apiClient.put("/progress/EPISODE/${episode.id}", body)
            }
        }.onFailure { Log.w(TAG, "seedEpisodeStarted failed: ${it.message}") }
    }

    fun playNextEpisode() {
        val nextId = _episodeBrowser.value.nextEpisodeId ?: return
        val episode = _episodeBrowser.value.episodes.find { it.id == nextId } ?: return
        playEpisode(episode)
    }

    fun switchChannel(channelId: String, title: String?, logoUrl: String?) {
        val cmd = buildChannelSwitchCommand(channelId, title, logoUrl)
        val prefetched = channelPrefetch.take(channelId)
        if (prefetched != null) {
            channelSwitchFallback = null
            load(cmd, prefetched = prefetched)
            return
        }
        val previous = currentCommand
        if (previous != null &&
            previous.mediaType.equals("channel", ignoreCase = true) &&
            previous.mediaId != channelId
        ) {
            channelSwitchFallback = previous
        }
        load(cmd)
    }

    fun cancelChannelSwitch() {
        val fallback = channelSwitchFallback ?: return
        loadJob?.cancel()
        channelSwitchFallback = null
        zapper.notifyPlaybackError()
        loadedCommandId = fallback.id
        currentCommand = fallback
        _nowPlaying.value = NowPlayingInfo(
            mediaId = fallback.mediaId,
            mediaType = fallback.mediaType,
            title = fallback.title,
            posterUrl = fallback.posterUrl,
        )
        _openPanel.value = PlayerPanel.None
        val playing = runCatching { player.isPlaying }.getOrDefault(false)
        val ready = runCatching { player.playbackState == Player.STATE_READY }.getOrDefault(false)
        _uiState.value = when {
            playing -> PlayerUiState.Playing
            ready -> PlayerUiState.Paused
            else -> {
                load(fallback)
                return
            }
        }
    }

    fun isChannelSwitchPending(): Boolean = channelSwitchFallback != null

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

    /**
     * After a pause, Xtream often drops the idle HTTP socket; the first Range reopen
     * can 551/timeout. Retry the same URL once at the current position before flipping
     * container extensions (which remounts the pipeline and feels like a long lag).
     */
    private fun retrySameUrlAfterPause(error: PlaybackException): Boolean {
        if (sameUrlResumeRetryDone) return false
        if (currentCommand?.mediaType.equals("channel", ignoreCase = true) == true) return false
        val sincePause = SystemClock.elapsedRealtime() - lastPausedAtElapsedMs
        if (lastPausedAtElapsedMs <= 0L || sincePause > 120_000L) return false
        if (!isTransientStreamIo(error)) return false
        val url = currentStreamUrl ?: return false
        val positionMs = runCatching { player.currentPosition }.getOrDefault(0L).coerceAtLeast(0L)
        sameUrlResumeRetryDone = true
        if (positionMs > 5_000L) pendingResumeMs = positionMs
        Log.w(TAG, "Post-pause IO error — retrying same URL at ${positionMs}ms")
        _uiState.value = PlayerUiState.Buffering
        return runCatching {
            player.stop()
            player.clearMediaItems()
            player.setMediaItem(
                buildMediaItem(
                    PlaybackDescriptor(
                        streamUrl = url,
                        deliveryMode = currentDeliveryMode,
                        containerExtension = StreamExtensionFallback.extractExtension(url),
                    ).toMediaItemSpec(isLive = false),
                ),
            )
            player.prepare()
            player.playWhenReady = true
            true
        }.getOrDefault(false)
    }

    private fun isTransientStreamIo(error: PlaybackException): Boolean {
        if (error.errorCode == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED ||
            error.errorCode == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT ||
            error.errorCode == PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS
        ) {
            return true
        }
        return isProviderContainerRefusal(error)
    }

    /**
     * Xtream HTTP 551 often means "this container extension is refused".
     * Silently try mkv → mp4 → ts → m3u8 before showing the Sources panel.
     */
    private fun tryExtensionFallback(error: PlaybackException): Boolean {
        if (!isProviderContainerRefusal(error)) return false
        val url = currentStreamUrl ?: return false
        val next = StreamExtensionFallback.next(url, triedStreamExtensions) ?: return false
        val (nextUrl, ext) = next
        triedStreamExtensions.add(ext)
        currentStreamUrl = nextUrl
        val isChannel = currentCommand?.mediaType.equals("channel", ignoreCase = true) == true
        val positionMs = runCatching { player.currentPosition }.getOrDefault(0L).coerceAtLeast(0L)
        // Never carry VOD-style resume into a live channel after a 551/extension flip.
        if (!isChannel && positionMs > 5_000L) pendingResumeMs = positionMs
        Log.w(TAG, "Provider refused stream — retrying with .$ext (keep pos=${if (isChannel) 0L else positionMs}ms)")
        _uiState.value = PlayerUiState.Buffering
        _openPanel.value = PlayerPanel.None
        val spec = PlaybackDescriptor(
            streamUrl = nextUrl,
            deliveryMode = if (ext == "m3u8") "HLS" else currentDeliveryMode,
            containerExtension = ext,
        ).toMediaItemSpec(isLive = isChannel)
        return runCatching {
            player.stop()
            player.clearMediaItems()
            player.setMediaItem(buildMediaItem(spec))
            player.prepare()
            player.playWhenReady = true
            true
        }.getOrDefault(false)
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
            val pausing = player.playWhenReady
            if (pausing) {
                lastPausedAtElapsedMs = SystemClock.elapsedRealtime()
                sameUrlResumeRetryDone = false
                beginLivePauseDebt()
                player.playWhenReady = false
                refreshHud()
                // Flush CW off the playback critical path so resume isn't stalled.
                val reporter = progressReporter
                viewModelScope.launch(Dispatchers.IO) {
                    delay(400)
                    reporter?.reportNow()
                }
            } else {
                endLivePauseDebtSegment()
                player.playWhenReady = true
                refreshHud()
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
                is PlayerOverlayAction.NextEpisode -> {
                    emitEvent("NEXT_EPISODE_MANUAL")
                    playNextEpisode()
                }
                is PlayerOverlayAction.Custom -> Log.d(TAG, "Overlay action not wired yet: ${action.id}")
            }
        }
    }

    fun stop() {
        zapper.clearHud()
        channelSwitchFallback = null
        channelPrefetch.clear()
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
        loadJob?.cancel()
        scrubCommitJob?.cancel()
        episodeNavJob?.cancel()
        loadedCommandId = null
        _nowPlaying.value = null
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
        episodeNavJob?.cancel()
        runCatching { player.release() }
        super.onCleared()
    }
}

internal fun buildChannelSwitchCommand(
    channelId: String,
    title: String?,
    logoUrl: String?,
): PlaybackCommand = PlaybackCommand(
    id = "ch-${UUID.randomUUID()}",
    mediaType = "channel",
    mediaId = channelId,
    startPositionMs = 0L,
    title = title,
    posterUrl = logoUrl,
)

private fun formatEpisodeLabel(seasonNumber: Int?, episodeNumber: Int?, title: String?): String? {
    if (seasonNumber == null || episodeNumber == null) {
        return title?.takeIf { it.isNotBlank() }
    }
    val base = "S${seasonNumber.toString().padStart(2, '0')}E${episodeNumber.toString().padStart(2, '0')}"
    val epTitle = title?.takeIf { it.isNotBlank() }
    return if (epTitle != null) "$base · $epTitle" else base
}

private fun isProviderContainerRefusal(error: PlaybackException): Boolean {
    val cause = error.cause?.message.orEmpty()
    val msg = error.message.orEmpty()
    val blob = "$cause $msg".lowercase()
    return blob.contains("551") || blob.contains("response code: 551")
}

private fun friendlyPlaybackError(error: PlaybackException): String {
    val code = error.errorCode
    val cause = error.cause?.message?.lowercase().orEmpty()
    val msg = (error.message ?: "").lowercase()
    return when {
        code == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED ||
            code == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT ->
            "Connexion au flux impossible. Vérifiez le Wi‑Fi de la TV."
        msg.contains("551") || cause.contains("551") ->
            "Source indisponible chez le fournisseur (551). Essayez l'autre source."
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
