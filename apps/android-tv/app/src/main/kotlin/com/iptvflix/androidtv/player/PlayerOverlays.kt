package com.iptvflix.androidtv.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.iptvflix.androidtv.ui.TvPrimaryButton

/**
 * Action overlays drawn above the video (below or beside the chrome HUD).
 * Designed for future cues: skip intro, next episode, watch credits, etc.
 */
sealed class PlayerOverlayAction {
    abstract val id: String

    data class SkipIntro(
        override val id: String = "skip_intro",
        val label: String = "Passer l'intro",
        /** Exclusive end of the intro window (ms). Hidden once playback passes this. */
        val untilMs: Long,
        val seekToMs: Long,
    ) : PlayerOverlayAction()

    data class SkipRecap(
        override val id: String = "skip_recap",
        val label: String = "Passer le résumé",
        val untilMs: Long,
        val seekToMs: Long,
    ) : PlayerOverlayAction()

    data class NextEpisode(
        override val id: String = "next_episode",
        val label: String = "Épisode suivant",
    ) : PlayerOverlayAction()

    data class Custom(
        override val id: String,
        val label: String,
    ) : PlayerOverlayAction()
}

fun List<PlayerOverlayAction>.visibleAt(positionMs: Long): List<PlayerOverlayAction> =
    filter { action ->
        when (action) {
            is PlayerOverlayAction.SkipIntro -> positionMs in 0L until action.untilMs
            is PlayerOverlayAction.SkipRecap -> positionMs in 0L until action.untilMs
            is PlayerOverlayAction.NextEpisode,
            is PlayerOverlayAction.Custom,
            -> true
        }
    }

@Composable
fun BoxScope.PlayerActionOverlays(
    actions: List<PlayerOverlayAction>,
    onAction: (PlayerOverlayAction) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (actions.isEmpty()) return

    Row(
        modifier = modifier
            .align(Alignment.BottomEnd)
            .padding(end = 48.dp, bottom = 180.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        actions.forEach { action ->
            val label = when (action) {
                is PlayerOverlayAction.SkipIntro -> action.label
                is PlayerOverlayAction.SkipRecap -> action.label
                is PlayerOverlayAction.NextEpisode -> action.label
                is PlayerOverlayAction.Custom -> action.label
            }
            TvPrimaryButton(
                label = label,
                onClick = { onAction(action) },
                requestInitialFocus = action is PlayerOverlayAction.SkipIntro || action is PlayerOverlayAction.SkipRecap,
            )
        }
    }
}

/**
 * Z-order for the player surface:
 * 1. Video (TextureView / ExoPlayer)
 * 2. Dim / status overlays (buffering, error)
 * 3. [content] Action overlays (skip intro, …) — focusable TV buttons
 * 4. Chrome HUD (progress / hints)
 */
@Composable
fun PlayerOverlayStack(
    video: @Composable () -> Unit,
    status: @Composable BoxScope.() -> Unit,
    actions: @Composable BoxScope.() -> Unit,
    chrome: @Composable BoxScope.() -> Unit,
) {
    Box(Modifier = Modifier.fillMaxSize()) {
        video()
        status()
        actions()
        chrome()
    }
}
