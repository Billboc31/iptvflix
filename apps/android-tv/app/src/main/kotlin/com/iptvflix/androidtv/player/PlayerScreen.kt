package com.iptvflix.androidtv.player

import android.view.LayoutInflater
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.times
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.media3.ui.PlayerView
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.iptvflix.androidtv.R
import com.iptvflix.androidtv.command.PlaybackCommand
import com.iptvflix.androidtv.playback.AvailabilityVariant
import com.iptvflix.androidtv.playback.TrackInfo
import com.iptvflix.androidtv.playback.label
import com.iptvflix.androidtv.ui.TvColors
import kotlinx.coroutines.delay

private val NetflixRed = Color(0xFFE50914)
private val HudWhite = Color(0xFFFFFFFF)
private val HudMuted = Color(0xB3FFFFFF)
private val PanelScrim = Color(0xCC141414)
private const val AUTO_HIDE_MS = 3_200L

@Composable
fun PlayerScreen(
    command: PlaybackCommand?,
    onStop: () -> Unit,
    vm: PlayerViewModel = viewModel(),
) {
    val uiState by vm.uiState.collectAsState()
    val hud by vm.hud.collectAsState()
    val scrub by vm.scrub.collectAsState()
    val overlayActions by vm.overlayActions.collectAsState()
    val variants by vm.variants.collectAsState()
    val selectedVariantId by vm.selectedVariantId.collectAsState()
    val tracks by vm.availableTracks.collectAsState()
    val selectedTrackIds by vm.selectedTrackIds.collectAsState()
    val openPanel by vm.openPanel.collectAsState()
    val subtitleMessage by vm.subtitleMessage.collectAsState()
    var showControls by remember { mutableStateOf(true) }
    var interactionTick by remember { mutableIntStateOf(0) }
    val focusRequester = remember { FocusRequester() }
    var playerViewRef by remember { mutableStateOf<PlayerView?>(null) }

    val visibleActions = remember(overlayActions, hud.positionMs, scrub) {
        val pos = if (scrub.active) scrub.previewMs else hud.positionMs
        overlayActions.visibleAt(pos)
    }

    fun bumpInteraction(show: Boolean = true) {
        if (show) showControls = true
        interactionTick++
    }

    LaunchedEffect(command?.id) {
        if (command != null) {
            showControls = true
            interactionTick++
            vm.load(command)
        }
    }

    LaunchedEffect(uiState) {
        if (uiState is PlayerUiState.Error) {
            showControls = true
            interactionTick++
        }
    }

    LaunchedEffect(interactionTick, uiState, scrub.active, openPanel) {
        when (uiState) {
            is PlayerUiState.Ended -> {
                delay(2_000)
                vm.stop()
                onStop()
            }
            is PlayerUiState.Playing -> {
                if (scrub.active) return@LaunchedEffect
                delay(AUTO_HIDE_MS)
                if (openPanel != PlayerPanel.None) vm.closePanel()
                showControls = false
            }
            is PlayerUiState.Error -> Unit // keep chrome + panels visible
            else -> Unit
        }
    }

    DisposableEffect(Unit) {
        onDispose { playerViewRef?.player = null }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .focusRequester(focusRequester)
            .focusable()
            .pointerInput(Unit) {
                detectTapGestures(
                    onTap = {
                        if (openPanel != PlayerPanel.None) {
                            vm.closePanel()
                            bumpInteraction()
                        } else {
                            showControls = !showControls
                            if (showControls) interactionTick++
                        }
                    },
                )
            }
            .onKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown) return@onKeyEvent false
                bumpInteraction()
                if (openPanel != PlayerPanel.None && event.key == Key.Back) {
                    vm.closePanel()
                    return@onKeyEvent true
                }
                when (event.key) {
                    Key.DirectionCenter, Key.Enter, Key.MediaPlay, Key.MediaPause, Key.MediaPlayPause -> {
                        vm.togglePlayPause(); true
                    }
                    Key.DirectionRight -> { vm.seekForward(); true }
                    Key.DirectionLeft -> { vm.seekBack(); true }
                    Key.Back, Key.Escape -> {
                        when {
                            openPanel != PlayerPanel.None -> { vm.closePanel(); true }
                            showControls -> { showControls = false; true }
                            else -> { vm.stop(); onStop(); true }
                        }
                    }
                    else -> false
                }
            },
    ) {
        PlayerOverlayStack(
            video = {
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { ctx ->
                        (LayoutInflater.from(ctx).inflate(R.layout.player_view, null) as PlayerView).also { view ->
                            view.player = vm.player
                            playerViewRef = view
                        }
                    },
                    update = { view ->
                        if (view.player !== vm.player) view.player = vm.player
                        playerViewRef = view
                    },
                )
            },
            statusContent = {
                AnimatedVisibility(
                    visible = showControls || scrub.active || openPanel != PlayerPanel.None,
                    enter = fadeIn(),
                    exit = fadeOut(),
                    modifier = Modifier.fillMaxSize(),
                ) {
                    Box(Modifier.fillMaxSize()) {
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .height(120.dp)
                                .align(Alignment.TopCenter)
                                .background(Brush.verticalGradient(listOf(Color(0x99000000), Color.Transparent))),
                        )
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .height(220.dp)
                                .align(Alignment.BottomCenter)
                                .background(Brush.verticalGradient(listOf(Color.Transparent, Color(0xE6000000)))),
                        )
                    }
                }
                when (val s = uiState) {
                    is PlayerUiState.Error -> ErrorBanner(
                        message = s.message,
                        hint = if (variants.isNotEmpty()) {
                            "Choisissez une autre source (ex. 1080p) ci-dessous"
                        } else {
                            "Appuyez sur Retour pour quitter"
                        },
                    )
                    is PlayerUiState.Ended -> CenterStatus("Lecture terminée", "Retour à l'accueil…")
                    is PlayerUiState.Buffering -> if (!showControls) CenterStatus("Chargement…", "")
                    else -> Unit
                }
            },
            actionContent = {
                if (uiState !is PlayerUiState.Error && visibleActions.isNotEmpty() && openPanel == PlayerPanel.None) {
                    PlayerActionOverlays(
                        actions = visibleActions,
                        onAction = {
                            bumpInteraction()
                            vm.onOverlayAction(it)
                        },
                    )
                }
            },
            chromeContent = {
                AnimatedVisibility(
                    visible = showControls || scrub.active || openPanel != PlayerPanel.None ||
                        uiState is PlayerUiState.Error,
                    enter = fadeIn(),
                    exit = fadeOut(),
                    modifier = Modifier.fillMaxSize(),
                ) {
                    NetflixPlayerChrome(
                        title = command?.title,
                        isPlaying = uiState is PlayerUiState.Playing,
                        isBuffering = uiState is PlayerUiState.Buffering,
                        hud = hud,
                        scrub = scrub,
                        variants = variants,
                        selectedVariantId = selectedVariantId,
                        audioTracks = tracks.filter { it.type == "audio" },
                        subtitleTracks = tracks.filter { it.type == "subtitle" },
                        selectedTrackIds = selectedTrackIds,
                        openPanel = openPanel,
                        subtitleMessage = subtitleMessage,
                        onBack = { vm.stop(); onStop() },
                        onPlayPause = { bumpInteraction(); vm.togglePlayPause() },
                        onSeekBack = { bumpInteraction(); vm.seekBack() },
                        onSeekForward = { bumpInteraction(); vm.seekForward() },
                        onScrubStart = { bumpInteraction(); vm.beginBarScrub(it) },
                        onScrubUpdate = { bumpInteraction(); vm.updateBarScrub(it) },
                        onScrubEnd = { bumpInteraction(); vm.endBarScrub() },
                        onScrubTap = { bumpInteraction(); vm.seekToFraction(it) },
                        onOpenLanguages = {
                            bumpInteraction()
                            vm.openPanel(PlayerPanel.Subtitles)
                        },
                        onOpenSources = { bumpInteraction(); vm.openPanel(PlayerPanel.Sources) },
                        onSelectVariant = { bumpInteraction(); vm.switchVariant(it) },
                        onSelectTrack = { bumpInteraction(); vm.enableSubtitlesAndSelect(it) },
                        onSelectAudio = { bumpInteraction(); vm.selectTrack(it) },
                        onDisableSubtitles = { bumpInteraction(); vm.disableSubtitles() },
                        onSearchOnlineSubtitles = { bumpInteraction(); vm.searchOnlineSubtitles() },
                        onClosePanel = { bumpInteraction(); vm.closePanel() },
                    )
                }
            },
        )
    }

    LaunchedEffect(Unit) {
        runCatching { focusRequester.requestFocus() }
    }
}

