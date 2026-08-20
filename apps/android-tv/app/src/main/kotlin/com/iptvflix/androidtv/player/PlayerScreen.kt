package com.iptvflix.androidtv.player

import android.view.LayoutInflater
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.media3.ui.PlayerView
import androidx.tv.material3.Text
import com.iptvflix.androidtv.R
import com.iptvflix.androidtv.command.PlaybackCommand
import com.iptvflix.androidtv.ui.TvColors
import kotlinx.coroutines.delay

@Composable
fun PlayerScreen(
    command: PlaybackCommand?,
    onStop: () -> Unit,
    vm: PlayerViewModel = viewModel(),
) {
    val uiState by vm.uiState.collectAsState()
    val hud by vm.hud.collectAsState()
    val overlayActions by vm.overlayActions.collectAsState()
    var showControls by remember { mutableStateOf(true) }
    val focusRequester = remember { FocusRequester() }
    var playerViewRef by remember { mutableStateOf<PlayerView?>(null) }

    val visibleActions = remember(overlayActions, hud.positionMs) {
        overlayActions.visibleAt(hud.positionMs)
    }

    LaunchedEffect(command?.id) {
        if (command != null) {
            showControls = true
            vm.load(command)
        }
    }

    LaunchedEffect(uiState) {
        when (uiState) {
            is PlayerUiState.Ended -> {
                delay(2_000)
                vm.stop()
                onStop()
            }
            is PlayerUiState.Playing -> {
                // Keep chrome if a cue button is on screen (skip intro needs focus).
                if (visibleActions.isEmpty()) {
                    delay(6_000)
                    showControls = false
                }
            }
            else -> Unit
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            playerViewRef?.player = null
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .focusRequester(focusRequester)
            .focusable()
            .onKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown) return@onKeyEvent false
                showControls = true
                when (event.key) {
                    Key.DirectionCenter, Key.Enter, Key.MediaPlay, Key.MediaPause, Key.MediaPlayPause -> {
                        // If a skip button is visible, prefer letting it keep focus — OK still toggles play
                        // when chrome has focus via the root handler.
                        vm.togglePlayPause(); true
                    }
                    Key.DirectionRight -> { vm.seekForward(); true }
                    Key.DirectionLeft -> { vm.seekBack(); true }
                    Key.Back, Key.Escape -> { vm.stop(); onStop(); true }
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
            status = {
                if (showControls || uiState is PlayerUiState.Buffering || uiState is PlayerUiState.Error || visibleActions.isNotEmpty()) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(120.dp)
                            .align(Alignment.TopCenter)
                            .background(Brush.verticalGradient(listOf(Color(0xCC000000), Color.Transparent))),
                    )
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(160.dp)
                            .align(Alignment.BottomCenter)
                            .background(Brush.verticalGradient(listOf(Color.Transparent, Color(0xDD000000)))),
                    )
                }
                when (val s = uiState) {
                    is PlayerUiState.Error -> {
                        ErrorOverlay(message = s.message, onBack = { vm.stop(); onStop() })
                    }
                    is PlayerUiState.Ended -> {
                        CenterStatus("Lecture terminée", "Retour à l'accueil…")
                    }
                    is PlayerUiState.Buffering -> {
                        CenterStatus("Chargement…", "Préparation du flux")
                    }
                    else -> Unit
                }
            },
            actions = {
                // Cue buttons stay visible even when chrome auto-hides.
                if (uiState !is PlayerUiState.Error && visibleActions.isNotEmpty()) {
                    PlayerActionOverlays(
                        actions = visibleActions,
                        onAction = vm::onOverlayAction,
                    )
                }
            },
            chrome = {
                if ((showControls || visibleActions.isNotEmpty()) && uiState !is PlayerUiState.Error) {
                    PlayerChrome(
                        isPlaying = uiState is PlayerUiState.Playing,
                        isBuffering = uiState is PlayerUiState.Buffering,
                        mediaType = command?.mediaType,
                        hud = hud,
                        modifier = Modifier.align(Alignment.BottomCenter),
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
private fun PlayerChrome(
    isPlaying: Boolean,
    isBuffering: Boolean,
    mediaType: String?,
    hud: PlayerHudState,
    modifier: Modifier = Modifier,
) {
    val progress = if (hud.durationMs > 0L) {
        (hud.positionMs.toFloat() / hud.durationMs.toFloat()).coerceIn(0f, 1f)
    } else {
        0f
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 48.dp, vertical = 36.dp),
    ) {
        Text(
            text = when (mediaType?.lowercase()) {
                "episode" -> "Série"
                else -> "Film"
            },
            color = TvColors.Accent,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(6.dp))
        Text(
            text = when {
                isBuffering -> "Chargement…"
                isPlaying -> "Lecture en cours"
                else -> "Pause"
            },
            color = Color.White,
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(16.dp))

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp))
                .background(Color(0x55FFFFFF)),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(progress)
                    .height(6.dp)
                    .background(TvColors.Accent),
            )
        }
        Spacer(Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(formatTime(hud.positionMs), color = Color(0xCCFFFFFF), fontSize = 14.sp)
            Text(
                if (hud.durationMs > 0L) formatTime(hud.durationMs) else "--:--",
                color = Color(0xCCFFFFFF),
                fontSize = 14.sp,
            )
        }
        Spacer(Modifier.height(14.dp))
        Text(
            "OK pause/lecture   ·   ◀ ▶ ±10 s   ·   Retour quitter",
            color = Color(0x99FFFFFF),
            fontSize = 15.sp,
        )
    }
}

@Composable
private fun CenterStatus(title: String, subtitle: String) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0x66000000)),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(title, color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Text(subtitle, color = Color(0xCCFFFFFF), fontSize = 16.sp)
        }
    }
}

@Composable
private fun ErrorOverlay(message: String, onBack: () -> Unit) {
    val focusRequester = remember { FocusRequester() }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xEE000000))
            .focusRequester(focusRequester)
            .focusable()
            .onKeyEvent { event ->
                if (event.type == KeyEventType.KeyDown &&
                    (event.key == Key.Back || event.key == Key.Enter || event.key == Key.DirectionCenter)
                ) {
                    onBack()
                    true
                } else false
            },
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(48.dp)) {
            Text("Erreur de lecture", color = TvColors.Error, fontSize = 30.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(14.dp))
            Text(message, color = Color.White, fontSize = 18.sp)
            Spacer(Modifier.height(20.dp))
            Text("Appuyez sur Retour pour quitter", color = Color(0x99FFFFFF), fontSize = 15.sp)
        }
    }

    LaunchedEffect(Unit) {
        runCatching { focusRequester.requestFocus() }
    }
}

private fun formatTime(ms: Long): String {
    val totalSec = (ms / 1000L).coerceAtLeast(0L)
    val h = totalSec / 3600L
    val m = (totalSec % 3600L) / 60L
    val s = totalSec % 60L
    return if (h > 0L) "%d:%02d:%02d".format(h, m, s) else "%02d:%02d".format(m, s)
}
