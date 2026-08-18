package com.iptvflix.androidtv.profiles

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import com.iptvflix.androidtv.network.ProfileResponse
import com.iptvflix.androidtv.util.getAvatarRes

@Composable
fun ProfileCard(
    profile: ProfileResponse,
    isInitialFocus: Boolean = false,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var focused by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(if (focused) 1.15f else 1f, label = "card-scale")

    val label = if (profile.isKids) "${profile.name} — Profil enfant" else profile.name

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier
            .scale(scale)
            .semantics { contentDescription = label }
            .onFocusChanged { focused = it.isFocused }
            .focusable(true)
            .onKeyEvent { event ->
                if (event.key == Key.Enter || event.key == Key.DirectionCenter) {
                    onClick()
                    true
                } else false
            }
            .padding(8.dp),
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
            Text(text = "Kids", color = Color(0xFF4FC3F7), fontSize = 14.sp)
        }
    }
}