@Composable
private fun NetflixPlayerChrome(
    title: String?,
    isPlaying: Boolean,
    isBuffering: Boolean,
    hud: PlayerHudState,
    scrub: ScrubState,
    variants: List<AvailabilityVariant>,
    selectedVariantId: String?,
    audioTracks: List<TrackInfo>,
    subtitleTracks: List<TrackInfo>,
    selectedTrackIds: Map<String, String>,
    openPanel: PlayerPanel,
    subtitleMessage: String?,
    onBack: () -> Unit,
    onPlayPause: () -> Unit,
    onSeekBack: () -> Unit,
    onSeekForward: () -> Unit,
    onScrubStart: (Float) -> Unit,
    onScrubUpdate: (Float) -> Unit,
    onScrubEnd: () -> Unit,
    onScrubTap: (Float) -> Unit,
    onOpenLanguages: () -> Unit,
    onOpenSources: () -> Unit,
    onSelectVariant: (String) -> Unit,
    onSelectTrack: (String) -> Unit,
    onSelectAudio: (String) -> Unit,
    onDisableSubtitles: () -> Unit,
    onSearchOnlineSubtitles: () -> Unit,
    onClosePanel: () -> Unit,
) {
    val displayMs = if (scrub.active) scrub.previewMs else hud.positionMs
    val progress = if (hud.durationMs > 0L) {
        (displayMs.toFloat() / hud.durationMs.toFloat()).coerceIn(0f, 1f)
    } else {
        0f
    }
    val remainingMs = (hud.durationMs - displayMs).coerceAtLeast(0L)
    val showLanguages = openPanel == PlayerPanel.Audio || openPanel == PlayerPanel.Subtitles
    val displayTitle = title?.takeIf { it.isNotBlank() }

    Box(modifier = Modifier.fillMaxSize()) {
        // Top: back + IPTVFlix + film title
        Row(
            modifier = Modifier
                .align(Alignment.TopStart)
                .fillMaxWidth()
                .padding(start = 24.dp, end = 40.dp, top = 24.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconHit(onClick = onBack) {
                Glyph.Back(iconMod = Modifier.size(26.dp), color = HudWhite)
            }
            Spacer(Modifier.width(10.dp))
            Text(
                "IPTVFlix",
                color = NetflixRed,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
            )
            if (!displayTitle.isNullOrBlank()) {
                Text(
                    "  ·  ",
                    color = HudMuted,
                    fontSize = 18.sp,
                )
                Text(
                    displayTitle,
                    color = HudWhite,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
            }
        }

        // Center dual-column Audio | Sous-titres
        if (showLanguages) {
            LanguagesPanel(
                audioTracks = audioTracks,
                subtitleTracks = subtitleTracks,
                selectedTrackIds = selectedTrackIds,
                subtitleMessage = subtitleMessage,
                onSelectAudio = onSelectAudio,
                onSelectTrack = onSelectTrack,
                onDisableSubtitles = onDisableSubtitles,
                onSearchOnlineSubtitles = onSearchOnlineSubtitles,
                onClose = onClosePanel,
                modifier = Modifier.align(Alignment.Center),
            )
        }

        if (openPanel == PlayerPanel.Sources) {
            SourcesPanel(
                variants = variants,
                selectedVariantId = selectedVariantId,
                embeddedAudioTrackCount = audioTracks.size,
                onSelectVariant = onSelectVariant,
                onClose = onClosePanel,
                modifier = Modifier.align(Alignment.Center),
            )
        }

        // Bottom chrome (Netflix layout)
        if (!showLanguages && openPanel != PlayerPanel.Sources) {
            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(horizontal = 40.dp, vertical = 28.dp),
            ) {
                ProgressRail(
                    progress = progress,
                    bufferedPercent = hud.bufferedPercent,
                    displayMs = displayMs,
                    remainingLabel = if (hud.durationMs > 0L) formatTime(remainingMs) else "--:--",
                    scrubbing = scrub.active,
                    onScrubStart = onScrubStart,
                    onScrubUpdate = onScrubUpdate,
                    onScrubEnd = onScrubEnd,
                    onScrubTap = onScrubTap,
                )

                Spacer(Modifier.height(14.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        IconHit(onClick = onPlayPause) {
                            if (isBuffering) {
                                Text("…", color = HudWhite, fontSize = 22.sp)
                            } else if (isPlaying) {
                                Glyph.Pause(iconMod = Modifier.size(26.dp), color = HudWhite)
                            } else {
                                Glyph.Play(iconMod = Modifier.size(26.dp), color = HudWhite)
                            }
                        }
                        IconHit(onClick = onSeekBack) {
                            Glyph.Seek10(iconMod = Modifier.size(30.dp), color = HudWhite, forward = false)
                        }
                        IconHit(onClick = onSeekForward) {
                            Glyph.Seek10(iconMod = Modifier.size(30.dp), color = HudWhite, forward = true)
                        }
                    }

                    Spacer(Modifier.weight(1f))

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        if (variants.size > 1) {
                            LabeledIconAction(
                                label = "Sources",
                                onClick = onOpenSources,
                            ) {
                                Glyph.Sources(iconMod = Modifier.size(22.dp), color = HudWhite)
                            }
                        }
                        LabeledIconAction(
                            label = "Audio & ST",
                            onClick = onOpenLanguages,
                        ) {
                            Glyph.SpeechBubble(iconMod = Modifier.size(22.dp), color = HudWhite)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ProgressRail(
    progress: Float,
    bufferedPercent: Int,
    displayMs: Long,
    remainingLabel: String,
    scrubbing: Boolean,
    onScrubStart: (Float) -> Unit,
    onScrubUpdate: (Float) -> Unit,
    onScrubEnd: () -> Unit,
    onScrubTap: (Float) -> Unit,
) {
    val safe = progress.coerceIn(0f, 1f)
    val previewWidth = 160.dp
    val timeLabelWidth = 72.dp
    val railHeight = if (scrubbing) 132.dp else 48.dp

    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Bottom,
    ) {
        BoxWithConstraints(
            modifier = Modifier
                .weight(1f)
                .height(railHeight),
        ) {
            val trackWidth = maxWidth
            val thumbX = trackWidth * safe
            val previewX = (thumbX - previewWidth / 2)
                .coerceIn(0.dp, (trackWidth - previewWidth).coerceAtLeast(0.dp))
            val timeX = (thumbX - timeLabelWidth / 2)
                .coerceIn(0.dp, (trackWidth - timeLabelWidth).coerceAtLeast(0.dp))
            val trackTop = if (scrubbing) 102.dp else 12.dp

            if (scrubbing) {
                // Time-preview card above the thumb (real film frames = future sprite pipeline).
                Column(
                    modifier = Modifier
                        .offset(x = previewX, y = 0.dp)
                        .width(previewWidth),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(78.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(Color(0xEE1A1A1A))
                            .border(2.dp, Color.White, RoundedCornerShape(2.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            formatTime(displayMs),
                            color = Color.White,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }

            // Interactive track
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(28.dp)
                    .offset(y = trackTop - 12.dp)
                    .pointerInput(Unit) {
                        detectTapGestures { offset ->
                            val f = (offset.x / size.width.toFloat()).coerceIn(0f, 1f)
                            onScrubTap(f)
                        }
                    }
                    .pointerInput(Unit) {
                        detectHorizontalDragGestures(
                            onDragStart = { offset ->
                                val f = (offset.x / size.width.toFloat()).coerceIn(0f, 1f)
                                onScrubStart(f)
                            },
                            onHorizontalDrag = { change, _ ->
                                change.consume()
                                val f = (change.position.x / size.width.toFloat()).coerceIn(0f, 1f)
                                onScrubUpdate(f)
                            },
                            onDragEnd = { onScrubEnd() },
                            onDragCancel = { onScrubEnd() },
                        )
                    },
                contentAlignment = Alignment.CenterStart,
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(4.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(Color(0x55FFFFFF)),
                ) {
                    if (bufferedPercent > 0) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth((bufferedPercent / 100f).coerceIn(0f, 1f))
                                .fillMaxHeight()
                                .background(Color(0x66FFFFFF)),
                        )
                    }
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(safe.coerceAtLeast(0.004f))
                            .fillMaxHeight()
                            .background(NetflixRed),
                    )
                }
                Box(
                    modifier = Modifier
                        .fillMaxWidth(safe)
                        .height(28.dp),
                    contentAlignment = Alignment.CenterEnd,
                ) {
                    Box(
                        modifier = Modifier
                            .size(if (scrubbing) 18.dp else 14.dp)
                            .offset(x = 7.dp)
                            .clip(CircleShape)
                            .background(NetflixRed),
                    )
                }
            }

            // Current time under the thumb
            Text(
                text = formatTime(displayMs),
                color = HudWhite,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .offset(x = timeX, y = trackTop + 18.dp)
                    .width(timeLabelWidth),
            )
        }

        Spacer(Modifier.width(14.dp))
        Text(
            remainingLabel,
            color = HudWhite,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(bottom = 4.dp),
        )
    }
}

@Composable
private fun LanguagesPanel(
    audioTracks: List<TrackInfo>,
    subtitleTracks: List<TrackInfo>,
    selectedTrackIds: Map<String, String>,
    subtitleMessage: String?,
    onSelectAudio: (String) -> Unit,
    onSelectTrack: (String) -> Unit,
    onDisableSubtitles: () -> Unit,
    onSearchOnlineSubtitles: () -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxWidth(0.72f)
            .fillMaxHeight(0.78f)
            .clip(RoundedCornerShape(4.dp))
            .background(PanelScrim)
            .padding(28.dp),
    ) {
        IconHit(
            onClick = onClose,
            modifier = Modifier.align(Alignment.TopStart),
        ) {
            Glyph.Back(iconMod = Modifier.size(24.dp), color = HudWhite)
        }

        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = 40.dp),
            horizontalArrangement = Arrangement.spacedBy(40.dp),
        ) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .verticalScroll(rememberScrollState()),
            ) {
                Text("Audio", color = HudWhite, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(18.dp))
                if (audioTracks.isEmpty()) {
                    Text("Aucune piste audio", color = HudMuted, fontSize = 15.sp)
                } else {
                    audioTracks.forEach { track ->
                        CheckOption(
                            label = track.label,
                            selected = selectedTrackIds["audio"] == track.id,
                            onClick = { onSelectAudio(track.id) },
                        )
                    }
                }
            }
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .verticalScroll(rememberScrollState()),
            ) {
                Text("Sous-titres", color = HudWhite, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(18.dp))
                CheckOption(
                    label = "désactivés",
                    selected = selectedTrackIds["subtitle"] == null,
                    onClick = onDisableSubtitles,
                )
                subtitleTracks.forEach { track ->
                    CheckOption(
                        label = track.label,
                        selected = selectedTrackIds["subtitle"] == track.id,
                        onClick = { onSelectTrack(track.id) },
                    )
                }
                CheckOption(
                    label = "Chercher en ligne",
                    selected = false,
                    onClick = onSearchOnlineSubtitles,
                )
                if (!subtitleMessage.isNullOrBlank()) {
                    Text(
                        subtitleMessage,
                        color = HudMuted,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(top = 12.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun SourcesPanel(
    variants: List<AvailabilityVariant>,
    selectedVariantId: String?,
    embeddedAudioTrackCount: Int = 0,
    onSelectVariant: (String) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .widthIn(max = 480.dp)
            .fillMaxWidth(0.45f)
            .clip(RoundedCornerShape(4.dp))
            .background(PanelScrim)
            .padding(28.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Sources", color = HudWhite, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            IconHit(onClick = onClose) {
                Glyph.Back(iconMod = Modifier.size(22.dp), color = HudWhite)
            }
        }
        Spacer(Modifier.height(18.dp))
        variants.forEach { variant ->
            val audioCount = if (variant.id == selectedVariantId) embeddedAudioTrackCount else 0
            CheckOption(
                label = variant.label(variants, embeddedAudioTrackCount = audioCount),
                selected = variant.id == selectedVariantId,
                onClick = { onSelectVariant(variant.id) },
            )
        }
    }
}

@Composable
private fun CheckOption(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Surface(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 3.dp)
            .pointerInput(onClick) { detectTapGestures(onTap = { onClick() }) },
        shape = ClickableSurfaceDefaults.shape(shape = RoundedCornerShape(2.dp)),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = Color.Transparent,
            focusedContainerColor = Color(0x33FFFFFF),
            pressedContainerColor = Color(0x22FFFFFF),
            contentColor = HudWhite,
            focusedContentColor = HudWhite,
        ),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.02f),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(modifier = Modifier.size(22.dp), contentAlignment = Alignment.Center) {
                if (selected) {
                    Text("✓", color = HudWhite, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.width(10.dp))
            Text(
                label,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                fontSize = 16.sp,
                fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                color = if (selected) HudWhite else HudMuted,
            )
        }
    }
}

@Composable
private fun LabeledIconAction(
    label: String,
    onClick: () -> Unit,
    icon: @Composable () -> Unit,
) {
    Surface(
        onClick = onClick,
        modifier = Modifier.pointerInput(onClick) { detectTapGestures(onTap = { onClick() }) },
        shape = ClickableSurfaceDefaults.shape(shape = RoundedCornerShape(4.dp)),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = Color.Transparent,
            focusedContainerColor = Color(0x33FFFFFF),
            pressedContainerColor = Color(0x22FFFFFF),
            contentColor = HudWhite,
            focusedContentColor = HudWhite,
        ),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.06f),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(modifier = Modifier.size(24.dp), contentAlignment = Alignment.Center) {
                icon()
            }
            Text(
                label,
                color = HudMuted,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
            )
        }
    }
}

