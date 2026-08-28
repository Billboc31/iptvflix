package com.iptvflix.androidtv.home

import android.app.Activity
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
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
import androidx.compose.foundation.layout.requiredHeight
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.items
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.iptvflix.androidtv.App
import com.iptvflix.androidtv.command.PlaybackCommand
import com.iptvflix.androidtv.ui.AppHomeChrome
import com.iptvflix.androidtv.ui.AppHomeMode
import com.iptvflix.androidtv.ui.TvColors
import com.iptvflix.androidtv.ui.TvConfirmOverlay
import java.util.UUID

/** Fixed poster size for Films & Séries — required* modifiers prevent Column compression. */
private val CwPosterWidth = 100.dp
private val CwPosterHeight = 150.dp
private val CwRemoveSize = 26.dp
private val CwTitleSlot = 22.dp
private val CwTitleGap = 6.dp
private val CwSectionHeight = CwTitleSlot + CwTitleGap + CwPosterHeight

@Composable
fun HomeScreen(
    onRevoked: () -> Unit,
    onChangeProfile: () -> Unit = {},
    onResumeLastPlayed: (PlaybackCommand) -> Unit = {},
    onSwitchToLiveTv: () -> Unit = {},
) {
    val app = LocalContext.current.applicationContext as App
    // Key by profile so a switch creates a fresh VM (name/avatar/continue-watching).
    val profileKey = app.secureStorage.getLastUsedProfileId() ?: "home"
    val vm: HomeViewModel = viewModel(key = profileKey)
    val state by vm.uiState.collectAsState()
    var showQuitDialog by remember { mutableStateOf(false) }
    var pendingDismiss by remember { mutableStateOf<ContinueWatchingUi?>(null) }
    val activity = LocalContext.current as? Activity
    val lastAvailability = remember {
        app.lastAvailabilityStore
    }
    val moviesEntryFocus = remember { FocusRequester() }
    val seriesEntryFocus = remember { FocusRequester() }

    fun resumeItem(item: ContinueWatchingUi) {
        onResumeLastPlayed(
            PlaybackCommand(
                id = "local-${UUID.randomUUID()}",
                mediaType = item.mediaType,
                mediaId = item.mediaId,
                availabilityId = lastAvailability?.get(item.mediaType, item.mediaId),
                startPositionMs = item.startPositionMs,
                title = item.title,
                seriesId = item.seriesId,
                seasonNumber = item.seasonNumber,
                posterUrl = item.posterUrl,
            ),
        )
    }

    LaunchedEffect(profileKey) {
        vm.refreshCurrentProfile()
        vm.refreshContinueWatching()
    }

    LaunchedEffect(state.connectionStatus) {
        if (state.connectionStatus is ConnectionStatus.Revoked) onRevoked()
    }

    BackHandler {
        when {
            pendingDismiss != null -> pendingDismiss = null
            else -> showQuitDialog = true
        }
    }

    val movies = remember(state.continueWatching) {
        state.continueWatching.filter { it.mediaType.equals("movie", ignoreCase = true) }
    }
    val series = remember(state.continueWatching) {
        state.continueWatching.filter { it.mediaType.equals("episode", ignoreCase = true) }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(TvColors.Background),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = 16.dp, bottom = 12.dp),
        ) {
            AppHomeChrome(
                mode = AppHomeMode.Vod,
                deviceName = state.deviceName,
                statusLabel = "Prêt à lire",
                connectionStatus = state.connectionStatus,
                profileName = state.profileName,
                profileAvatarKey = state.profileAvatarKey,
                onChangeProfile = onChangeProfile,
                onSelectVod = {},
                onSelectLiveTv = onSwitchToLiveTv,
                requestProfileFocus = state.continueWatching.isEmpty(),
            )

            if (state.continueWatching.isNotEmpty()) {
                Spacer(Modifier.height(12.dp))
                ContinueWatchingSection(
                    title = "Films à continuer",
                    items = movies,
                    emptyLabel = "Aucun film en cours",
                    requestInitialFocusOnFirst = movies.isNotEmpty(),
                    entryFocus = moviesEntryFocus,
                    focusDown = if (series.isNotEmpty()) seriesEntryFocus else null,
                    focusUp = null,
                    onPlay = { resumeItem(it) },
                    onRemove = { pendingDismiss = it },
                )
                Spacer(Modifier.height(12.dp))
                ContinueWatchingSection(
                    title = "Séries à continuer",
                    items = series,
                    emptyLabel = "Aucune série en cours",
                    requestInitialFocusOnFirst = movies.isEmpty() && series.isNotEmpty(),
                    entryFocus = seriesEntryFocus,
                    focusDown = null,
                    focusUp = if (movies.isNotEmpty()) moviesEntryFocus else null,
                    onPlay = { resumeItem(it) },
                    onRemove = { pendingDismiss = it },
                )
            } else {
                Spacer(Modifier.weight(1f))
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .align(Alignment.CenterHorizontally)
                        .padding(horizontal = 48.dp),
                ) {
                    Text(
                        "Aucun titre en cours",
                        color = TvColors.TextMuted,
                        fontSize = 18.sp,
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "Lancez un titre depuis le téléphone ou le navigateur.",
                        color = TvColors.TextMuted,
                        fontSize = 14.sp,
                    )
                }
                Spacer(Modifier.weight(1f))
            }
        }

        // Overlays must be drawn AFTER home content so they sit on top and receive focus.
        if (showQuitDialog) {
            TvConfirmOverlay(
                title = "Quitter IPTVFlix ?",
                confirmLabel = "Quitter",
                focusConfirm = true,
                onConfirm = { activity?.finishAffinity() },
                onDismiss = { showQuitDialog = false },
            )
        }

        pendingDismiss?.let { item ->
            TvConfirmOverlay(
                title = "Retirer « ${item.title} » ?",
                confirmLabel = "Retirer",
                focusConfirm = true,
                onConfirm = {
                    vm.dismissContinueWatching(item)
                    pendingDismiss = null
                },
                onDismiss = { pendingDismiss = null },
            )
        }
    }
}

