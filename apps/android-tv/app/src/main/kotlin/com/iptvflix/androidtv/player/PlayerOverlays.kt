package com.iptvflix.androidtv.player

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.Text

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
            .padding(end = 56.dp, bottom = 120.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        actions.forEach { action ->
            val label = when (action) {
                is PlayerOverlayAction.SkipIntro -> action.label
                is PlayerOverlayAction.SkipRecap -> action.label
                is PlayerOverlayAction.NextEpisode -> action.label
                is PlayerOverlayAction.Custom -> action.label
            }
            SkipStyleButton(
                label = label,
                onClick = { onAction(action) },
            )
        }
    }
}

@Composable
private fun SkipStyleButton(
    label: String,
    onClick: () -> Unit,
) {
    Surface(
        onClick = onClick,
        modifier = Modifier.pointerInput(onClick) {
            detectTapGestures(onTap = { onClick() })
        },
        shape = ClickableSurfaceDefaults.shape(shape = RoundedCornerShape(2.dp)),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = Color(0x66000000),
            focusedContainerColor = Color.White,
            pressedContainerColor = Color(0xFFEEEEEE),
            contentColor = Color.White,
            focusedContentColor = Color.Black,
        ),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.05f),
        border = ClickableSurfaceDefaults.border(
            border = Border(border = BorderStroke(2.dp, Color.White), shape = RoundedCornerShape(2.dp)),
            focusedBorder = Border(border = BorderStroke(2.dp, Color.White), shape = RoundedCornerShape(2.dp)),
        ),
    ) {
        Text(
            text = label.uppercase(),
            modifier = Modifier.padding(horizontal = 22.dp, vertical = 12.dp),
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.8.sp,
        )
    }
}

/**
 * Z-order for the player surface:
 * 1. Video (TextureView / ExoPlayer)
 * 2. Dim / status overlays (buffering, error)
 * 3. Action overlays (skip intro, …) — focusable TV buttons
 * 4. Chrome HUD (progress / hints)
 */
@Composable
fun PlayerOverlayStack(
    video: @Composable () -> Unit,
    statusContent: @Composable BoxScope.() -> Unit,
    actionContent: @Composable BoxScope.() -> Unit,
    chromeContent: @Composable BoxScope.() -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize()) {
        video()
        Box(modifier = Modifier.fillMaxSize(), content = statusContent)
        Box(modifier = Modifier.fillMaxSize(), content = actionContent)
        Box(modifier = Modifier.fillMaxSize(), content = chromeContent)
    }
}
