package com.iptvflix.androidtv.player

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.iptvflix.androidtv.livetv.ChannelResponse
import com.iptvflix.androidtv.ui.TvColors
import kotlinx.coroutines.delay

private const val HUD_AUTO_DISMISS_MS = 3_000L

@Composable
fun ZapChannelHud(
    channel: ChannelResponse,
    onDismissed: () -> Unit,
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(channel.id) {
        delay(HUD_AUTO_DISMISS_MS)
        onDismissed()
    }

    Row(
        modifier = modifier
            .widthIn(min = 220.dp, max = 360.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xCC101010))
            .border(2.dp, TvColors.LiveTvAccent, RoundedCornerShape(8.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (!channel.logoUrl.isNullOrBlank()) {
            AsyncImage(
                model = ImageRequest.Builder(LocalContext.current)
                    .data(channel.logoUrl)
                    .crossfade(true)
                    .build(),
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(4.dp)),
            )
            Spacer(Modifier.width(12.dp))
        }
        Column {
            Text(
                text = channel.name,
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            val programTitle = channel.epg?.now?.title
            if (!programTitle.isNullOrBlank()) {
                Text(
                    text = programTitle,
                    color = Color(0xB3FFFFFF),
                    fontSize = 13.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}