@Composable
private fun IconHit(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Surface(
        onClick = onClick,
        modifier = modifier
            .size(48.dp)
            .pointerInput(onClick) { detectTapGestures(onTap = { onClick() }) },
        shape = ClickableSurfaceDefaults.shape(shape = CircleShape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = Color.Transparent,
            focusedContainerColor = Color(0x33FFFFFF),
            pressedContainerColor = Color(0x22FFFFFF),
            contentColor = HudWhite,
            focusedContentColor = HudWhite,
        ),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.15f),
        border = ClickableSurfaceDefaults.border(
            border = Border(border = BorderStroke(0.dp, Color.Transparent), shape = CircleShape),
            focusedBorder = Border(border = BorderStroke(0.dp, Color.Transparent), shape = CircleShape),
        ),
    ) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { content() }
    }
}

@Composable
private fun CenterStatus(title: String, subtitle: String) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0x55000000)),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(title, color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Bold)
            if (subtitle.isNotBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(subtitle, color = HudMuted, fontSize = 15.sp)
            }
        }
    }
}

@Composable
private fun ErrorBanner(message: String, hint: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 56.dp, vertical = 100.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            "Erreur de lecture",
            color = TvColors.Error,
            fontSize = 26.sp,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(10.dp))
        Text(
            message,
            color = Color.White,
            fontSize = 16.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(max = 900.dp),
        )
        Spacer(Modifier.height(8.dp))
        Text(hint, color = HudMuted, fontSize = 14.sp, textAlign = TextAlign.Center)
    }
}

