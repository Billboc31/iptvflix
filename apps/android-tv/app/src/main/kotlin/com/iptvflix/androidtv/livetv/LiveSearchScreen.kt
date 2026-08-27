package com.iptvflix.androidtv.livetv

import android.app.Activity
import android.content.Intent
import android.speech.RecognizerIntent
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.items
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.iptvflix.androidtv.App
import com.iptvflix.androidtv.ui.TvColors

@Composable
fun LiveSearchScreen(
    viewModel: LiveSearchViewModel = viewModel(
        factory = LiveSearchViewModel.factory(LocalContext.current.applicationContext as App),
    ),
    onBack: () -> Unit,
    onChannelSelected: (ChannelSearchResult) -> Unit = {},
    onLiveNowSelected: (LiveNowResult) -> Unit = {},
) {
    val state by viewModel.state.collectAsState()
    var query by remember { mutableStateOf("") }

    val context = LocalContext.current
    @Suppress("DEPRECATION")
    val hasVoice = remember(context) {
        runCatching {
            context.packageManager.resolveActivity(
                Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH), 0,
            ) != null
        }.getOrDefault(false)
    }

    val voiceLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val text = result.data
                ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                ?.firstOrNull() ?: return@rememberLauncherForActivityResult
            query = text
            viewModel.onVoiceResult(text)
        }
    }

    val searchBarFr = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        runCatching { searchBarFr.requestFocus() }
    }

    LaunchedEffect(state) {
        if (state is LiveSearchState.Idle) {
            runCatching { searchBarFr.requestFocus() }
        }
    }

    BackHandler { onBack() }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(TvColors.Background),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            SearchBar(
                query = query,
                onQueryChange = { newText ->
                    query = newText
                    viewModel.onQueryChanged(newText)
                },
                hasVoice = hasVoice,
                onVoiceLaunch = {
                    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                        putExtra(
                            RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                            RecognizerIntent.LANGUAGE_MODEL_FREE_FORM,
                        )
                        putExtra(RecognizerIntent.EXTRA_PROMPT, "Rechercher une chaîne ou un programme")
                    }
                    voiceLauncher.launch(intent)
                },
                searchBarFr = searchBarFr,
            )

            Box(modifier = Modifier.fillMaxSize()) {
                when (val s = state) {
                    is LiveSearchState.Idle -> IdleContent()
                    is LiveSearchState.Loading -> SearchLoadingContent()
                    is LiveSearchState.Results -> ResultsContent(
                        state = s,
                        isSingleLiveNow = viewModel.isSingleLiveNowResult,
                        onLiveNowSelected = onLiveNowSelected,
                        onChannelSelected = onChannelSelected,
                    )
                    is LiveSearchState.NoResults -> NoResultsContent()
                    is LiveSearchState.Error -> SearchErrorContent(
                        onRetry = { viewModel.onQueryChanged(s.query) },
                    )
                }
            }
        }
    }
}

@Composable
private fun SearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    hasVoice: Boolean,
    onVoiceLaunch: () -> Unit,
    searchBarFr: FocusRequester,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(TvColors.Background)
            .padding(horizontal = 56.dp, vertical = 24.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "⌕",
            color = TvColors.LiveTvAccent,
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.width(16.dp))

        BasicTextField(
            value = query,
            onValueChange = onQueryChange,
            modifier = Modifier
                .weight(1f)
                .focusRequester(searchBarFr)
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
                fontSize = 24.sp,
                fontWeight = FontWeight.Normal,
            ),
            cursorBrush = SolidColor(TvColors.LiveTvAccent),
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(
                onSearch = { onQueryChange(query) },
            ),
            decorationBox = { innerTextField ->
                Box(contentAlignment = Alignment.CenterStart) {
                    if (query.isEmpty()) {
                        Text(
                            "Rechercher une chaîne ou un programme…",
                            color = TvColors.TextMuted,
                            fontSize = 24.sp,
                        )
                    }
                    innerTextField()
                }
            },
        )

        if (hasVoice) {
            Spacer(Modifier.width(16.dp))
            MicButton(onClick = onVoiceLaunch)
        }
    }
}

