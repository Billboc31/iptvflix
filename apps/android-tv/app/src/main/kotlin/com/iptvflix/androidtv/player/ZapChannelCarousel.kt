package com.iptvflix.androidtv.player

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import coil.compose.AsyncImage
import coil.request.CachePolicy
import coil.request.ImageRequest
import com.iptvflix.androidtv.livetv.ChannelResponse
import com.iptvflix.androidtv.ui.TvColors
import kotlinx.coroutines.delay

@Composable
fun ZapChannelCarousel(
    preview: ZapPreviewState,
    onDismissed: () -> Unit,
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(preview.selectedChannel.id) {
        delay(ChannelZapper.PREVIEW_IDLE_MS)
        onDismissed()
    }

    Box(modifier = modifier.fillMaxSize()) {
        // Scrim: video stays visible on the left, panel reads clearly on the right.
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.horizontalGradient(
                        0f to Color.Transparent,
                        0.45f to Color(0x66000000),
                        0.72f to Color(0xCC0A0A12),
                        1f to Color(0xF0101018),
                    ),
                ),
        )

        Row(
            modifier = Modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.End,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxHeight()
                    .width(380.dp)
                    .background(Color(0xF0101018))
                    .padding(start = 20.dp, end = 28.dp, top = 28.dp, bottom = 24.dp),
            ) {
                Text(
                    "Chaînes",
                    color = TvColors.LiveTvAccent,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    "OK pour valider",
                    color = Color(0x88FFFFFF),
                    fontSize = 12.sp,
                )
                Spacer(Modifier.height(20.dp))

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    verticalArrangement = Arrangement.SpaceEvenly,
                ) {
                    preview.window.forEachIndexed { index, channel ->
                        key(channel.id) {
                            ZapCarouselRow(
                                channel = channel,
                                isSelected = index == preview.selectedIndex,
                                isPlaying = channel.id == preview.playingChannelId,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ZapCarouselRow(
    channel: ChannelResponse,
    isSelected: Boolean,
    isPlaying: Boolean,
) {
    val scale = if (isSelected) 1f else 0.82f
    val alpha = if (isSelected) 1f else 0.5f

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .scale(scale)
            .alpha(alpha)
            .clip(RoundedCornerShape(14.dp))
            .background(
                when {
                    isSelected -> TvColors.LiveTvAccent.copy(alpha = 0.14f)
                    isPlaying -> Color(0x22FFFFFF)
                    else -> Color.Transparent
                },
            )
            .border(
                width = when {
                    isSelected -> 2.5.dp
                    isPlaying -> 1.dp
                    else -> 0.dp
                },
                color = when {
                    isSelected -> TvColors.LiveTvAccent
                    isPlaying -> Color(0x55FFFFFF)
                    else -> Color.Transparent
                },
                shape = RoundedCornerShape(14.dp),
            )
            .padding(horizontal = 12.dp, vertical = if (isSelected) 12.dp else 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(if (isSelected) 72.dp else 54.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(
                    Brush.verticalGradient(
                        listOf(Color(0xFF252535), Color(0xFF14141E)),
                    ),
                )
                .border(
                    width = 1.dp,
                    color = if (isSelected) TvColors.LiveTvAccent.copy(alpha = 0.45f) else Color(0x33FFFFFF),
                    shape = RoundedCornerShape(12.dp),
                ),
            contentAlignment = Alignment.Center,
        ) {
            if (!channel.logoUrl.isNullOrBlank()) {
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(channel.logoUrl)
                        .crossfade(false)
                        .memoryCachePolicy(CachePolicy.ENABLED)
                        .diskCachePolicy(CachePolicy.ENABLED)
                        .size(if (isSelected) 128 else 96)
                        .build(),
                    contentDescription = channel.name,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier
                        .size(if (isSelected) 58.dp else 42.dp)
                        .padding(4.dp),
                )
            } else {
                Text(
                    channel.name.take(2).uppercase(),
                    color = if (isSelected) TvColors.LiveTvAccent else Color.White,
                    fontSize = if (isSelected) 20.sp else 15.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                )
            }
        }

        Spacer(Modifier.width(14.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                channel.name,
                color = Color.White,
                fontSize = if (isSelected) 18.sp else 14.sp,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            when {
                isSelected -> {
                    val programTitle = channel.epg?.now?.title
                    if (!programTitle.isNullOrBlank()) {
                        Spacer(Modifier.height(3.dp))
                        Text(
                            programTitle,
                            color = Color(0xB3FFFFFF),
                            fontSize = 12.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "OK pour zapper",
                        color = TvColors.LiveTvAccent,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                isPlaying -> {
                    Spacer(Modifier.height(3.dp))
                    Text(
                        "En cours",
                        color = Color(0x88FFFFFF),
                        fontSize = 11.sp,
                    )
                }
            }
        }
    }
}
