package com.iptvflix.androidtv

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
        Screen.Home -> HomeScreen(
            onRevoked = {
                pairingGeneration++
                currentScreen = Screen.Pairing.name
            },
            onChangeProfile = {
                secureStorage.clearProfileToken()
                commandVm.clearCommand()
                currentScreen = Screen.WhoIsWatching.name
            },
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
