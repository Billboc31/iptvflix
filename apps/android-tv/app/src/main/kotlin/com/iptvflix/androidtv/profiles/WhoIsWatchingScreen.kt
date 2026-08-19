package com.iptvflix.androidtv.profiles

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.tv.foundation.lazy.list.TvLazyRow
import androidx.tv.foundation.lazy.list.items
import androidx.tv.foundation.lazy.list.rememberTvLazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.viewmodel.compose.viewModel
import android.app.Activity
import androidx.compose.ui.platform.LocalContext
import androidx.tv.material3.Button
import androidx.tv.material3.Text

@Composable
fun WhoIsWatchingScreen(
    lastUsedProfileId: String?,
    onProfileSelected: () -> Unit,
    vm: ProfileViewModel = viewModel(),
) {
    val state by vm.uiState.collectAsState()
    var showQuitDialog by remember { mutableStateOf(false) }
    val activity = LocalContext.current as? Activity

    BackHandler {
        showQuitDialog = true
    }

    if (showQuitDialog) {
        QuitDialog(
            onDismiss = { showQuitDialog = false },
            onConfirm = { activity?.finishAffinity() },
        )
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
            Text(
                text = "Qui regarde ?",
                color = Color.White,
                fontSize = 40.sp,
                fontWeight = FontWeight.Bold,
            )

            Spacer(Modifier.height(40.dp))

            if (state.error != null) {
                Text(
                    state.error!!,
                    color = Color(0xFFEF5350),
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(16.dp))
                RetryButton(onClick = { vm.clearError(); vm.loadProfiles() })
                Spacer(Modifier.height(24.dp))
            }

            when {
                state.loading -> Text("Chargement…", color = Color(0xFFAAAAAA), fontSize = 20.sp)
                state.selectingProfileId != null -> Text("Connexion…", color = Color(0xFFAAAAAA), fontSize = 20.sp)
                state.profiles.isEmpty() -> Text("Aucun profil disponible.", color = Color(0xFFAAAAAA), fontSize = 18.sp)
                else -> {
                    val listState = rememberTvLazyListState()
                    val initialIndex = state.profiles.indexOfFirst { it.id == lastUsedProfileId }
                        .takeIf { it >= 0 } ?: 0

                    LaunchedEffect(state.profiles) {
                        if (state.profiles.isNotEmpty() && initialIndex > 0) {
                            listState.scrollToItem(initialIndex)
                        }
                    }

                    TvLazyRow(
                        state = listState,
                        contentPadding = PaddingValues(horizontal = 32.dp),
                        horizontalArrangement = Arrangement.spacedBy(24.dp),
                    ) {
                        items(state.profiles, key = { it.id }) { profile ->
                            ProfileCard(
                                profile = profile,
                                isInitialFocus = profile.id == (lastUsedProfileId ?: state.profiles.firstOrNull()?.id),
                                enabled = state.selectingProfileId == null,
                                onClick = {
                                    vm.selectProfile(profile.id) { onProfileSelected() }
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RetryButton(onClick: () -> Unit) {
    Button(onClick = onClick) {
        Text("Réessayer", color = Color.White)
    }
}

@Composable
private fun QuitDialog(onDismiss: () -> Unit, onConfirm: () -> Unit) {
    Dialog(onDismissRequest = onDismiss) {
        Box(
            modifier = Modifier
                .background(Color(0xFF1A1A2E))
                .padding(32.dp),
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    "Quitter l'application ?",
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(24.dp))
                androidx.compose.foundation.layout.Row(
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Button(onClick = onDismiss) {
                        Text("Annuler", color = Color.White)
                    }
                    Button(onClick = onConfirm) {
                        Text("Quitter", color = Color.White)
                    }
                }
            }
        }
    }
}
