package com.iptvflix.androidtv.livetv

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.items
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.iptvflix.androidtv.ui.TvColors
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

@Composable
fun LiveSearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    onConfirm: () -> Unit,
    searchBarFocus: FocusRequester,
    hasVoice: Boolean,
    onVoiceLaunch: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()
    val canConfirm = query.isNotBlank()

    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 56.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "⌕",
            color = TvColors.LiveTvAccent,
            fontSize = 26.sp,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.width(14.dp))

        BasicTextField(
            value = query,
            onValueChange = onQueryChange,
            modifier = Modifier
                .weight(1f)
                .focusRequester(searchBarFocus)
                .onKeyEvent { event ->
                    if (event.type != KeyEventType.KeyDown) return@onKeyEvent false
                    when (event.key) {
                        Key.Enter, Key.NumPadEnter -> {
                            if (canConfirm) onConfirm()
                            true
                        }
                        else -> false
                    }
                }
                .drawBehind {
                    val strokeWidth = if (isFocused) 3.dp.toPx() else 1.dp.toPx()
                    val color = if (isFocused) TvColors.LiveTvAccent else Color(0xFF333333)
                    drawLine(
                        color = color,
                        start = Offset(0f, size.height),
                        end = Offset(size.width, size.height),
                        strokeWidth = strokeWidth,
                    )
                },
            interactionSource = interactionSource,
            textStyle = TextStyle(
                color = TvColors.TextPrimary,
                fontSize = 22.sp,
            ),
            cursorBrush = SolidColor(TvColors.LiveTvAccent),
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { if (canConfirm) onConfirm() }),
            decorationBox = { innerTextField ->
                Box(contentAlignment = Alignment.CenterStart) {
                    if (query.isEmpty()) {
                        Text(
                            "Tapez puis Valider…",
                            color = TvColors.TextMuted,
                            fontSize = 22.sp,
                        )
                    }
                    innerTextField()
                }
            },
        )

        Spacer(Modifier.width(12.dp))
        LiveSearchValidateButton(
            enabled = canConfirm,
            onClick = onConfirm,
        )

        if (hasVoice) {
            Spacer(Modifier.width(12.dp))
            LiveSearchMicButton(onClick = onVoiceLaunch)
        }
    }
}

@Composable
private fun LiveSearchValidateButton(
    enabled: Boolean,
    onClick: () -> Unit,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()

    Surface(
        onClick = { if (enabled) onClick() },
        interactionSource = interactionSource,
        modifier = Modifier.pointerInput(enabled, onClick) {
            detectTapGestures(onTap = { if (enabled) onClick() })
        },
        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(8.dp)),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (enabled) TvColors.LiveTvAccent.copy(alpha = 0.25f) else TvColors.Surface,
            focusedContainerColor = if (enabled) TvColors.LiveTvAccent else TvColors.Surface,
            pressedContainerColor = if (enabled) TvColors.LiveTvAccent else TvColors.Surface,
        ),
        border = ClickableSurfaceDefaults.border(
            border = Border(
                border = BorderStroke(
                    1.dp,
                    if (enabled) TvColors.LiveTvAccent else Color(0xFF333333),
                ),
                shape = RoundedCornerShape(8.dp),
            ),
            focusedBorder = Border(
                border = BorderStroke(3.dp, TvColors.LiveTvAccent),
                shape = RoundedCornerShape(8.dp),
            ),
        ),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.06f),
    ) {
        Text(
            "Valider",
            color = when {
                isFocused -> Color.White
                enabled -> TvColors.LiveTvAccent
                else -> TvColors.TextMuted
            },
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 18.dp, vertical = 10.dp),
        )
    }
}

