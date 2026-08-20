package com.iptvflix.androidtv.profiles

import androidx.compose.foundation.Image
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.ExperimentalTvMaterial3Api
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.iptvflix.androidtv.network.ProfileResponse
import com.iptvflix.androidtv.util.getAvatarRes

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
fun ProfileCard(
    profile: ProfileResponse,
    isInitialFocus: Boolean = false,
    enabled: Boolean = true,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val focusRequester = remember { FocusRequester() }
    val interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()

    LaunchedEffect(isInitialFocus) {
        if (isInitialFocus) {
            runCatching { focusRequester.requestFocus() }
        }
    }

    val label = if (profile.isKids) "${profile.name} — Profil enfant" else profile.name

    Surface(
        onClick = onClick,
        enabled = enabled,
        interactionSource = interactionSource,
        modifier = modifier
            .focusRequester(focusRequester)
            .semantics { contentDescription = label },
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.15f),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = Color.Transparent,
            focusedContainerColor = Color.Transparent,
        ),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(8.dp),
        ) {
            Box(contentAlignment = Alignment.Center) {
                Image(
                    painter = painterResource(id = getAvatarRes(profile.avatarKey)),
                    contentDescription = null,
                    modifier = Modifier
                        .size(96.dp)
                        .clip(CircleShape)
                        .then(
                            if (focused) Modifier.border(3.dp, Color(0xFFE50914), CircleShape)
                            else Modifier
                        ),
                )
            }
            Spacer(Modifier.height(10.dp))
            Text(
                text = profile.name,
                color = if (focused) Color.White else Color(0xFFCCCCCC),
                fontSize = 20.sp,
            )
            if (profile.isKids) {
                Text(text = "Enfants", color = Color(0xFF4FC3F7), fontSize = 14.sp)
            }
        }
    }
}
