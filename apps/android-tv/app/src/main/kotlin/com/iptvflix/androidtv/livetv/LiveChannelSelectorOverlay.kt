package com.iptvflix.androidtv.livetv

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.focusable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.itemsIndexed
import androidx.tv.foundation.lazy.list.rememberTvLazyListState
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.iptvflix.androidtv.ui.TvColors

@Composable
fun LiveChannelSelectorOverlay(
    state: LiveChannelSelectorState,
    currentChannelId: String?,
    loadingChannelId: String?,
    onChannelSelected: (ChannelResponse) -> Unit,
    onClose: () -> Unit,
    onExitPlayer: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxHeight()
            .width(320.dp)
            .background(Color(0xEE0D0D14)),
    ) {
        Text(
            "Chaînes",
            color = TvColors.LiveTvAccent,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 24.dp, bottom = 12.dp),
        )

        when (state) {
            is LiveChannelSelectorState.Loading -> {
                val loadingFocus = remember { FocusRequester() }
                LaunchedEffect(Unit) {
                    delay(40)
                    runCatching { loadingFocus.requestFocus() }
                }
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .focusRequester(loadingFocus)
                        .focusable()
                        .onKeyEvent { event ->
                            if (event.type != KeyEventType.KeyDown) return@onKeyEvent false
                            when (event.key) {
                                Key.DirectionRight -> { onClose(); true }
                                Key.Back, Key.Escape -> { onExitPlayer(); true }
                                else -> false
                            }
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    SelectorSpinner()
                }
            }
            is LiveChannelSelectorState.Error -> {
                val errorFocus = remember { FocusRequester() }
                LaunchedEffect(Unit) {
                    delay(40)
                    runCatching { errorFocus.requestFocus() }
                }
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 8.dp),
                ) {
                    ChannelSelectorBackRow(onClick = onExitPlayer, onClose = onClose)
                    Spacer(Modifier.height(8.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp)
                            .focusRequester(errorFocus)
                            .focusable()
                            .onKeyEvent { event ->
                                if (event.type != KeyEventType.KeyDown) return@onKeyEvent false
                                when (event.key) {
                                    Key.DirectionRight -> { onClose(); true }
                                    Key.Back, Key.Escape -> { onExitPlayer(); true }
                                    else -> false
                                }
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            state.message,
                            color = TvColors.Error,
                            fontSize = 13.sp,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }
            is LiveChannelSelectorState.Ready -> {
                val listState = rememberTvLazyListState()
                val currentIndex = remember(state.channels, currentChannelId) {
                    state.channels.indexOfFirst { it.id == currentChannelId }.coerceAtLeast(0)
                }
                // +1 because item 0 is the Retour row inside the list.
                val focusChannelIndex = currentIndex + 1
                var initialFocusDone by remember { mutableStateOf(false) }
                var requestFocusIndex by remember { mutableStateOf<Int?>(null) }
                LaunchedEffect(Unit) {
                    if (state.channels.isEmpty()) {
                        delay(40)
                        requestFocusIndex = 0
                        return@LaunchedEffect
                    }
                    runCatching { listState.scrollToItem(focusChannelIndex) }
                    delay(48)
                    requestFocusIndex = focusChannelIndex
                }
                if (state.channels.isEmpty()) {
                    ChannelSelectorBackRow(
                        onClick = onExitPlayer,
                        onClose = onClose,
                        requestInitialFocus = requestFocusIndex == 0 && !initialFocusDone,
                        onInitialFocusHandled = { initialFocusDone = true },
                    )
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            "Aucune chaîne disponible",
                            color = TvColors.TextMuted,
                            fontSize = 13.sp,
                            textAlign = TextAlign.Center,
                        )
                    }
                } else {
                    TvLazyColumn(
                        state = listState,
                        contentPadding = PaddingValues(bottom = 16.dp),
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        item(key = "__back__") {
                            ChannelSelectorBackRow(
                                onClick = onExitPlayer,
                                onClose = onClose,
                                requestInitialFocus = !initialFocusDone && requestFocusIndex == 0,
                                onInitialFocusHandled = { initialFocusDone = true },
                            )
                            Spacer(Modifier.height(8.dp))
                        }
                        itemsIndexed(state.channels, key = { _, ch -> ch.id }) { index, channel ->
                            val listIndex = index + 1
                            ChannelSelectorRow(
                                channel = channel,
                                isCurrentlyPlaying = channel.id == currentChannelId,
                                isLoading = channel.id == loadingChannelId,
                                requestInitialFocus = !initialFocusDone &&
                                    requestFocusIndex != null &&
                                    listIndex == requestFocusIndex,
                                onInitialFocusHandled = { initialFocusDone = true },
                                onSelect = { onChannelSelected(channel) },
                                onClose = onClose,
                                onExitPlayer = onExitPlayer,
                            )
                            Spacer(Modifier.height(2.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ChannelSelectorBackRow(
    onClick: () -> Unit,
    onClose: () -> Unit,
    requestInitialFocus: Boolean = false,
    onInitialFocusHandled: () -> Unit = {},
) {
    val focusRequester = remember { FocusRequester() }
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()

    LaunchedEffect(requestInitialFocus) {
        if (!requestInitialFocus) return@LaunchedEffect
        repeat(4) { attempt ->
            delay(if (attempt == 0) 16L else 40L)
            if (runCatching { focusRequester.requestFocus() }.isSuccess) {
                onInitialFocusHandled()
                return@LaunchedEffect
            }
        }
        onInitialFocusHandled()
    }

    Surface(
        onClick = onClick,
        interactionSource = interactionSource,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp)
            .focusRequester(focusRequester)
            .onKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown) return@onKeyEvent false
                when (event.key) {
                    Key.DirectionRight -> { onClose(); true }
                    Key.Back, Key.Escape -> { onClick(); true }
                    else -> false
                }
            },
        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(6.dp)),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = Color.Transparent,
            focusedContainerColor = Color(0x33FFFFFF),
            pressedContainerColor = Color(0x44FFFFFF),
            contentColor = TvColors.TextPrimary,
            focusedContentColor = Color.White,
        ),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1f),
        border = ClickableSurfaceDefaults.border(
            border = Border(
                border = BorderStroke(0.dp, Color.Transparent),
                shape = RoundedCornerShape(6.dp),
            ),
            focusedBorder = Border(
                border = BorderStroke(2.dp, Color.White),
                shape = RoundedCornerShape(6.dp),
            ),
        ),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "←",
                color = if (focused) Color.White else TvColors.TextMuted,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.width(10.dp))
            Text(
                "Retour",
                color = if (focused) Color.White else TvColors.TextPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

@Composable
private fun SelectorSpinner() {
    val infiniteTransition = rememberInfiniteTransition(label = "selector-spinner")
    val angle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(900, easing = LinearEasing)),
        label = "angle",
    )
    Canvas(modifier = Modifier.size(32.dp)) {
        drawArc(
            color = TvColors.LiveTvAccent,
            startAngle = angle,
            sweepAngle = 270f,
            useCenter = false,
            style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round),
        )
    }
}

