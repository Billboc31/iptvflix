package com.iptvflix.androidtv.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Border
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.iptvflix.androidtv.home.ConnectionStatus
import com.iptvflix.androidtv.util.getAvatarRes

enum class AppHomeMode { Vod, LiveTv }

/**
 * Shared top chrome for VOD and Live TV: wordmark, status, connection,
 * profile switcher, and VOD/TV mode toggle.
 */
@Composable
fun AppHomeChrome(
    mode: AppHomeMode,
    deviceName: String,
    statusLabel: String,
    connectionStatus: ConnectionStatus,
    profileName: String?,
    profileAvatarKey: String?,
    onChangeProfile: () -> Unit,
    onSelectVod: () -> Unit,
    onSelectLiveTv: () -> Unit,
    requestProfileFocus: Boolean = false,
    modifier: Modifier = Modifier,
) {
    val accent = when (mode) {
        AppHomeMode.Vod -> TvColors.Accent
        AppHomeMode.LiveTv -> TvColors.LiveTvAccent
    }

    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 48.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                IptvFlixWordmark(
                    markSize = 44.dp,
                    textSize = 22.sp,
                    accent = accent,
                )
                Spacer(Modifier.height(2.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text(
                        deviceName,
                        color = TvColors.TextMuted,
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text("·", color = TvColors.TextMuted, fontSize = 12.sp)
                    Text(
                        statusLabel,
                        color = TvColors.TextMuted,
                        fontSize = 12.sp,
                    )
                }
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                ConnectionBadge(connectionStatus)
                ProfileAvatarButton(
                    name = profileName,
                    avatarKey = profileAvatarKey,
                    accent = accent,
                    onClick = onChangeProfile,
                    requestInitialFocus = requestProfileFocus,
                )
            }
        }

        Spacer(Modifier.height(10.dp))
        ModeToggleBar(
            mode = mode,
            onSelectVod = onSelectVod,
            onSelectLiveTv = onSelectLiveTv,
        )
    }
}

@Composable
fun ModeToggleBar(
    mode: AppHomeMode,
    onSelectVod: () -> Unit,
    onSelectLiveTv: () -> Unit,
) {
    Row(
        modifier = Modifier.padding(horizontal = 48.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        ModeToggleButton(
            label = "VOD",
            accent = TvColors.Accent,
            selected = mode == AppHomeMode.Vod,
            onClick = onSelectVod,
        )
        ModeToggleButton(
            label = "TV",
            accent = TvColors.LiveTvAccent,
            selected = mode == AppHomeMode.LiveTv,
            onClick = onSelectLiveTv,
        )
    }
}

@Composable
private fun ModeToggleButton(
    label: String,
    accent: Color,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()

    Surface(
        onClick = onClick,
        interactionSource = interactionSource,
        modifier = Modifier.pointerInput(onClick) { detectTapGestures(onTap = { onClick() }) },
        shape = ClickableSurfaceDefaults.shape(shape = RoundedCornerShape(20.dp)),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (selected) accent.copy(alpha = 0.2f) else TvColors.Surface,
            focusedContainerColor = accent.copy(alpha = 0.3f),
            pressedContainerColor = accent.copy(alpha = 0.3f),
        ),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.06f),
        border = ClickableSurfaceDefaults.border(
            border = Border(
                border = BorderStroke(
                    width = if (selected) 2.dp else 1.dp,
                    color = if (selected) accent else Color(0xFF333333),
                ),
                shape = RoundedCornerShape(20.dp),
            ),
            focusedBorder = Border(
                border = BorderStroke(2.dp, accent),
                shape = RoundedCornerShape(20.dp),
            ),
        ),
    ) {
        Text(
            label,
            color = if (selected || focused) accent else TvColors.TextMuted,
            fontSize = 15.sp,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
            modifier = Modifier.padding(horizontal = 22.dp, vertical = 8.dp),
        )
    }
}

@Composable
private fun ProfileAvatarButton(
    name: String?,
    avatarKey: String?,
    accent: Color,
    onClick: () -> Unit,
    requestInitialFocus: Boolean = false,
) {
    val focusRequester = remember { FocusRequester() }
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    val label = name?.takeIf { it.isNotBlank() } ?: "Profil"

    LaunchedEffect(requestInitialFocus) {
        if (requestInitialFocus) runCatching { focusRequester.requestFocus() }
    }

    Surface(
        onClick = onClick,
        interactionSource = interactionSource,
        modifier = Modifier
            .focusRequester(focusRequester)
            .semantics { contentDescription = "Changer de profil — $label" }
            .pointerInput(onClick) { detectTapGestures(onTap = { onClick() }) },
        shape = ClickableSurfaceDefaults.shape(shape = CircleShape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = Color.Transparent,
            focusedContainerColor = Color.Transparent,
            pressedContainerColor = Color.Transparent,
            contentColor = TvColors.TextPrimary,
            focusedContentColor = TvColors.TextPrimary,
        ),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.08f),
        border = ClickableSurfaceDefaults.border(
            border = Border(
                border = BorderStroke(0.dp, Color.Transparent),
                shape = CircleShape,
            ),
            focusedBorder = Border(
                border = BorderStroke(3.dp, Color.White),
                shape = CircleShape,
            ),
        ),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 4.dp),
        ) {
            Image(
                painter = painterResource(id = getAvatarRes(avatarKey)),
                contentDescription = null,
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .then(
                        if (focused) Modifier.border(2.dp, accent, CircleShape)
                        else Modifier.border(1.dp, Color(0x44FFFFFF), CircleShape),
                    ),
            )
            Spacer(Modifier.width(8.dp))
            Column {
                Text(
                    label,
                    color = if (focused) Color.White else TvColors.TextPrimary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    "Changer",
                    color = if (focused) Color(0xFFEEEEEE) else TvColors.TextMuted,
                    fontSize = 11.sp,
                    maxLines = 1,
                )
            }
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
            .padding(horizontal = 16.dp, vertical = 6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .width(8.dp)
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(color),
            )
            Spacer(Modifier.width(8.dp))
            Text(label, color = color, fontSize = 13.sp, fontWeight = FontWeight.Medium)
        }
    }
}
