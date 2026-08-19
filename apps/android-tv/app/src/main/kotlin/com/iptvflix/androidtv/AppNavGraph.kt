package com.iptvflix.androidtv

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import com.iptvflix.androidtv.command.CommandViewModel
import com.iptvflix.androidtv.home.HomeScreen
import com.iptvflix.androidtv.pairing.PairingScreen
import com.iptvflix.androidtv.player.PlayerScreen
import com.iptvflix.androidtv.profiles.WhoIsWatchingScreen
import com.iptvflix.androidtv.storage.SecureStorage

private enum class Screen { Pairing, WhoIsWatching, Home, Player }

private fun initialScreen(secureStorage: SecureStorage): Screen = when {
    secureStorage.getDeviceToken() == null -> Screen.Pairing
    secureStorage.getProfileToken() != null -> Screen.Home
    else -> Screen.WhoIsWatching
}

@Composable
fun AppNavGraph() {
    val context = LocalContext.current
    val secureStorage = remember { SecureStorage(context) }

    var currentScreen by rememberSaveable {
        mutableStateOf(initialScreen(secureStorage).name)
    }
    val screen = Screen.entries.firstOrNull { it.name == currentScreen } ?: Screen.Pairing

    val commandVm: CommandViewModel = viewModel()
    val isRevoked by commandVm.isRevoked.collectAsState()
    val latestCommand by commandVm.latestCommand.collectAsState()

    LaunchedEffect(isRevoked) {
        if (isRevoked) currentScreen = Screen.Pairing.name
    }

    LaunchedEffect(latestCommand) {
        if (latestCommand != null && secureStorage.getProfileToken() != null) {
            currentScreen = Screen.Player.name
        }
    }

    when (screen) {
        Screen.Pairing -> PairingScreen(
            onPaired = { currentScreen = Screen.WhoIsWatching.name },
        )
        Screen.WhoIsWatching -> WhoIsWatchingScreen(
            lastUsedProfileId = secureStorage.getLastUsedProfileId(),
            onProfileSelected = { currentScreen = Screen.Home.name },
        )
        Screen.Home -> HomeScreen(
            onRevoked = { currentScreen = Screen.Pairing.name },
            onChangeProfile = { currentScreen = Screen.WhoIsWatching.name },
        )
        Screen.Player -> PlayerScreen(
            command = commandVm.currentCommand(),
            onStop = {
                commandVm.clearCommand()
                currentScreen = Screen.Home.name
            },
        )
    }
}
