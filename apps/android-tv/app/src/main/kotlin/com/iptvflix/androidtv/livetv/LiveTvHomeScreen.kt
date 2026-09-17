package com.iptvflix.androidtv.livetv

import android.app.Activity
import android.content.Intent
import android.speech.RecognizerIntent
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.foundation.lazy.list.TvLazyColumn
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.items
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.iptvflix.androidtv.App
import com.iptvflix.androidtv.home.HomeViewModel
import com.iptvflix.androidtv.ui.AppHomeChrome
import com.iptvflix.androidtv.ui.AppHomeMode
import com.iptvflix.androidtv.ui.TvColors

@Composable
fun LiveTvHomeScreen(
    onBack: () -> Unit,
    onSwitchToVod: () -> Unit = onBack,
    onChangeProfile: () -> Unit = {},
    onChannelSelected: (ChannelResponse) -> Unit = {},
    onLiveNowSelected: (LiveNowResult) -> Unit = {},
    onChannelSearchSelected: (ChannelSearchResult) -> Unit = {},
) {
    val app = LocalContext.current.applicationContext as App
    val viewModel: LiveTvHomeViewModel = viewModel(
        factory = LiveTvHomeViewModel.factory(app),
    )
    val searchViewModel: LiveSearchViewModel = viewModel(
        factory = LiveSearchViewModel.factory(app),
    )
    val profileKey = app.secureStorage.getLastUsedProfileId() ?: "home"
    val homeViewModel: HomeViewModel = viewModel(key = profileKey)
    val state by viewModel.state.collectAsState()
    val searchState by searchViewModel.state.collectAsState()
    val homeState by homeViewModel.uiState.collectAsState()
    var query by remember { mutableStateOf("") }
    var searchActive by remember { mutableStateOf(false) }
    var focusResultsAfterSearch by remember { mutableStateOf(false) }
    val searchBarFocus = remember { FocusRequester() }

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
            searchActive = true
            focusResultsAfterSearch = true
            searchViewModel.onVoiceResult(text)
        }
    }

    LaunchedEffect(profileKey) {
        homeViewModel.refreshCurrentProfile()
    }

    val isSearching = searchActive

    BackHandler {
        if (isSearching || query.isNotBlank()) {
            query = ""
            searchActive = false
            focusResultsAfterSearch = false
            searchViewModel.clearQuery()
        } else {
            onBack()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(TvColors.Background)
            .padding(top = 16.dp, bottom = 12.dp),
    ) {
        AppHomeChrome(
            mode = AppHomeMode.LiveTv,
            deviceName = homeState.deviceName,
            statusLabel = "En direct",
            connectionStatus = homeState.connectionStatus,
            profileName = homeState.profileName,
            profileAvatarKey = homeState.profileAvatarKey,
            onChangeProfile = onChangeProfile,
            onSelectVod = onSwitchToVod,
            onSelectLiveTv = {},
            requestProfileFocus = false,
        )

        Spacer(Modifier.height(12.dp))

        Box(modifier = Modifier.weight(1f).fillMaxSize()) {
            when (val s = state) {
                is LiveTvHomeState.Loading -> LoadingContent()
                is LiveTvHomeState.Error -> ErrorContent(message = s.message, onRetry = { viewModel.retry() })
                is LiveTvHomeState.Ready -> {
                    LiveTvMainContent(
                        homeState = s,
                        searchState = searchState,
                        query = query,
                        isSearching = isSearching,
                        searchBarFocus = searchBarFocus,
                        hasVoice = hasVoice,
                        isSingleLiveNow = searchViewModel.isSingleLiveNowResult,
                        focusResultsAfterSearch = focusResultsAfterSearch,
                        onQueryChange = { newText ->
                            query = newText
                            // Keep focus in the field: do not search while typing.
                            if (newText.isBlank()) {
                                searchActive = false
                                focusResultsAfterSearch = false
                                searchViewModel.clearQuery()
                            }
                        },
                        onSearchConfirm = {
                            val q = query.trim()
                            if (q.isEmpty()) return@LiveTvMainContent
                            searchActive = true
                            focusResultsAfterSearch = true
                            searchViewModel.onQueryChanged(q)
                        },
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
                        onResultsFocused = { focusResultsAfterSearch = false },
                        onRetrySearch = {
                            val q = (searchState as? LiveSearchState.Error)?.query ?: query
                            searchActive = true
                            focusResultsAfterSearch = true
                            searchViewModel.onQueryChanged(q)
                        },
                        onChannelSelected = onChannelSelected,
                        onLiveNowSelected = onLiveNowSelected,
                        onChannelSearchSelected = onChannelSearchSelected,
                    )
                }
            }
        }
    }
}

