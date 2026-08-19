package com.iptvflix.androidtv.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.ExperimentalTvMaterial3Api
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import kotlinx.coroutines.delay

@Composable
fun HomeScreen(
    onRevoked: () -> Unit,
    onChangeProfile: () -> Unit = {},
    vm: HomeViewModel = viewModel(),
) {
    val state by vm.uiState.collectAsState()

    LaunchedEffect(state.connectionStatus) {
        if (state.connectionStatus is ConnectionStatus.Revoked) onRevoked()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0F0F1A)),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(32.dp),
        ) {
            ConnectionIndicator(state.connectionStatus)
            Spacer(Modifier.height(16.dp))
            Text(
                state.deviceName,
                color = Color.White,
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "En attente d'une lecture depuis le téléphone…",
                color = Color(0xFFAAAAAA),
                fontSize = 18.sp,
            )
            state.lastPlayedTitle?.let { title ->
                Spacer(Modifier.height(32.dp))
                Text("Last played:", color = Color(0xFF888888), fontSize = 14.sp)
                Text(title, color = Color(0xFFCCCCCC), fontSize = 20.sp)
            }
            Spacer(Modifier.height(40.dp))
            ChangeProfileButton(onClick = onChangeProfile)
        }
    }
}

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun ChangeProfileButton(onClick: () -> Unit) {
    var enabled by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        delay(600)
        enabled = true
    }

    Surface(
        onClick = onClick,
        enabled = enabled,
        colors = ClickableSurfaceDefaults.colors(
            containerColor = Color(0xFF1E1E30),
            focusedContainerColor = Color(0xFF2D2D42),
        ),
        modifier = Modifier.padding(horizontal = 8.dp),
    ) {
        Text(
            "Changer de profil",
            color = Color(0xFFAAAAAA),
            fontSize = 16.sp,
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp),
        )
    }
}

@Composable
private fun ConnectionIndicator(status: ConnectionStatus) {
    val (color, label) = when (status) {
        ConnectionStatus.Connected -> Color(0xFF4CAF50) to "Connected"
        ConnectionStatus.Reconnecting -> Color(0xFFFFA726) to "Reconnecting…"
        is ConnectionStatus.Revoked -> Color(0xFFEF5350) to "Revoked"
    }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(color.copy(alpha = 0.2f))
            .padding(horizontal = 16.dp, vertical = 6.dp),
    ) {
        Text(label, color = color, fontSize = 14.sp)
    }
}