@Composable
private fun RowSpinner() {
    val infiniteTransition = rememberInfiniteTransition(label = "row-spinner")
    val angle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(900, easing = LinearEasing)),
        label = "angle",
    )
    Canvas(modifier = Modifier.size(24.dp)) {
        drawArc(
            color = Color.White,
            startAngle = angle,
            sweepAngle = 270f,
            useCenter = false,
            style = Stroke(width = 2.5.dp.toPx(), cap = StrokeCap.Round),
        )
    }
}

@Composable
private fun ChannelSelectorRow(
    channel: ChannelResponse,
    isCurrentlyPlaying: Boolean,
    isLoading: Boolean,
    requestInitialFocus: Boolean,
    onInitialFocusHandled: () -> Unit = {},
    onSelect: () -> Unit,
    onClose: () -> Unit,
    onExitPlayer: () -> Unit,
) {
    val focusRequester = remember { FocusRequester() }
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()

    LaunchedEffect(requestInitialFocus) {
        if (!requestInitialFocus) return@LaunchedEffect
        // Scroll may compose the row a frame late — retry instead of giving up once.
        repeat(4) { attempt ->
            delay(if (attempt == 0) 16L else 40L)
            val ok = runCatching { focusRequester.requestFocus() }.isSuccess
            if (ok) {
                onInitialFocusHandled()
                return@LaunchedEffect
            }
        }
        onInitialFocusHandled()
    }

    Surface(
        onClick = onSelect,
        interactionSource = interactionSource,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp)
            .focusRequester(focusRequester)
            .onKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown) return@onKeyEvent false
                when (event.key) {
                    Key.DirectionRight -> { onClose(); true }
                    Key.Back, Key.Escape -> { onExitPlayer(); true }
                    else -> false
                }
            },
        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(6.dp)),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = when {
                isCurrentlyPlaying -> TvColors.LiveTvAccent.copy(alpha = 0.18f)
                else -> Color.Transparent
            },
            focusedContainerColor = TvColors.LiveTvAccent,
            pressedContainerColor = TvColors.LiveTvAccent,
            contentColor = TvColors.TextPrimary,
            focusedContentColor = Color.White,
        ),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1f),
        border = ClickableSurfaceDefaults.border(
            border = Border(
                border = BorderStroke(
                    if (isCurrentlyPlaying) 1.5.dp else 0.dp,
                    if (isCurrentlyPlaying) TvColors.LiveTvAccent else Color.Transparent,
                ),
                shape = RoundedCornerShape(6.dp),
            ),
            focusedBorder = Border(
                border = BorderStroke(2.dp, Color.White),
                shape = RoundedCornerShape(6.dp),
            ),
        ),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(Color(0xFF1A1A2A)),
                contentAlignment = Alignment.Center,
            ) {
                when {
                    isLoading -> RowSpinner()
                    !channel.logoUrl.isNullOrBlank() -> AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current)
                            .data(channel.logoUrl)
                            .crossfade(true)
                            .build(),
                        contentDescription = channel.name,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.size(32.dp),
                    )
                    else -> Text(
                        channel.name.take(1).uppercase(),
                        color = if (focused) Color.White else TvColors.LiveTvAccent,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }

            Spacer(Modifier.width(10.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    channel.name,
                    color = if (focused) Color.White else TvColors.TextPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (channel.epg?.now != null) {
                    val epg = channel.epg.now
                    Text(
                        epg.title,
                        color = if (focused) Color(0xCCFFFFFF) else TvColors.TextMuted,
                        fontSize = 11.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    val timeRange = "${formatEpgTime(epg.startTime)}–${formatEpgTime(epg.endTime)}"
                    Text(
                        timeRange,
                        color = if (focused) Color(0x99FFFFFF) else Color(0xFF555555),
                        fontSize = 10.sp,
                    )
                }
            }

            if (isCurrentlyPlaying && !isLoading) {
                Spacer(Modifier.width(6.dp))
                Text(
                    "▶",
                    color = if (focused) Color.White else TvColors.LiveTvAccent,
                    fontSize = 11.sp,
                )
            }

            if (channel.isFavorite) {
                Spacer(Modifier.width(4.dp))
                Text(
                    "♥",
                    color = if (focused) Color(0xCCFFFFFF) else TvColors.LiveTvAccent.copy(alpha = 0.65f),
                    fontSize = 9.sp,
                )
            }
        }
    }
}

private fun formatEpgTime(rawTime: String): String {
    val timePart = rawTime.substringAfter('T', rawTime)
    return timePart.take(5)
}