private object Glyph {
    @Composable
    fun Play(iconMod: Modifier, color: Color) {
        Canvas(modifier = iconMod) {
            val path = Path().apply {
                moveTo(size.width * 0.28f, size.height * 0.18f)
                lineTo(size.width * 0.82f, size.height * 0.50f)
                lineTo(size.width * 0.28f, size.height * 0.82f)
                close()
            }
            drawPath(path, color = color)
        }
    }

    @Composable
    fun Pause(iconMod: Modifier, color: Color) {
        Canvas(modifier = iconMod) {
            val w = size.width
            val h = size.height
            val bar = w * 0.20f
            drawRect(color, topLeft = Offset(w * 0.24f, h * 0.18f), size = Size(bar, h * 0.64f))
            drawRect(color, topLeft = Offset(w * 0.56f, h * 0.18f), size = Size(bar, h * 0.64f))
        }
    }

    @Composable
    fun Back(iconMod: Modifier, color: Color) {
        Canvas(modifier = iconMod) {
            val stroke = Stroke(width = size.minDimension * 0.11f, cap = StrokeCap.Round)
            val path = Path().apply {
                moveTo(size.width * 0.62f, size.height * 0.22f)
                lineTo(size.width * 0.32f, size.height * 0.50f)
                lineTo(size.width * 0.62f, size.height * 0.78f)
            }
            drawPath(path, color = color, style = stroke)
        }
    }