@Composable
private fun LiveSearchMicButton(onClick: () -> Unit) {
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()

    Surface(
        onClick = onClick,
        interactionSource = interactionSource,
        modifier = Modifier
            .size(44.dp)
            .pointerInput(Unit) { detectTapGestures(onTap = { onClick() }) },
        shape = ClickableSurfaceDefaults.shape(CircleShape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = TvColors.Surface,
            focusedContainerColor = TvColors.LiveTvAccent,
            pressedContainerColor = TvColors.LiveTvAccent,
        ),
        border = ClickableSurfaceDefaults.border(
            focusedBorder = Border(
                border = BorderStroke(3.dp, TvColors.LiveTvAccent),
                shape = CircleShape,
            ),
        ),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.1f),
    ) {
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Text(
                "🎙",
                fontSize = 20.sp,
                color = if (isFocused) Color.White else TvColors.TextPrimary,
            )
        }
    }
}

/** Search hits as horizontal shelves (En direct / À venir / Chaînes). */
@Composable
fun LiveSearchResultShelves(
    state: LiveSearchState.Results,
    isSingleLiveNow: Boolean,
    onLiveNowSelected: (LiveNowResult) -> Unit,
    onChannelSelected: (ChannelSearchResult) -> Unit,
    moveFocusToResults: Boolean = false,
    onFocusMoved: () -> Unit = {},
    firstResultFocus: FocusRequester? = null,
) {
    val defaultFocus = remember { FocusRequester() }
    val focusTarget = firstResultFocus ?: defaultFocus

    // Only steal focus after an explicit Valider — never while typing.
    LaunchedEffect(moveFocusToResults, state.query) {
        if (!moveFocusToResults) return@LaunchedEffect
        when {
            state.liveNow.isNotEmpty() ||
                state.upcoming.isNotEmpty() ||
                state.channels.isNotEmpty() -> {
                runCatching { focusTarget.requestFocus() }
                onFocusMoved()
            }
        }
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        if (state.liveNow.isNotEmpty()) {
            LiveSearchShelfTitle("En direct maintenant")
            Spacer(Modifier.height(12.dp))
            TvLazyRow(
                contentPadding = PaddingValues(horizontal = 56.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                items(state.liveNow, key = { "${it.channelId}-${it.programTitle}" }) { result ->
                    LiveNowShelfCard(
                        result = result,
                        isSingleLive = isSingleLiveNow,
                        requestInitialFocus = result == state.liveNow.first(),
                        focusRequester = if (result == state.liveNow.first()) focusTarget else null,
                        onSelected = { onLiveNowSelected(result) },
                    )
                }
            }
            Spacer(Modifier.height(28.dp))
        }

        if (state.upcoming.isNotEmpty()) {
            LiveSearchShelfTitle("À venir")
            Spacer(Modifier.height(12.dp))
            TvLazyRow(
                contentPadding = PaddingValues(horizontal = 56.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                items(
                    state.upcoming,
                    key = { "${it.channelId}-${it.programTitle}-${it.startTime}" },
                ) { result ->
                    UpcomingShelfCard(
                        result = result,
                        requestInitialFocus = result == state.upcoming.first() && state.liveNow.isEmpty(),
                        focusRequester = if (result == state.upcoming.first() && state.liveNow.isEmpty()) {
                            focusTarget
                        } else {
                            null
                        },
                        onSelected = {
                            onChannelSelected(
                                ChannelSearchResult(
                                    channelId = result.channelId,
                                    channelName = result.channelName,
                                    logoUrl = result.logoUrl,
                                ),
                            )
                        },
                    )
                }
            }
            Spacer(Modifier.height(28.dp))
        }

        if (state.channels.isNotEmpty()) {
            LiveSearchShelfTitle("Chaînes")
            Spacer(Modifier.height(12.dp))
            TvLazyRow(
                contentPadding = PaddingValues(horizontal = 56.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                items(state.channels, key = { it.channelId }) { result ->
                    ChannelSearchShelfCard(
                        result = result,
                        requestInitialFocus = result == state.channels.first() &&
                            state.liveNow.isEmpty() &&
                            state.upcoming.isEmpty(),
                        focusRequester = if (
                            result == state.channels.first() &&
                            state.liveNow.isEmpty() &&
                            state.upcoming.isEmpty()
                        ) {
                            focusTarget
                        } else {
                            null
                        },
                        onSelected = { onChannelSelected(result) },
                    )
                }
            }
        }
    }
}

@Composable
fun LiveSearchShelfTitle(title: String) {
    Text(
        title,
        color = TvColors.TextPrimary,
        fontSize = 22.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(horizontal = 56.dp),
    )
}

@Composable
private fun LiveNowShelfCard(
    result: LiveNowResult,
    isSingleLive: Boolean,
    requestInitialFocus: Boolean,
    focusRequester: FocusRequester?,
    onSelected: () -> Unit,
) {
    val localFocus = focusRequester ?: remember { FocusRequester() }
    LaunchedEffect(requestInitialFocus, result.channelId) {
        if (requestInitialFocus) runCatching { localFocus.requestFocus() }
    }
    val safeProgress = result.progress.coerceIn(0f, 1f)
    val badgeLabel = if (isSingleLive) "Lancer · DIRECT" else "EN DIRECT"

    Surface(
        onClick = onSelected,
        modifier = Modifier
            .width(240.dp)
            .focusRequester(localFocus)
            .launchOnEnter(onSelected),
        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(8.dp)),
        colors = shelfCardColors(),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.06f),
        border = shelfCardBorder(),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                SearchChannelLogo(logoUrl = result.logoUrl, name = result.channelName)
                Spacer(Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        result.channelName,
                        color = TvColors.TextPrimary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        result.programTitle,
                        color = TvColors.TextMuted,
                        fontSize = 12.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        lineHeight = 14.sp,
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            Box(
                modifier = Modifier
                    .background(TvColors.LiveTvAccent, RoundedCornerShape(4.dp))
                    .padding(horizontal = 8.dp, vertical = 3.dp),
            ) {
                Text(badgeLabel, color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(6.dp))
            Text(
                "${formatSearchIsoTime(result.startTime)} – ${formatSearchIsoTime(result.endTime)}",
                color = Color(0xFF666666),
                fontSize = 10.sp,
            )
            if (safeProgress > 0f) {
                Spacer(Modifier.height(6.dp))
                Canvas(modifier = Modifier.fillMaxWidth().height(3.dp)) {
                    drawRect(color = Color(0xFF2A2A2A), size = size)
                    drawRect(
                        color = TvColors.LiveTvAccent,
                        size = Size(size.width * safeProgress, size.height),
                    )
                }
            }
        }
    }
}

@Composable
private fun UpcomingShelfCard(
    result: UpcomingResult,
    requestInitialFocus: Boolean,
    focusRequester: FocusRequester?,
    onSelected: () -> Unit,
) {
    val localFocus = focusRequester ?: remember { FocusRequester() }
    LaunchedEffect(requestInitialFocus, result.channelId) {
        if (requestInitialFocus) runCatching { localFocus.requestFocus() }
    }

    Surface(
        onClick = onSelected,
        modifier = Modifier
            .width(220.dp)
            .focusRequester(localFocus)
            .launchOnEnter(onSelected),
        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(8.dp)),
        colors = shelfCardColors(),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.06f),
        border = shelfCardBorder(),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                SearchChannelLogo(logoUrl = result.logoUrl, name = result.channelName)
                Spacer(Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        result.channelName,
                        color = TvColors.TextPrimary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        result.programTitle,
                        color = TvColors.TextMuted,
                        fontSize = 12.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            Spacer(Modifier.height(10.dp))
            Text(
                formatSearchIsoTime(result.startTime),
                color = TvColors.LiveTvAccent,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                formatSearchIsoDateShort(result.startTime),
                color = TvColors.TextMuted,
                fontSize = 11.sp,
            )
        }
    }
}