@Composable
private fun ContinueWatchingSection(
    title: String,
    items: List<ContinueWatchingUi>,
    emptyLabel: String,
    requestInitialFocusOnFirst: Boolean,
    entryFocus: FocusRequester,
    focusDown: FocusRequester?,
    focusUp: FocusRequester?,
    onPlay: (ContinueWatchingUi) -> Unit,
    onRemove: (ContinueWatchingUi) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .requiredHeight(CwSectionHeight),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(CwTitleSlot)
                .padding(horizontal = 48.dp),
            contentAlignment = Alignment.CenterStart,
        ) {
            Text(
                title,
                color = TvColors.TextPrimary,
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
            )
        }
        Spacer(Modifier.height(CwTitleGap))
        if (items.isEmpty()) {
            Text(
                emptyLabel,
                color = TvColors.TextMuted,
                fontSize = 13.sp,
                modifier = Modifier.padding(horizontal = 48.dp),
            )
            return
        }
        TvLazyRow(
            modifier = Modifier
                .fillMaxWidth()
                .requiredHeight(CwPosterHeight),
            contentPadding = PaddingValues(horizontal = 48.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(
                items = items,
                key = { item -> "${item.mediaType}:${item.mediaId}" },
            ) { item ->
                val index = items.indexOf(item)
                ContinueWatchingTile(
                    item = item,
                    requestInitialFocus = requestInitialFocusOnFirst && index == 0,
                    entryFocus = if (index == 0) entryFocus else null,
                    focusDown = focusDown,
                    focusUp = focusUp,
                    onPlay = { onPlay(item) },
                    onRemove = { onRemove(item) },
                )
            }
        }
    }
}

@Composable
private fun ContinueWatchingTile(
    item: ContinueWatchingUi,
    onPlay: () -> Unit,
    onRemove: () -> Unit,
    requestInitialFocus: Boolean = false,
    entryFocus: FocusRequester? = null,
    focusDown: FocusRequester? = null,
    focusUp: FocusRequester? = null,
) {
    val localPlayFocus = remember { FocusRequester() }
    val playFocus = entryFocus ?: localPlayFocus
    val removeFocus = remember { FocusRequester() }
    val playInteraction = remember { MutableInteractionSource() }
    val removeInteraction = remember { MutableInteractionSource() }
    val playFocused by playInteraction.collectIsFocusedAsState()
    val removeFocused by removeInteraction.collectIsFocusedAsState()

    LaunchedEffect(requestInitialFocus) {
        if (requestInitialFocus) runCatching { playFocus.requestFocus() }
    }

    Box(
        modifier = Modifier
            .requiredSize(CwPosterWidth, CwPosterHeight)
            .onPreviewKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                when (event.key) {
                    Key.DirectionDown -> {
                        val target = focusDown ?: return@onPreviewKeyEvent false
                        runCatching {
                            target.requestFocus()
                            true
                        }.getOrDefault(false)
                    }
                    Key.DirectionUp -> {
                        val target = focusUp ?: return@onPreviewKeyEvent false
                        runCatching {
                            target.requestFocus()
                            true
                        }.getOrDefault(false)
                    }
                    else -> false
                }
            },
    ) {
        ContinuePosterCard(
            item = item,
            onClick = onPlay,
            interactionSource = playInteraction,
            modifier = Modifier
                .requiredSize(CwPosterWidth, CwPosterHeight)
                .focusRequester(playFocus)
                .focusProperties {
                    right = removeFocus
                    if (focusDown != null) down = focusDown
                    if (focusUp != null) up = focusUp
                },
        )
        RemoveChip(
            title = item.title,
            emphasized = playFocused || removeFocused,
            onClick = onRemove,
            interactionSource = removeInteraction,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(top = 5.dp, end = 5.dp)
                .focusRequester(removeFocus)
                .focusProperties {
                    left = playFocus
                    if (focusDown != null) down = focusDown
                    if (focusUp != null) up = focusUp
                },
        )
    }
}

