package com.iptvflix.androidtv.ui

import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.ExperimentalTvMaterial3Api
import androidx.tv.material3.Surface
import androidx.tv.material3.Text

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
fun TvPrimaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    requestInitialFocus: Boolean = false,
    enabled: Boolean = true,
) {
    val focusRequester = remember { FocusRequester() }
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()

    LaunchedEffect(requestInitialFocus, enabled) {
        if (requestInitialFocus && enabled) {
            runCatching { focusRequester.requestFocus() }
        }
    }

    // TV Surface handles D-pad; mouse/touch on emulator needs an explicit pointer handler.
    val mouseClickable = if (enabled) {
        Modifier.pointerInput(onClick) {
            detectTapGestures(onTap = { onClick() })
        }
    } else {
        Modifier
    }

    Surface(
        onClick = onClick,
        enabled = enabled,
        interactionSource = interactionSource,
        modifier = modifier
            .focusRequester(focusRequester)
            .then(mouseClickable),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.08f),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (focused) TvColors.Accent else TvColors.Surface,
            focusedContainerColor = TvColors.Accent,
            pressedContainerColor = TvColors.Accent,
        ),
    ) {
        Text(
            label,
            color = if (focused) Color.White else TvColors.TextSecondary,
            fontSize = 18.sp,
            fontWeight = if (focused) FontWeight.Bold else FontWeight.Normal,
            modifier = Modifier.padding(horizontal = 32.dp, vertical = 14.dp),
        )
    }
}
