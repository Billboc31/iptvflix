package com.iptvflix.androidtv.player

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
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
import androidx.media3.ui.PlayerView
import androidx.tv.material3.Button
import androidx.tv.material3.CircularProgressIndicator
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
    val tracks by vm.availableTracks.collectAsState()
    var showOverlay by remember { mutableStateOf(true) }
    var showTrackPanel by remember { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(command) {
        if (command != null) vm.load(command)
    }

    LaunchedEffect(showOverlay) {
        if (showOverlay) {
            delay(3_000)
            if (!showTrackPanel) showOverlay = false
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
                showOverlay = true
                when (event.key) {
                    Key.DirectionCenter, Key.MediaPlay, Key.MediaPause, Key.MediaPlayPause -> {
                        vm.togglePlayPause(); true
                    }
                    Key.DirectionRight -> { vm.seekForward(); true }
                    Key.DirectionLeft -> { vm.seekBack(); true }
                    Key.DirectionUp -> { showTrackPanel = true; true }
                    Key.Back -> { vm.stop(); onStop(); true }
                    else -> false
                }
            },
    ) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                PlayerView(ctx).apply {
                    useController = false
                    player = vm.player
                }
            },
            update = { view -> view.player = vm.player },
        )

        when (val s = uiState) {
            is PlayerUiState.Buffering -> {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            }
            is PlayerUiState.Error -> {
                ErrorOverlay(
                    message = s.message,
                    onRetry = { if (command != null) vm.load(command) },
                    onBack = { vm.stop(); onStop() },
                )
            }
            else -> Unit
        }

        if (showOverlay && uiState !is PlayerUiState.Error) {
            ControlsOverlay(
                isPlaying = uiState is PlayerUiState.Playing,
                onPlayPause = { vm.togglePlayPause() },
                onSeekBack = { vm.seekBack() },
                onSeekForward = { vm.seekForward() },
                onStop = { vm.stop(); onStop() },
            )
        }

        if (showTrackPanel && tracks.isNotEmpty()) {
            TrackSelectorPanel(
                tracks = tracks,
                onSelect = { vm.selectTrack(it); showTrackPanel = false },
                onDismiss = { showTrackPanel = false },
            )
        }
    }

    LaunchedEffect(Unit) { focusRequester.requestFocus() }
}

@Composable
private fun ControlsOverlay(
    isPlaying: Boolean,
    onPlayPause: () -> Unit,
    onSeekBack: () -> Unit,
    onSeekForward: () -> Unit,
    onStop: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0x80000000))
            .padding(32.dp),
        contentAlignment = Alignment.BottomCenter,
    ) {
        Row {
            Button(onClick = onStop) { Text("Stop") }
            Spacer(Modifier.width(16.dp))
            Button(onClick = onSeekBack) { Text("« 10s") }
            Spacer(Modifier.width(16.dp))
            Button(onClick = onPlayPause) { Text(if (isPlaying) "Pause" else "Play") }
            Spacer(Modifier.width(16.dp))
            Button(onClick = onSeekForward) { Text("10s »") }
        }
    }
}

@Composable
private fun ErrorOverlay(message: String, onRetry: () -> Unit, onBack: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xCC000000)),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("Playback error", color = Color(0xFFFF6B6B), fontSize = 24.sp)
            Text(message, color = Color.White, fontSize = 16.sp)
            Row {
                Button(onClick = onRetry) { Text("Retry") }
                Spacer(Modifier.width(16.dp))
                Button(onClick = onBack) { Text("Back") }
            }
        }
    }
}

@Composable
private fun TrackSelectorPanel(
    tracks: List<com.iptvflix.androidtv.playback.TrackInfo>,
    onSelect: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xCC000000))
            .padding(64.dp),
        contentAlignment = Alignment.CenterEnd,
    ) {
        Column {
            Text("Audio / Subtitles", color = Color.White, fontSize = 20.sp)
            tracks.forEach { track ->
                Button(onClick = { onSelect(track.id) }) {
                    Text("[${track.type}] ${track.label}")
                }
            }
            Button(onClick = onDismiss) { Text("Close") }
        }
    }
}