@Composable
private fun MicButton(onClick: () -> Unit) {
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()

    Surface(
        onClick = onClick,
        interactionSource = interactionSource,
        modifier = Modifier
            .size(48.dp)
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
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(
                "🎙",
                fontSize = 22.sp,
                color = if (isFocused) Color.White else TvColors.TextPrimary,
            )
        }
    }
}

@Composable
private fun IdleContent() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(
            "Tapez pour rechercher une chaîne ou un programme",
            color = TvColors.TextMuted,
            fontSize = 18.sp,
        )
    }
}

@Composable
private fun SearchLoadingContent() {
    val infiniteTransition = rememberInfiniteTransition(label = "search-spinner")
    val angle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(1000, easing = LinearEasing)),
        label = "angle",
    )
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.size(48.dp)) {
            drawArc(
                color = TvColors.LiveTvAccent,
                startAngle = angle,
                sweepAngle = 270f,
                useCenter = false,
                style = Stroke(width = 4.dp.toPx(), cap = StrokeCap.Round),
            )
        }
    }
}

@Composable
private fun NoResultsContent() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(
            "Aucun programme trouvé",
            color = TvColors.TextMuted,
            fontSize = 18.sp,
        )
    }
}

@Composable
private fun SearchErrorContent(onRetry: () -> Unit) {
    val focusRequester = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focusRequester.requestFocus() } }

    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Erreur de recherche", color = TvColors.Error, fontSize = 18.sp, fontWeight = FontWeight.Medium)
        Spacer(Modifier.height(24.dp))
        Surface(
            onClick = onRetry,
            modifier = Modifier
                .focusRequester(focusRequester)
                .pointerInput(Unit) { detectTapGestures(onTap = { onRetry() }) },
            shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(8.dp)),
            colors = ClickableSurfaceDefaults.colors(
                containerColor = TvColors.LiveTvAccent,
                focusedContainerColor = TvColors.LiveTvAccent,
                pressedContainerColor = TvColors.LiveTvAccent,
            ),
            scale = ClickableSurfaceDefaults.scale(focusedScale = 1.08f),
        ) {
            Text(
                "Réessayer",
                color = Color.White,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(horizontal = 28.dp, vertical = 12.dp),
            )
        }
    }
}

