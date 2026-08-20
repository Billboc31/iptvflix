package com.iptvflix.androidtv.player

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import androidx.tv.material3.Text
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
    var showHints by remember { mutableStateOf(true) }
    var showBuffering by remember { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(command?.id) {
        if (command != null) {
            showHints = true
            vm.load(command)
        }
    }

    LaunchedEffect(uiState) {
        when (uiState) {
            is PlayerUiState.Buffering -> {
                delay(2_000)
                if (vm.uiState.value is PlayerUiState.Buffering) showBuffering = true
            }
            is PlayerUiState.Ended -> {
                delay(2_500)
                vm.stop()
                onStop()
            }
            else -> showBuffering = false
        }
    }

    LaunchedEffect(showHints) {
        if (showHints) {
            delay(5_000)
            showHints = false
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
                showHints = true
                when (event.key) {
                    Key.DirectionCenter, Key.MediaPlay, Key.MediaPause, Key.MediaPlayPause -> {
                        vm.togglePlayPause(); true
                    }
                    Key.DirectionRight -> { vm.seekForward(); true }
                    Key.DirectionLeft -> { vm.seekBack(); true }
                    Key.Back, Key.Escape -> { vm.stop(); onStop(); true }
                    else -> false
                }
            },
    ) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                PlayerView(ctx).apply {
                    useController = false
                    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                    setKeepContentOnPlayerReset(true)
                    isFocusable = false
                    isFocusableInTouchMode = false
                    player = vm.player
                }
            },
            update = { view ->
                view.player = vm.player
                view.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                view.isFocusable = false
                view.isFocusableInTouchMode = false
            },
        )

        if (showBuffering && uiState !is PlayerUiState.Error && uiState !is PlayerUiState.Ended) {
            Text(
                "Chargement…",
                color = Color(0xCCFFFFFF),
                fontSize = 18.sp,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(24.dp),
            )
        }

        when (val s = uiState) {
            is PlayerUiState.Error -> {
                ErrorOverlay(
                    message = s.message,
                    onBack = { vm.stop(); onStop() },
                )
            }
            is PlayerUiState.Ended -> {
                EndedOverlay()
            }
            else -> Unit
        }

        if (showHints && (uiState is PlayerUiState.Playing || uiState is PlayerUiState.Paused)) {
            ControlsHintOverlay(isPlaying = uiState is PlayerUiState.Playing)
        }
    }

    LaunchedEffect(Unit) {
        runCatching { focusRequester.requestFocus() }
    }
}

@Composable
private fun EndedOverlay() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0x99000000)),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("Lecture terminée", color = TvColors.TextPrimary, fontSize = 28.sp)
            Spacer(Modifier.height(8.dp))
            Text("Retour à l'accueil…", color = TvColors.TextMuted, fontSize = 16.sp)
        }
    }
}

@Composable
private fun ControlsHintOverlay(isPlaying: Boolean) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        contentAlignment = Alignment.BottomCenter,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                if (isPlaying) "Lecture en cours" else "Pause",
                color = Color(0xE6FFFFFF),
                fontSize = 16.sp,
            )
            Spacer(Modifier.height(4.dp))
            Text("◀ ▶ ±10 s   ·   OK pause   ·   Retour quitter", color = Color(0x99CCCCCC), fontSize = 13.sp)
        }
    }
}

@Composable
private fun ErrorOverlay(message: String, onBack: () -> Unit) {
    val focusRequester = remember { FocusRequester() }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xDD000000))
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
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("Erreur de lecture", color = TvColors.Error, fontSize = 28.sp)
            Spacer(Modifier.height(12.dp))
            Text(message, color = TvColors.TextPrimary, fontSize = 18.sp)
            Spacer(Modifier.height(16.dp))
            Text("Appuyez sur Retour pour quitter", color = TvColors.TextMuted, fontSize = 15.sp)
        }
    }

    LaunchedEffect(Unit) {
        runCatching { focusRequester.requestFocus() }
    }
}