@Composable
private fun LiveTvMainContent(
    homeState: LiveTvHomeState.Ready,
    searchState: LiveSearchState,
    query: String,
    isSearching: Boolean,
    searchBarFocus: FocusRequester,
    hasVoice: Boolean,
    isSingleLiveNow: Boolean,
    focusResultsAfterSearch: Boolean,
    onQueryChange: (String) -> Unit,
    onSearchConfirm: () -> Unit,
    onVoiceLaunch: () -> Unit,
    onResultsFocused: () -> Unit,
    onRetrySearch: () -> Unit,
    onChannelSelected: (ChannelResponse) -> Unit,
    onLiveNowSelected: (LiveNowResult) -> Unit,
    onChannelSearchSelected: (ChannelSearchResult) -> Unit,
) {
    val catalogEmpty = homeState.recent.isEmpty() &&
        homeState.favorites.isEmpty() &&
        homeState.all.isEmpty()

    val focusTargetId = when {
        !isSearching && homeState.recent.isNotEmpty() -> homeState.recent.first().id
        !isSearching && homeState.favorites.isNotEmpty() -> homeState.favorites.first().id
        !isSearching && homeState.all.isNotEmpty() -> homeState.all.first().id
        else -> null
    }

    TvLazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(top = 4.dp, bottom = 40.dp),
    ) {
        item {
            Text(
                "TV en direct",
                color = TvColors.LiveTvAccent,
                fontSize = 34.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 56.dp),
            )
            Spacer(Modifier.height(20.dp))
            LiveSearchBar(
                query = query,
                onQueryChange = onQueryChange,
                onConfirm = onSearchConfirm,
                searchBarFocus = searchBarFocus,
                hasVoice = hasVoice,
                onVoiceLaunch = onVoiceLaunch,
            )
            Spacer(Modifier.height(24.dp))
        }

        if (isSearching) {
            when (searchState) {
                is LiveSearchState.Idle, is LiveSearchState.Loading -> item {
                    SearchLoadingInline()
                }
                is LiveSearchState.Results -> item {
                    LiveSearchResultShelves(
                        state = searchState,
                        isSingleLiveNow = isSingleLiveNow,
                        onLiveNowSelected = onLiveNowSelected,
                        onChannelSelected = onChannelSearchSelected,
                        moveFocusToResults = focusResultsAfterSearch,
                        onFocusMoved = onResultsFocused,
                    )
                }
                is LiveSearchState.NoResults -> item {
                    SearchMessageInline("Aucun programme trouvé")
                }
                is LiveSearchState.Error -> item {
                    SearchErrorInline(onRetry = onRetrySearch)
                }
            }
        } else if (catalogEmpty) {
            item { SearchMessageInline("Aucune chaîne disponible") }
        } else {
            if (homeState.recent.isNotEmpty()) {
                item {
                    SectionTitle("Récemment regardé")
                    Spacer(Modifier.height(16.dp))
                    TvLazyRow(
                        contentPadding = PaddingValues(horizontal = 56.dp),
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        items(homeState.recent, key = { it.id }) { channel ->
                            ChannelCard(
                                channel = channel,
                                requestInitialFocus = channel.id == focusTargetId,
                                onSelected = { onChannelSelected(channel) },
                            )
                        }
                    }
                    Spacer(Modifier.height(32.dp))
                }
            }

            if (homeState.favorites.isNotEmpty()) {
                item {
                    SectionTitle("Favoris")
                    Spacer(Modifier.height(16.dp))
                    TvLazyRow(
                        contentPadding = PaddingValues(horizontal = 56.dp),
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        items(homeState.favorites, key = { it.id }) { channel ->
                            ChannelCard(
                                channel = channel,
                                requestInitialFocus = channel.id == focusTargetId,
                                onSelected = { onChannelSelected(channel) },
                            )
                        }
                    }
                    Spacer(Modifier.height(32.dp))
                }
            }

            if (homeState.all.isNotEmpty()) {
                item {
                    SectionTitle("Toutes les chaînes")
                    Spacer(Modifier.height(16.dp))
                }
                items(homeState.all, key = { it.id }) { channel ->
                    ChannelListRow(
                        channel = channel,
                        requestInitialFocus = channel.id == focusTargetId,
                        onSelected = { onChannelSelected(channel) },
                    )
                    Spacer(Modifier.height(8.dp))
                }
            }
        }
    }
}

