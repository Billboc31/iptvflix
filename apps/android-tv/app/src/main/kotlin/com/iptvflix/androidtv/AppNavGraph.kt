package com.iptvflix.androidtv

import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import com.iptvflix.androidtv.command.CommandViewModel
import com.iptvflix.androidtv.command.PlaybackCommand
import com.iptvflix.androidtv.home.HomeScreen
import com.iptvflix.androidtv.livetv.LiveNowResult
import com.iptvflix.androidtv.livetv.LiveSearchScreen
import com.iptvflix.androidtv.livetv.LiveTvHomeScreen
import com.iptvflix.androidtv.pairing.PairingScreen
import com.iptvflix.androidtv.player.PlayerScreen
import com.iptvflix.androidtv.profiles.WhoIsWatchingScreen
import com.iptvflix.androidtv.storage.SecureStorage
import com.iptvflix.androidtv.ui.PlaybackIntroOverlay
import java.util.UUID

private enum class Screen { Pairing, WhoIsWatching, Home, Player, LiveTvHome, LiveTvSearch }

private fun initialScreen(secureStorage: SecureStorage): Screen = when {
    secureStorage.getDeviceToken() == null -> Screen.Pairing
    secureStorage.getProfileToken() != null -> Screen.Home
    else -> Screen.WhoIsWatching
}

@Composable
fun AppNavGraph() {
    val context = LocalContext.current
    val secureStorage = remember { (context.applicationContext as App).secureStorage }

    var currentScreen by remember { mutableStateOf(initialScreen(secureStorage).name) }
    var pairingGeneration by remember { mutableIntStateOf(0) }
    val screen = Screen.entries.firstOrNull { it.name == currentScreen } ?: Screen.Pairing

    val commandVm: CommandViewModel = viewModel()
    val isRevoked by commandVm.isRevoked.collectAsState()
    val latestCommand by commandVm.latestCommand.collectAsState()

    LaunchedEffect(Unit) {
        currentScreen = initialScreen(secureStorage).name
    }

    LaunchedEffect(isRevoked) {
        if (isRevoked) {
            secureStorage.clearProfileToken()
            commandVm.clearCommand()
            pairingGeneration++
            currentScreen = Screen.Pairing.name
        }
    }

    LaunchedEffect(latestCommand, currentScreen) {
        if (latestCommand != null &&
            currentScreen == Screen.Home.name &&
            secureStorage.getProfileToken() != null
        ) {
            currentScreen = Screen.Player.name
        }
    }

    when (screen) {
        Screen.Pairing -> key(pairingGeneration) {
            PairingScreen(
                pairingKey = pairingGeneration,
                onPaired = { currentScreen = Screen.WhoIsWatching.name },
            )
        }
        Screen.WhoIsWatching -> WhoIsWatchingScreen(
            lastUsedProfileId = secureStorage.getLastUsedProfileId(),
            onProfileSelected = { currentScreen = Screen.Home.name },
        )
        Screen.Home -> key(secureStorage.getLastUsedProfileId() ?: "home") {
            HomeScreen(
                onRevoked = {
                    secureStorage.clearDeviceToken()
                    pairingGeneration++
                    currentScreen = Screen.Pairing.name
                },
                onChangeProfile = {
                    secureStorage.clearProfileToken()
                    commandVm.clearCommand()
                    currentScreen = Screen.WhoIsWatching.name
                },
                onResumeLastPlayed = { cmd ->
                    commandVm.playLocal(cmd)
                    currentScreen = Screen.Player.name
                },
                onSwitchToLiveTv = { currentScreen = Screen.LiveTvHome.name },
            )
        }
        Screen.Player -> {
            val command = commandVm.currentCommand()
            var introDoneForId by remember { mutableStateOf<String?>(null) }
            val isLiveChannel = command?.mediaType.equals("channel", ignoreCase = true) == true
            val showIntro = command != null && !isLiveChannel && introDoneForId != command.id

            Box {
                PlayerScreen(
                    command = command,
                    onStop = {
                        val returnToLiveTv =
                            commandVm.currentCommand()?.mediaType.equals("channel", ignoreCase = true) == true
                        commandVm.clearCommand()
                        introDoneForId = null
                        currentScreen = if (returnToLiveTv) {
                            Screen.LiveTvHome.name
                        } else {
                            Screen.Home.name
                        }
                    },
                )
                if (showIntro) {
                    key(command?.id ?: "intro") {
                        PlaybackIntroOverlay(
                            title = command?.title,
                            onFinished = { introDoneForId = command?.id },
                        )
                    }
                }
            }
        }
        Screen.LiveTvHome -> LiveTvHomeScreen(
            onBack = { currentScreen = Screen.Home.name },
            onSwitchToVod = { currentScreen = Screen.Home.name },
            onChangeProfile = {
                secureStorage.clearProfileToken()
                commandVm.clearCommand()
                currentScreen = Screen.WhoIsWatching.name
            },
            onChannelSelected = { ch ->
                commandVm.playLocal(
                    PlaybackCommand(
                        id = "ch-${UUID.randomUUID()}",
                        mediaType = "channel",
                        mediaId = ch.id,
                        title = ch.name,
                        posterUrl = ch.logoUrl,
                        startPositionMs = 0L,
                    ),
                )
                currentScreen = Screen.Player.name
            },
            onOpenSearch = { currentScreen = Screen.LiveTvSearch.name },
        )
        Screen.LiveTvSearch -> LiveSearchScreen(
            onBack = { currentScreen = Screen.LiveTvHome.name },
            onChannelSelected = { ch ->
                commandVm.playLocal(
                    PlaybackCommand(
                        id = "ch-${UUID.randomUUID()}",
                        mediaType = "channel",
                        mediaId = ch.channelId,
                        title = ch.channelName,
                        posterUrl = ch.logoUrl,
                        startPositionMs = 0L,
                    ),
                )
                currentScreen = Screen.Player.name
            },
            onLiveNowSelected = { result: LiveNowResult ->
                commandVm.playLocal(
                    PlaybackCommand(
                        id = "ch-${UUID.randomUUID()}",
                        mediaType = "channel",
                        mediaId = result.channelId,
                        title = result.channelName,
                        posterUrl = result.logoUrl,
                        startPositionMs = 0L,
                    ),
                )
                currentScreen = Screen.Player.name
            },
        )
    }
}
