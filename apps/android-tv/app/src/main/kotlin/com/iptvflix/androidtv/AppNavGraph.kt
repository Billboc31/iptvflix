package com.iptvflix.androidtv

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
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

@Composable
fun AppNavGraph() {
    val context = LocalContext.current
    val secureStorage = remember { SecureStorage(context) }

    val hasPairedDevice = secureStorage.getDeviceToken() != null
    var currentScreen by remember {
        mutableStateOf(if (hasPairedDevice) Screen.WhoIsWatching else Screen.Pairing)
    }

    val commandVm: CommandViewModel = viewModel()
    val isRevoked by commandVm.isRevoked.collectAsState()
    val latestCommand by commandVm.commands.collectAsState(initial = null)

    LaunchedEffect(isRevoked) {
        if (isRevoked) currentScreen = Screen.Pairing
    }

    LaunchedEffect(latestCommand) {
        if (latestCommand != null) currentScreen = Screen.Player
    }

    when (currentScreen) {
        Screen.Pairing -> PairingScreen(
            onPaired = { currentScreen = Screen.WhoIsWatching },
        )
        Screen.WhoIsWatching -> WhoIsWatchingScreen(
            lastUsedProfileId = secureStorage.getLastUsedProfileId(),
            onProfileSelected = { currentScreen = Screen.Home },
        )
        Screen.Home -> HomeScreen(
            onRevoked = { currentScreen = Screen.Pairing },
            onChangeProfile = { currentScreen = Screen.WhoIsWatching },
        )
        Screen.Player -> PlayerScreen(
            command = commandVm.currentCommand(),
            onStop = {
                commandVm.clearCommand()
                currentScreen = Screen.Home
            },
        )
    }
}
