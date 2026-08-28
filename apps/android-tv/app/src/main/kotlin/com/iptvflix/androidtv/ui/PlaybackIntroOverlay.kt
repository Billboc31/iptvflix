package com.iptvflix.androidtv.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Soft, almost-linear curve — motion stays readable instead of rushing. */
private val SoftMotion = CubicBezierEasing(0.35f, 0.00f, 0.25f, 1.00f)

/**
 * Ribbons unroll around the centered wordmark, then the word slides to
 * bottom-center while ribbons coil into the brand mark.
 */
@Composable
fun PlaybackIntroOverlay(
    title: String? = null,
    onFinished: () -> Unit,
) {
    val textAlpha = remember { Animatable(0f) }
    val textScale = remember { Animatable(1.06f) }
    // 0 = middle of the 4 ribbons, 1 = bottom-center under the logo
    val textPos = remember { Animatable(0f) }

    val unroll = remember { Animatable(0f) }
    val coil = remember { Animatable(0f) }

    val titleAlpha = remember { Animatable(0f) }
    val doorProgress = remember { Animatable(0f) }
    val veilAlpha = remember { Animatable(1f) }
    val centerFade = remember { Animatable(1f) }

    val density = LocalDensity.current

    LaunchedEffect(Unit) {
        // 1) Word — sits in the pocket where the 4 ribbons will meet
        launch { textAlpha.animateTo(1f, tween(560, easing = SoftMotion)) }
        textScale.animateTo(1f, tween(640, easing = SoftMotion))
        delay(500)

        // 2) Unroll around the word
        unroll.animateTo(1f, tween(2200, easing = SoftMotion))
        delay(280)

        // 3) Word slides to bottom-center while ribbons coil into the mark
        launch {
            textPos.animateTo(1f, tween(1300, easing = SoftMotion))
            textScale.animateTo(0.78f, tween(700, easing = SoftMotion))
        }
        coil.animateTo(1f, tween(2400, easing = SoftMotion))

        if (!title.isNullOrBlank()) {
            titleAlpha.animateTo(1f, tween(360, easing = SoftMotion))
        }
        delay(700)

        // 4) Doors
        launch { doorProgress.animateTo(1f, tween(1100, easing = SoftMotion)) }
        launch {
            delay(280)
            centerFade.animateTo(0f, tween(560, easing = LinearEasing))
            titleAlpha.animateTo(0f, tween(400, easing = LinearEasing))
        }
        veilAlpha.animateTo(0f, tween(1200, delayMillis = 240, easing = LinearEasing))
        delay(60)
        onFinished()
    }

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .alpha(veilAlpha.value.coerceIn(0f, 1f)),
    ) {
        val screenW = constraints.maxWidth.toFloat()
        val screenH = constraints.maxHeight.toFloat()
        val doorOffset = screenW * 0.55f * doorProgress.value

        // Ribbon cluster center ≈ 48% height; final rest ≈ 78% (bottom-center).
        val startY = screenH * 0.48f
        val endY = screenH * 0.78f
        val textYPx = startY + (endY - startY) * textPos.value.coerceIn(0f, 1f)

        Box(
            modifier = Modifier
                .align(Alignment.CenterStart)
                .fillMaxHeight()
                .fillMaxWidth(0.52f)
                .offset(x = with(density) { (-doorOffset).toDp() })
                .background(Color(0xFF050508)),
        )
        Box(
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .fillMaxHeight()
                .fillMaxWidth(0.52f)
                .offset(x = with(density) { doorOffset.toDp() })
                .background(Color(0xFF050508)),
        )

        FilmRibbonStage(
            unroll = unroll.value,
            coil = coil.value,
            modifier = Modifier
                .fillMaxSize()
                .alpha(centerFade.value.coerceIn(0f, 1f)),
        )

        Box(
            modifier = Modifier
                .fillMaxSize()
                .alpha(centerFade.value)
                .padding(horizontal = 48.dp),
        ) {
            Text(
                "IPTVFlix",
                color = Color.White,
                fontSize = 36.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .offset(y = with(density) { textYPx.toDp() - 22.dp })
                    .alpha(textAlpha.value.coerceIn(0f, 1f))
                    .scale(textScale.value),
            )

            if (!title.isNullOrBlank()) {
                Text(
                    title,
                    color = Color(0xFFCCCCCC),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .offset(y = with(density) { textYPx.toDp() + 22.dp })
                        .alpha(titleAlpha.value.coerceIn(0f, 1f)),
                )
            }
        }
    }
}