    @Composable
    fun Seek10(iconMod: Modifier, color: Color, forward: Boolean) {
        Box(modifier = iconMod, contentAlignment = Alignment.Center) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val stroke = Stroke(width = size.minDimension * 0.09f, cap = StrokeCap.Round)
                drawArc(
                    color = color,
                    startAngle = if (forward) -50f else 130f,
                    sweepAngle = 280f,
                    useCenter = false,
                    style = stroke,
                    topLeft = Offset(size.width * 0.10f, size.height * 0.10f),
                    size = Size(size.width * 0.80f, size.height * 0.80f),
                )
            }
            Text("10", color = color, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }

    @Composable
    fun SpeechBubble(iconMod: Modifier, color: Color) {
        Canvas(modifier = iconMod) {
            val stroke = Stroke(width = size.minDimension * 0.09f)
            drawRoundRect(
                color = color,
                topLeft = Offset(size.width * 0.12f, size.height * 0.12f),
                size = Size(size.width * 0.76f, size.height * 0.58f),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(size.minDimension * 0.12f),
                style = stroke,
            )
            val tail = Path().apply {
                moveTo(size.width * 0.28f, size.height * 0.68f)
                lineTo(size.width * 0.22f, size.height * 0.88f)
                lineTo(size.width * 0.42f, size.height * 0.68f)
                close()
            }
            drawPath(tail, color = color)
        }
    }

    @Composable
    fun Sources(iconMod: Modifier, color: Color) {
        Canvas(modifier = iconMod) {
            val stroke = Stroke(width = size.minDimension * 0.10f, cap = StrokeCap.Round)
            drawRoundRect(
                color = color,
                topLeft = Offset(size.width * 0.18f, size.height * 0.18f),
                size = Size(size.width * 0.64f, size.height * 0.18f),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(2f),
                style = stroke,
            )
            drawRoundRect(
                color = color,
                topLeft = Offset(size.width * 0.18f, size.height * 0.42f),
                size = Size(size.width * 0.64f, size.height * 0.18f),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(2f),
                style = stroke,
            )
            drawRoundRect(
                color = color,
                topLeft = Offset(size.width * 0.18f, size.height * 0.66f),
                size = Size(size.width * 0.64f, size.height * 0.18f),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(2f),
                style = stroke,
            )
        }
    }
}

private fun formatTime(ms: Long): String {
    val totalSec = (ms / 1000L).coerceAtLeast(0L)
    val h = totalSec / 3600L
    val m = (totalSec % 3600L) / 60L
    val s = totalSec % 60L
    return if (h > 0L) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}