@Composable
private fun ResultsContent(
    state: LiveSearchState.Results,
    isSingleLiveNow: Boolean,
    onLiveNowSelected: (LiveNowResult) -> Unit,
    onChannelSelected: (ChannelSearchResult) -> Unit,
) {
    val firstLiveNowFr = remember { FocusRequester() }
    val firstUpcomingFr = remember { FocusRequester() }
    val firstChannelFr = remember { FocusRequester() }

    LaunchedEffect(state.query) {
        when {
            state.liveNow.isNotEmpty() -> runCatching { firstLiveNowFr.requestFocus() }
            state.upcoming.isNotEmpty() -> runCatching { firstUpcomingFr.requestFocus() }
            state.channels.isNotEmpty() -> runCatching { firstChannelFr.requestFocus() }
        }
    }

    TvLazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(vertical = 16.dp),
    ) {
        if (state.liveNow.isNotEmpty()) {
            item { SearchSectionTitle("En direct maintenant") }
            items(state.liveNow, key = { it.channelId + it.programTitle }) { result ->
                LiveNowRow(
                    result = result,
                    isSingleLive = isSingleLiveNow,
                    requestInitialFocus = result == state.liveNow.first(),
                    focusKey = state.query,
                    firstFocusRequester = if (result == state.liveNow.first()) firstLiveNowFr else null,
                    onSelected = { onLiveNowSelected(result) },
                )
                Spacer(Modifier.height(8.dp))
            }
            item { Spacer(Modifier.height(8.dp)) }
        }

        if (state.upcoming.isNotEmpty()) {
            item { SearchSectionTitle("À venir") }
            items(state.upcoming, key = { it.channelId + it.programTitle + it.startTime }) { result ->
                UpcomingRow(
                    result = result,
                    requestInitialFocus = result == state.upcoming.first() && state.liveNow.isEmpty(),
                    focusKey = state.query,
                    firstFocusRequester = if (result == state.upcoming.first() && state.liveNow.isEmpty()) firstUpcomingFr else null,
                )
                Spacer(Modifier.height(8.dp))
            }
            item { Spacer(Modifier.height(8.dp)) }
        }

        if (state.channels.isNotEmpty()) {
            item { SearchSectionTitle("Chaînes") }
            items(state.channels, key = { it.channelId }) { result ->
                ChannelSearchRow(
                    result = result,
                    requestInitialFocus = result == state.channels.first() && state.liveNow.isEmpty() && state.upcoming.isEmpty(),
                    focusKey = state.query,
                    firstFocusRequester = if (result == state.channels.first() && state.liveNow.isEmpty() && state.upcoming.isEmpty()) firstChannelFr else null,
                    onSelected = { onChannelSelected(result) },
                )
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}

@Composable
private fun SearchSectionTitle(title: String) {
    Text(
        title,
        color = TvColors.TextPrimary,
        fontSize = 22.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(horizontal = 56.dp, vertical = 12.dp),
    )
}

@Composable
private fun LiveNowRow(
    result: LiveNowResult,
    isSingleLive: Boolean,
    requestInitialFocus: Boolean,
    focusKey: Any?,
    firstFocusRequester: FocusRequester?,
    onSelected: () -> Unit,
) {
    val focusRequester = firstFocusRequester ?: remember { FocusRequester() }

    LaunchedEffect(requestInitialFocus, focusKey) {
        if (requestInitialFocus) runCatching { focusRequester.requestFocus() }
    }

    val safeProgress = result.progress.coerceIn(0f, 1f)
    val badgeLabel = if (isSingleLive) "Lancer · EN DIRECT" else "EN DIRECT"

    Surface(
        onClick = onSelected,
        modifier = Modifier
            .padding(horizontal = 56.dp)
            .focusRequester(focusRequester),
        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(8.dp)),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = TvColors.Surface,
            focusedContainerColor = TvColors.SurfaceFocused,
            pressedContainerColor = TvColors.SurfaceFocused,
            contentColor = TvColors.TextPrimary,
            focusedContentColor = TvColors.TextPrimary,
        ),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.03f),
        border = ClickableSurfaceDefaults.border(
            border = Border(
                border = BorderStroke(1.dp, Color(0xFF2A2A2A)),
                shape = RoundedCornerShape(8.dp),
            ),
            focusedBorder = Border(
                border = BorderStroke(3.dp, TvColors.LiveTvAccent),
                shape = RoundedCornerShape(8.dp),
            ),
        ),
    ) {
        Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                ChannelLogoBox(logoUrl = result.logoUrl, name = result.channelName, size = 48)
                Spacer(Modifier.width(16.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        result.channelName,
                        color = TvColors.TextPrimary,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        result.programTitle,
                        color = TvColors.TextMuted,
                        fontSize = 13.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        "${formatIsoTime(result.startTime)} – ${formatIsoTime(result.endTime)}",
                        color = Color(0xFF555555),
                        fontSize = 11.sp,
                    )
                }
                Spacer(Modifier.width(12.dp))
                Box(
                    modifier = Modifier
                        .background(TvColors.LiveTvAccent, RoundedCornerShape(4.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                ) {
                    Text(
                        badgeLabel,
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
            if (safeProgress > 0f) {
                Spacer(Modifier.height(8.dp))
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
private fun UpcomingRow(
    result: UpcomingResult,
    requestInitialFocus: Boolean,
    focusKey: Any?,
    firstFocusRequester: FocusRequester?,
) {
    val focusRequester = firstFocusRequester ?: remember { FocusRequester() }

    LaunchedEffect(requestInitialFocus, focusKey) {
        if (requestInitialFocus) runCatching { focusRequester.requestFocus() }
    }

    Surface(
        onClick = {},
        modifier = Modifier
            .padding(horizontal = 56.dp)
            .focusRequester(focusRequester),
        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(8.dp)),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = TvColors.Surface,
            focusedContainerColor = TvColors.SurfaceFocused,
            pressedContainerColor = TvColors.SurfaceFocused,
            contentColor = TvColors.TextPrimary,
            focusedContentColor = TvColors.TextPrimary,
        ),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.03f),
        border = ClickableSurfaceDefaults.border(
            border = Border(
                border = BorderStroke(1.dp, Color(0xFF2A2A2A)),
                shape = RoundedCornerShape(8.dp),
            ),
            focusedBorder = Border(
                border = BorderStroke(3.dp, TvColors.LiveTvAccent),
                shape = RoundedCornerShape(8.dp),
            ),
        ),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ChannelLogoBox(logoUrl = result.logoUrl, name = result.channelName, size = 48)
            Spacer(Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    result.channelName,
                    color = TvColors.TextPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    result.programTitle,
                    color = TvColors.TextMuted,
                    fontSize = 13.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Spacer(Modifier.width(16.dp))
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    formatIsoTime(result.startTime),
                    color = TvColors.TextPrimary,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    formatIsoDateShort(result.startTime),
                    color = TvColors.TextMuted,
                    fontSize = 12.sp,
                )
            }
        }
    }
}

@Composable
private fun ChannelSearchRow(
    result: ChannelSearchResult,
    requestInitialFocus: Boolean,
    focusKey: Any?,
    firstFocusRequester: FocusRequester?,
    onSelected: () -> Unit,
) {
    val focusRequester = firstFocusRequester ?: remember { FocusRequester() }

    LaunchedEffect(requestInitialFocus, focusKey) {
        if (requestInitialFocus) runCatching { focusRequester.requestFocus() }
    }

    Surface(
        onClick = onSelected,
        modifier = Modifier
            .padding(horizontal = 56.dp)
            .focusRequester(focusRequester),
        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(8.dp)),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = TvColors.Surface,
            focusedContainerColor = TvColors.SurfaceFocused,
            pressedContainerColor = TvColors.SurfaceFocused,
            contentColor = TvColors.TextPrimary,
            focusedContentColor = TvColors.TextPrimary,
        ),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.03f),
        border = ClickableSurfaceDefaults.border(
            border = Border(
                border = BorderStroke(1.dp, Color(0xFF2A2A2A)),
                shape = RoundedCornerShape(8.dp),
            ),
            focusedBorder = Border(
                border = BorderStroke(3.dp, TvColors.LiveTvAccent),
                shape = RoundedCornerShape(8.dp),
            ),
        ),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ChannelLogoBox(logoUrl = result.logoUrl, name = result.channelName, size = 48)
            Spacer(Modifier.width(16.dp))
            Text(
                result.channelName,
                color = TvColors.TextPrimary,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (result.categories.isNotEmpty()) {
                Spacer(Modifier.width(12.dp))
                Box(
                    modifier = Modifier
                        .background(
                            TvColors.LiveTvAccent.copy(alpha = 0.15f),
                            RoundedCornerShape(12.dp),
                        )
                        .padding(horizontal = 10.dp, vertical = 4.dp),
                ) {
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
}

@Composable
private fun ChannelLogoBox(logoUrl: String?, name: String, size: Int) {
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
                modifier = Modifier.size((size * 0.83f).dp),
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

// ISO-8601 "2026-08-27T20:30:00Z" → "20:30"
private fun formatIsoTime(isoTime: String): String =
    isoTime.substringAfter('T', isoTime).take(5)

// ISO-8601 "2026-08-27T20:30:00Z" → "27/08"
private fun formatIsoDateShort(isoTime: String): String {
    val date = isoTime.substringBefore('T', isoTime)
    val parts = date.split('-')
    return if (parts.size == 3) "${parts[2]}/${parts[1]}" else date
}
