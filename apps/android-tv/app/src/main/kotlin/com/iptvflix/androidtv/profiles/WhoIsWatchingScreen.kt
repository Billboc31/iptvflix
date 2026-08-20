package com.iptvflix.androidtv.profiles

import android.app.Activity
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
fun WhoIsWatchingScreen(
    lastUsedProfileId: String?,
    onProfileSelected: () -> Unit,
    vm: ProfileViewModel = viewModel(),
) {
    val state by vm.uiState.collectAsState()
    var showQuitDialog by remember { mutableStateOf(false) }
    val activity = LocalContext.current as? Activity

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
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(32.dp),
        ) {
            Text(
                text = "Qui regarde ?",
                color = TvColors.TextPrimary,
                fontSize = 44.sp,
                fontWeight = FontWeight.Bold,
            )

            Spacer(Modifier.height(12.dp))

            Text(
                text = "Sélectionnez un profil avec la télécommande",
                color = TvColors.TextMuted,
                fontSize = 18.sp,
            )

            Spacer(Modifier.height(48.dp))

            when {
                state.error != null -> {
                    Text(
                        state.error!!,
                        color = TvColors.Error,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(24.dp))
                    TvPrimaryButton(
                        label = "Réessayer",
                        onClick = { vm.clearError(); vm.loadProfiles() },
                        requestInitialFocus = true,
                    )
                }
                state.loading -> {
                    Text("Chargement des profils…", color = TvColors.TextSecondary, fontSize = 20.sp)
                }
                state.selectingProfileId != null -> {
                    Text("Connexion au profil…", color = TvColors.TextSecondary, fontSize = 20.sp)
                }
                state.profiles.isEmpty() -> {
                    Text("Aucun profil disponible.", color = TvColors.TextSecondary, fontSize = 18.sp)
                    Spacer(Modifier.height(24.dp))
                    TvPrimaryButton(
                        label = "Réessayer",
                        onClick = { vm.loadProfiles() },
                        requestInitialFocus = true,
                    )
                }
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
                        horizontalArrangement = Arrangement.spacedBy(32.dp),
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
