package com.iptvflix.androidtv.home

import android.app.Activity
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.material3.Text
import com.iptvflix.androidtv.ui.TvColors
import com.iptvflix.androidtv.ui.TvConfirmOverlay
import com.iptvflix.androidtv.ui.TvPrimaryButton

@Composable
fun HomeScreen(
    onRevoked: () -> Unit,
    onChangeProfile: () -> Unit = {},
    vm: HomeViewModel = viewModel(),
) {
    val state by vm.uiState.collectAsState()
    var showQuitDialog by remember { mutableStateOf(false) }
    val activity = LocalContext.current as? Activity

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
                .padding(horizontal = 64.dp, vertical = 48.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "IPTVFlix",
                    color = TvColors.Accent,
                    fontSize = 36.sp,
                    fontWeight = FontWeight.Bold,
                )
                ConnectionBadge(state.connectionStatus)
            }

            Spacer(Modifier.weight(1f))

            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    state.deviceName,
                    color = TvColors.TextPrimary,
                    fontSize = 42.sp,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(12.dp))
                Text(
                    "Prêt à lire",
                    color = TvColors.TextSecondary,
                    fontSize = 22.sp,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    "Lancez un film ou une série depuis votre téléphone ou le navigateur.",
                    color = TvColors.TextMuted,
                    fontSize = 18.sp,
                )

                state.lastPlayedTitle?.let { title ->
                    Spacer(Modifier.height(40.dp))
                    LastPlayedCard(title = title)
                }
            }

            Spacer(Modifier.weight(1f))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
            ) {
                TvPrimaryButton(
                    label = "Changer de profil",
                    onClick = onChangeProfile,
                    requestInitialFocus = true,
                )
            }
        }
    }
}

@Composable
private fun LastPlayedCard(title: String) {
    Box(
        modifier = Modifier
            .width(420.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(TvColors.Surface)
            .border(1.dp, Color(0xFF333344), RoundedCornerShape(12.dp))
            .padding(24.dp),
    ) {
        Column {
            Text("Dernière lecture", color = TvColors.TextMuted, fontSize = 14.sp)
            Spacer(Modifier.height(8.dp))
            Text(title, color = TvColors.TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Medium)
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