@Composable
private fun SearchLoadingInline() {
    val infiniteTransition = rememberInfiniteTransition(label = "search-spinner")
    val angle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(1000, easing = LinearEasing)),
        label = "angle",
    )
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(vertical = 48.dp),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(modifier = Modifier.size(40.dp)) {
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
private fun SearchMessageInline(message: String) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(vertical = 48.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(message, color = TvColors.TextMuted, fontSize = 18.sp)
    }
}

@Composable
private fun SearchErrorInline(onRetry: () -> Unit) {
    val focusRequester = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focusRequester.requestFocus() } }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Erreur de recherche", color = TvColors.Error, fontSize = 18.sp, fontWeight = FontWeight.Medium)
        Spacer(Modifier.height(20.dp))
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
private fun LoadingContent() {
    val infiniteTransition = rememberInfiniteTransition(label = "spinner")
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
private fun ErrorContent(message: String, onRetry: () -> Unit) {
    val focusRequester = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focusRequester.requestFocus() } }

    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(message, color = TvColors.Error, fontSize = 18.sp, fontWeight = FontWeight.Medium)
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
private fun SectionTitle(title: String) {
    Text(
        title,
        color = TvColors.TextPrimary,
        fontSize = 22.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(horizontal = 56.dp),
    )
}

@Composable
private fun ChannelCard(
    channel: ChannelResponse,
    requestInitialFocus: Boolean = false,
    onSelected: () -> Unit = {},
) {
    val focusRequester = remember { FocusRequester() }
    LaunchedEffect(requestInitialFocus) {
        if (requestInitialFocus) runCatching { focusRequester.requestFocus() }
    }

    Surface(
        onClick = onSelected,
        modifier = Modifier
            .width(180.dp)
            .focusRequester(focusRequester)
            .launchOnEnter(onSelected),
        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(8.dp)),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = TvColors.Surface,
            focusedContainerColor = TvColors.SurfaceFocused,
            pressedContainerColor = TvColors.SurfaceFocused,
            contentColor = TvColors.TextPrimary,
            focusedContentColor = TvColors.TextPrimary,
        ),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.06f),
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
        Column(modifier = Modifier.padding(12.dp)) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .background(Color(0xFF1A1A2A), RoundedCornerShape(6.dp)),
                contentAlignment = Alignment.Center,
            ) {
                if (!channel.logoUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current)
                            .data(channel.logoUrl)
                            .size(96)
                            .crossfade(false)
                            .build(),
                        contentDescription = channel.name,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.size(48.dp),
                    )
                } else {
                    Text(
                        channel.name.take(1).uppercase(),
                        color = TvColors.LiveTvAccent,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            Text(
                channel.name,
                color = TvColors.TextPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (channel.epg?.now != null) {
                Spacer(Modifier.height(4.dp))
                Text(
                    channel.epg.now.title,
                    color = TvColors.TextMuted,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (channel.categories.isNotEmpty()) {
                Spacer(Modifier.height(4.dp))
                Text(
                    channel.categories.first(),
                    color = TvColors.LiveTvAccent,
                    fontSize = 11.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun ChannelListRow(
    channel: ChannelResponse,
    requestInitialFocus: Boolean = false,
    onSelected: () -> Unit = {},
) {
    val focusRequester = remember { FocusRequester() }
    LaunchedEffect(requestInitialFocus) {
        if (requestInitialFocus) runCatching { focusRequester.requestFocus() }
    }

    Surface(
        onClick = onSelected,
        modifier = Modifier
            .padding(horizontal = 56.dp)
            .focusRequester(focusRequester)
            .launchOnEnter(onSelected),
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
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .background(Color(0xFF1A1A2A), RoundedCornerShape(6.dp)),
                contentAlignment = Alignment.Center,
            ) {
                if (!channel.logoUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current)
                            .data(channel.logoUrl)
                            .size(80)
                            .crossfade(false)
                            .build(),
                        contentDescription = channel.name,
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.size(40.dp),
                    )
                } else {
                    Text(
                        channel.name.take(1).uppercase(),
                        color = TvColors.LiveTvAccent,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
            Spacer(Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    channel.name,
                    color = TvColors.TextPrimary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (channel.epg?.now != null) {
                    Spacer(Modifier.height(3.dp))
                    Text(
                        channel.epg.now.title,
                        color = TvColors.TextMuted,
                        fontSize = 13.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            if (channel.categories.isNotEmpty()) {
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
                        channel.categories.first(),
                        color = TvColors.LiveTvAccent,
                        fontSize = 11.sp,
                        maxLines = 1,
                    )
                }
            }
        }
    }
}