@Composable
private fun RemoveChip(
    title: String,
    onClick: () -> Unit,
    emphasized: Boolean,
    interactionSource: MutableInteractionSource,
    modifier: Modifier = Modifier,
) {
    val focused by interactionSource.collectIsFocusedAsState()
    val shape = RoundedCornerShape(8.dp)
    val visible = emphasized || focused

    Surface(
        onClick = onClick,
        interactionSource = interactionSource,
        modifier = modifier
            .size(CwRemoveSize)
            .semantics { contentDescription = "Retirer $title" }
            .pointerInput(onClick) { detectTapGestures(onTap = { onClick() }) }
            .onKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown) return@onKeyEvent false
                when (event.key) {
                    Key.DirectionCenter, Key.Enter, Key.NumPadEnter -> {
                        onClick()
                        true
                    }
                    else -> false
                }
            },
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (visible) Color(0xCC0E0E0E) else Color(0x660E0E0E),
            focusedContainerColor = Color(0xF01A1A1A),
            pressedContainerColor = Color(0xFF111111),
            contentColor = Color.White,
            focusedContentColor = Color.White,
        ),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.12f),
        border = ClickableSurfaceDefaults.border(
            border = Border(
                border = BorderStroke(
                    width = 1.dp,
                    color = if (visible) Color(0x55FFFFFF) else Color(0x22FFFFFF),
                ),
                shape = shape,
            ),
            focusedBorder = Border(
                border = BorderStroke(2.dp, Color.White),
                shape = shape,
            ),
        ),
    ) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(
                "×",
                color = if (focused) Color.White else Color(0xCCFFFFFF),
                fontSize = 18.sp,
                fontWeight = FontWeight.Light,
            )
        }
    }
}

@Composable
private fun ContinuePosterCard(
    item: ContinueWatchingUi,
    onClick: () -> Unit,
    interactionSource: MutableInteractionSource,
    modifier: Modifier = Modifier,
) {
    val focused by interactionSource.collectIsFocusedAsState()
    val shape = RoundedCornerShape(8.dp)

    // Rigid portrait frame first — landscape episode stills must crop inside it.
    Box(
        modifier = modifier
            .requiredSize(CwPosterWidth, CwPosterHeight)
            .clip(shape)
            .background(Color(0xFF1A1A1A)),
    ) {
        if (!item.posterUrl.isNullOrBlank()) {
            AsyncImage(
                model = ImageRequest.Builder(LocalContext.current)
                    .data(item.posterUrl)
                    .crossfade(true)
                    .build(),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                alignment = Alignment.Center,
                modifier = Modifier
                    .fillMaxSize()
                    .clip(shape),
            )
        } else {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    item.title.take(1).uppercase(),
                    color = TvColors.TextMuted,
                    fontSize = 30.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }

        Surface(
            onClick = onClick,
            interactionSource = interactionSource,
            modifier = Modifier
                .fillMaxSize()
                .semantics { contentDescription = "Lire ${item.title}" }
                .pointerInput(onClick) { detectTapGestures(onTap = { onClick() }) },
            shape = ClickableSurfaceDefaults.shape(shape = shape),
            colors = ClickableSurfaceDefaults.colors(
                containerColor = Color.Transparent,
                focusedContainerColor = Color.Transparent,
                pressedContainerColor = Color.Transparent,
                contentColor = TvColors.TextPrimary,
                focusedContentColor = TvColors.TextPrimary,
            ),
            scale = ClickableSurfaceDefaults.scale(focusedScale = 1.0f),
            border = ClickableSurfaceDefaults.border(
                // Always-visible frame so Films/Séries read as the same box,
                // regardless of poster art filling.
                border = Border(
                    border = BorderStroke(2.dp, Color(0xFF4A4A4A)),
                    shape = shape,
                ),
                focusedBorder = Border(
                    border = BorderStroke(3.dp, Color.White),
                    shape = shape,
                ),
            ),
        ) {
            // Transparent clickable chrome only — art is drawn underneath.
            Box(Modifier.fillMaxSize())
        }

        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .height(56.dp)
                .background(
                    Brush.verticalGradient(
                        listOf(Color.Transparent, Color(0xE6000000)),
                    ),
                )
                .padding(horizontal = 7.dp, vertical = 7.dp),
        ) {
            Column(modifier = Modifier.align(Alignment.BottomStart)) {
                Text(
                    item.title,
                    color = if (focused) Color.White else Color(0xEEFFFFFF),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    item.subtitle?.takeIf { it.isNotBlank() } ?: " ",
                    color = Color(0xCCFFFFFF),
                    fontSize = 10.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Box(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .fillMaxWidth()
                .height(3.dp)
                .background(Color(0x55FFFFFF)),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(item.progressFraction.coerceIn(0.02f, 1f))
                    .height(3.dp)
                    .background(TvColors.Accent),
            )
        }
    }
}

