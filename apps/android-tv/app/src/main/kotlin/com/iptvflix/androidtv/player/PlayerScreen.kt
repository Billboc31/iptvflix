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
import kotlinx.coroutines.delay

@Composable
fun PlayerScreen(
    command: PlaybackCommand?,
    onStop: () -> Unit,
    vm: PlayerViewModel = viewModel(),
) {
    val uiState by vm.uiState.collectAsState()
    var showHints by remember { mutableStateOf(false) }
    var showBuffering by remember { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(command?.id) {
        if (command != null) vm.load(command)
    }

    LaunchedEffect(uiState) {
        if (uiState is PlayerUiState.Buffering) {
            delay(2_000)
            if (vm.uiState.value is PlayerUiState.Buffering) showBuffering = true
        } else {
            showBuffering = false
        }
    }

    LaunchedEffect(showHints) {
        if (showHints) {
            delay(4_000)
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
                    player = vm.player
                }
            },
            update = { view ->
                view.player = vm.player
                view.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
            },
        )

        if (showBuffering) {
            Text(
                "Mise en buffer…",
                color = Color(0xCCFFFFFF),
                fontSize = 16.sp,
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
            else -> Unit
        }

        if (showHints && uiState !is PlayerUiState.Error) {
            ControlsHintOverlay(isPlaying = uiState is PlayerUiState.Playing)
        }
    }

    LaunchedEffect(Unit) { focusRequester.requestFocus() }
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
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xCC000000))
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
            Text("Erreur de lecture", color = Color(0xFFFF6B6B), fontSize = 24.sp)
            Text(message, color = Color.White, fontSize = 16.sp)
            Spacer(Modifier.height(12.dp))
            Text("Retour pour quitter", color = Color(0xFFAAAAAA), fontSize = 14.sp)
        }
    }
}
