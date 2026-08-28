package com.iptvflix.androidtv.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.Text

@Composable
fun TvConfirmOverlay(
    title: String,
    confirmLabel: String,
    cancelLabel: String = "Annuler",
    /** When true, focus lands on Confirm (destructive / primary action). */
    focusConfirm: Boolean = false,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    val cancelFocus = remember { FocusRequester() }
    val confirmFocus = remember { FocusRequester() }
    val shape = RoundedCornerShape(14.dp)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xCC0A0A12)),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .widthIn(max = 420.dp)
                .background(TvColors.Surface, shape)
                .padding(horizontal = 28.dp, vertical = 22.dp),
        ) {
            Text(
                title,
                color = TvColors.TextPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(18.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                ConfirmActionChip(
                    label = cancelLabel,
                    accent = TvColors.TextMuted,
                    selectedLook = false,
                    onClick = onDismiss,
                    modifier = Modifier.focusRequester(cancelFocus),
                )
                ConfirmActionChip(
                    label = confirmLabel,
                    accent = TvColors.Accent,
                    selectedLook = true,
                    onClick = onConfirm,
                    modifier = Modifier.focusRequester(confirmFocus),
                )
            }
        }
    }

    LaunchedEffect(focusConfirm) {
        runCatching {
            if (focusConfirm) confirmFocus.requestFocus() else cancelFocus.requestFocus()
        }
    }
}

@Composable
private fun ConfirmActionChip(
    label: String,
    accent: Color,
    selectedLook: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    val shape = RoundedCornerShape(20.dp)

    Surface(
        onClick = onClick,
        interactionSource = interactionSource,
        modifier = modifier.pointerInput(onClick) { detectTapGestures(onTap = { onClick() }) },
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (selectedLook) accent.copy(alpha = 0.22f) else TvColors.Background,
            focusedContainerColor = accent.copy(alpha = 0.38f),
            pressedContainerColor = accent.copy(alpha = 0.45f),
            contentColor = TvColors.TextPrimary,
            focusedContentColor = Color.White,
        ),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.06f),
        border = ClickableSurfaceDefaults.border(
            border = Border(
                border = BorderStroke(
                    width = if (selectedLook) 2.dp else 1.dp,
                    color = if (selectedLook) accent else Color(0xFF333344),
                ),
                shape = shape,
            ),
            focusedBorder = Border(
                border = BorderStroke(2.dp, accent),
                shape = shape,
            ),
        ),
    ) {
        Text(
            label,
            color = when {
                focused -> Color.White
                selectedLook -> accent
                else -> TvColors.TextSecondary
            },
            fontSize = 15.sp,
            fontWeight = if (selectedLook || focused) FontWeight.SemiBold else FontWeight.Normal,
            modifier = Modifier.padding(horizontal = 22.dp, vertical = 10.dp),
        )
    }
}
