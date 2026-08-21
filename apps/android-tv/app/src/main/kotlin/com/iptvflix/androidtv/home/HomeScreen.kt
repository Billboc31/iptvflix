package com.iptvflix.androidtv.home

import android.app.Activity
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.items
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.iptvflix.androidtv.App
import com.iptvflix.androidtv.command.PlaybackCommand
import com.iptvflix.androidtv.ui.TvColors
import com.iptvflix.androidtv.ui.TvConfirmOverlay
import com.iptvflix.androidtv.ui.TvPrimaryButton
import java.util.UUID

@Composable
fun HomeScreen(
    onRevoked: () -> Unit,
    onChangeProfile: () -> Unit = {},
    onResumeLastPlayed: (PlaybackCommand) -> Unit = {},
    vm: HomeViewModel = viewModel(),
) {
    val state by vm.uiState.collectAsState()
    var showQuitDialog by remember { mutableStateOf(false) }
    val activity = LocalContext.current as? Activity
    val lastAvailability = remember {
        (activity?.applicationContext as? App)?.lastAvailabilityStore
    }

    // Refresh each time Home is shown (after player, cast, etc.)
    LaunchedEffect(Unit) {
        vm.refreshContinueWatching()
    }

    LaunchedEffect(state.connectionStatus) {
        if (state.connectionStatus is ConnectionStatus.Revoked) onRevoked()
    }

    BackHandler { showQuitDialog = true }

    if (showQuitDialog) {
        TvConfirmOverlay(
            title = "Quitter IPTVFlix ?",
            confirmLabel = "Quitter",
            onConfirm = { activity?.finishAffinity() },
            onDismiss = { showQuitDialog = false },
        )
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(TvColors.Background),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(vertical = 40.dp),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 56.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "IPTVFlix",
                    color = TvColors.Accent,
                    fontSize = 34.sp,
                    fontWeight = FontWeight.Bold,
                )
                ConnectionBadge(state.connectionStatus)
            }

            Spacer(Modifier.height(28.dp))

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 56.dp),
            ) {
                Text(
                    state.deviceName,
                    color = TvColors.TextPrimary,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    "Prêt à lire — lancez un titre depuis le téléphone ou le navigateur.",
                    color = TvColors.TextMuted,
                    fontSize = 16.sp,
                )
            }

            if (state.continueWatching.isNotEmpty()) {
                Spacer(Modifier.height(36.dp))
                Text(
                    "Continuer à regarder",
                    color = TvColors.TextPrimary,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 56.dp),
                )
                Spacer(Modifier.height(16.dp))
                TvLazyRow(
                    contentPadding = PaddingValues(horizontal = 56.dp),
                    horizontalArrangement = Arrangement.spacedBy(18.dp),
                ) {
                    items(
                        items = state.continueWatching,
                        key = { item -> "${item.mediaType}:${item.mediaId}" },
                    ) { item ->
                        val index = state.continueWatching.indexOf(item)
                        ContinuePosterCard(
                            item = item,
                            requestInitialFocus = index == 0,
                            onClick = {
                                onResumeLastPlayed(
                                    PlaybackCommand(
                                        id = "local-${UUID.randomUUID()}",
                                        mediaType = item.mediaType,
                                        mediaId = item.mediaId,
                                        availabilityId = lastAvailability?.get(
                                            item.mediaType,
                                            item.mediaId,
                                        ),
                                        startPositionMs = item.startPositionMs,
                                        title = item.title,
                                        seriesId = item.seriesId,
                                        seasonNumber = item.seasonNumber,
                                        posterUrl = item.posterUrl,
                                    ),
                                )
                            },
                        )
                    }
                }
            } else {
                Spacer(Modifier.weight(1f))
                Text(
                    "Aucun titre en cours",
                    color = TvColors.TextMuted,
                    fontSize = 18.sp,
                    modifier = Modifier
                        .align(Alignment.CenterHorizontally)
                        .padding(horizontal = 56.dp),
                )
                Spacer(Modifier.weight(1f))
            }

            if (state.continueWatching.isNotEmpty()) {
                Spacer(Modifier.weight(1f))
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 56.dp),
                horizontalArrangement = Arrangement.Center,
            ) {
                TvPrimaryButton(
                    label = "Changer de profil",
                    onClick = onChangeProfile,
                    requestInitialFocus = state.continueWatching.isEmpty(),
                )
            }
        }
    }
}

@Composable
private fun ContinuePosterCard(
    item: ContinueWatchingUi,
    onClick: () -> Unit,
    requestInitialFocus: Boolean = false,
) {
    val focusRequester = remember { FocusRequester() }
    LaunchedEffect(requestInitialFocus) {
        if (requestInitialFocus) runCatching { focusRequester.requestFocus() }
    }

    Surface(
        onClick = onClick,
        modifier = Modifier
            .width(168.dp)
            .focusRequester(focusRequester)
            .pointerInput(onClick) { detectTapGestures(onTap = { onClick() }) },
        shape = ClickableSurfaceDefaults.shape(shape = RoundedCornerShape(8.dp)),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = TvColors.Surface,
            focusedContainerColor = Color(0xFF2A2A2A),
            pressedContainerColor = Color(0xFF222222),
            contentColor = TvColors.TextPrimary,
            focusedContentColor = TvColors.TextPrimary,
        ),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.08f),
        border = ClickableSurfaceDefaults.border(
            border = androidx.tv.material3.Border(
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF2A2A2A)),
                shape = RoundedCornerShape(8.dp),
            ),
            focusedBorder = androidx.tv.material3.Border(
                border = androidx.compose.foundation.BorderStroke(3.dp, Color.White),
                shape = RoundedCornerShape(8.dp),
            ),
        ),
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(252.dp)
                    .background(Color(0xFF1A1A1A)),
            ) {
                if (!item.posterUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current)
                            .data(item.posterUrl)
                            .crossfade(true)
                            .build(),
                        contentDescription = item.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            item.title.take(1).uppercase(),
                            color = TvColors.TextMuted,
                            fontSize = 42.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .height(56.dp)
                        .background(
                            Brush.verticalGradient(
                                listOf(Color.Transparent, Color(0xCC000000)),
                            ),
                        ),
                )
                // Progress bar
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .fillMaxWidth()
                        .height(4.dp)
                        .background(Color(0x55FFFFFF)),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(item.progressFraction.coerceIn(0.02f, 1f))
                            .height(4.dp)
                            .background(TvColors.Accent),
                    )
                }
            }
            Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 10.dp)) {
                Text(
                    item.title,
                    color = TvColors.TextPrimary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                if (!item.subtitle.isNullOrBlank()) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        item.subtitle,
                        color = TvColors.TextMuted,
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

@Composable
private fun ConnectionBadge(status: ConnectionStatus) {
    val (color, label) = when (status) {
        ConnectionStatus.Connected -> TvColors.Success to "Connecté"
        ConnectionStatus.Reconnecting -> TvColors.Warning to "Reconnexion…"
        is ConnectionStatus.Revoked -> TvColors.Error to "Appareil révoqué"
    }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(color.copy(alpha = 0.15f))
            .padding(horizontal = 20.dp, vertical = 8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .width(8.dp)
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(color),
            )
            Spacer(Modifier.width(10.dp))
            Text(label, color = color, fontSize = 15.sp, fontWeight = FontWeight.Medium)
        }
    }
}