@Composable
private fun ChannelSearchShelfCard(
    result: ChannelSearchResult,
    requestInitialFocus: Boolean,
    focusRequester: FocusRequester?,
    onSelected: () -> Unit,
) {
    val localFocus = focusRequester ?: remember { FocusRequester() }
    LaunchedEffect(requestInitialFocus, result.channelId) {
        if (requestInitialFocus) runCatching { localFocus.requestFocus() }
    }

    Surface(
        onClick = onSelected,
        modifier = Modifier
            .width(180.dp)
            .focusRequester(localFocus)
            .launchOnEnter(onSelected),
        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(8.dp)),
        colors = shelfCardColors(),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.06f),
        border = shelfCardBorder(),
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            SearchChannelLogo(logoUrl = result.logoUrl, name = result.channelName, size = 56)
            Spacer(Modifier.height(8.dp))
            Text(
                result.channelName,
                color = TvColors.TextPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            if (result.categories.isNotEmpty()) {
                Spacer(Modifier.height(6.dp))
                Text(
                    result.categories.first(),
                    color = TvColors.LiveTvAccent,
                    fontSize = 11.sp,
                    maxLines = 1,
                )
            }
        }
    }
}

@Composable
private fun SearchChannelLogo(logoUrl: String?, name: String, size: Int = 48) {
    Box(
        modifier = Modifier
            .size(size.dp)
            .background(Color(0xFF1A1A2A), RoundedCornerShape(6.dp)),
        contentAlignment = Alignment.Center,
    ) {
        if (!logoUrl.isNullOrBlank()) {
            AsyncImage(
                model = ImageRequest.Builder(LocalContext.current)
                    .data(logoUrl)
                    .crossfade(true)
                    .build(),
                contentDescription = name,
                contentScale = ContentScale.Fit,
                modifier = Modifier.size((size * 0.85f).dp),
            )
        } else {
            Text(
                name.take(1).uppercase(),
                color = TvColors.LiveTvAccent,
                fontSize = (size / 2.5f).sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun shelfCardColors() = ClickableSurfaceDefaults.colors(
    containerColor = TvColors.Surface,
    focusedContainerColor = TvColors.SurfaceFocused,
    pressedContainerColor = TvColors.SurfaceFocused,
    contentColor = TvColors.TextPrimary,
    focusedContentColor = TvColors.TextPrimary,
)

@Composable
private fun shelfCardBorder() = ClickableSurfaceDefaults.border(
    border = Border(
        border = BorderStroke(1.dp, Color(0xFF2A2A2A)),
        shape = RoundedCornerShape(8.dp),
    ),
    focusedBorder = Border(
        border = BorderStroke(3.dp, TvColors.LiveTvAccent),
        shape = RoundedCornerShape(8.dp),
    ),
)

internal fun Modifier.launchOnEnter(onSelected: () -> Unit): Modifier =
    onKeyEvent { event ->
        if (event.type != KeyEventType.KeyDown) return@onKeyEvent false
        when (event.key) {
            Key.Enter, Key.NumPadEnter, Key.DirectionCenter -> {
                onSelected()
                true
            }
            else -> false
        }
    }

fun formatSearchIsoTime(isoTime: String): String = runCatching {
    ZonedDateTime.parse(isoTime)
        .withZoneSameInstant(ZoneId.systemDefault())
        .format(DateTimeFormatter.ofPattern("HH:mm"))
}.getOrElse { isoTime.substringAfter('T', isoTime).take(5) }

fun formatSearchIsoDateShort(isoTime: String): String = runCatching {
    val local = ZonedDateTime.parse(isoTime).withZoneSameInstant(ZoneId.systemDefault())
    "${local.dayOfMonth.toString().padStart(2, '0')}/${local.monthValue.toString().padStart(2, '0')}"
}.getOrElse {
    val date = isoTime.substringBefore('T', isoTime)
    val parts = date.split('-')
    if (parts.size == 3) "${parts[2]}/${parts[1]}" else date
}
