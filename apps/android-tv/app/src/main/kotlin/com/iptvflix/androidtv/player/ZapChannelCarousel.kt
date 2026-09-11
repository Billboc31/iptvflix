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
import com.iptvflix.androidtv.livetv.formatEpgRange
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
                    .width(420.dp)
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
                Spacer(Modifier.height(16.dp))

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    verticalArrangement = Arrangement.SpaceEvenly,
                ) {
                    preview.window.forEachIndexed { index, channel ->
                        // Index in key avoids Compose collisions if a duplicate id ever slips in.
                        key("$index-${channel.id}") {
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
    val alpha = if (isSelected) 1f else 0.55f
    val logoSize = if (isSelected) 72.dp else 54.dp
    val innerLogoSize = if (isSelected) 58.dp else 42.dp

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
            .padding(horizontal = 12.dp, vertical = if (isSelected) 10.dp else 6.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier = Modifier
                .size(logoSize)
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
                        .size(innerLogoSize)
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

        Spacer(Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    channel.name,
                    color = Color.White,
                    fontSize = if (isSelected) 17.sp else 13.sp,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                if (isPlaying) {
                    Spacer(Modifier.width(6.dp))
                    Text(
                        "▶",
                        color = if (isSelected) TvColors.LiveTvAccent else Color(0x88FFFFFF),
                        fontSize = 10.sp,
                    )
                }
            }

            ZapCarouselEpg(
                channel = channel,
                isSelected = isSelected,
            )

            if (isSelected) {
                Spacer(Modifier.height(4.dp))
                Text(
                    "OK pour zapper",
                    color = TvColors.LiveTvAccent,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

@Composable
private fun ZapCarouselEpg(
    channel: ChannelResponse,
    isSelected: Boolean,
) {
    val now = channel.epg?.now
    val next = channel.epg?.next
    if (now == null && next == null) return

    val nowTitleSize = if (isSelected) 12.sp else 10.sp
    val nowMetaSize = if (isSelected) 10.sp else 9.sp
    val nextTitleSize = if (isSelected) 11.sp else 9.sp
    val nextMetaSize = if (isSelected) 9.sp else 8.sp
    val nowTitleColor = if (isSelected) Color(0xEEFFFFFF) else Color(0xAAFFFFFF)
    val nowMetaColor = if (isSelected) Color(0x99FFFFFF) else Color(0x66FFFFFF)
    val nextTitleColor = if (isSelected) Color(0xCCFFFFFF) else Color(0x77FFFFFF)
    val nextMetaColor = if (isSelected) Color(0x77FFFFFF) else Color(0x55FFFFFF)
    val labelColor = if (isSelected) TvColors.LiveTvAccent else Color(0x66FFFFFF)

    if (now != null) {
        Spacer(Modifier.height(3.dp))
        if (isSelected) {
            Text(
                "Maintenant",
                color = labelColor,
                fontSize = 9.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.height(1.dp))
        }
        Text(
            now.title,
            color = nowTitleColor,
            fontSize = nowTitleSize,
            fontWeight = if (isSelected) FontWeight.Medium else FontWeight.Normal,
            maxLines = if (isSelected) 2 else 1,
            overflow = TextOverflow.Ellipsis,
            lineHeight = if (isSelected) 14.sp else 12.sp,
        )
        Text(
            formatEpgRange(now.startTime, now.endTime),
            color = nowMetaColor,
            fontSize = nowMetaSize,
        )
    }

    if (next != null) {
        Spacer(Modifier.height(if (isSelected) 5.dp else 3.dp))
        if (isSelected) {
            Text(
                "Ensuite",
                color = labelColor,
                fontSize = 9.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.height(1.dp))
        }
        Text(
            text = if (isSelected) next.title else "→ ${next.title}",
            color = nextTitleColor,
            fontSize = nextTitleSize,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            formatEpgRange(next.startTime, next.endTime),
            color = nextMetaColor,
            fontSize = nextMetaSize,
        )
    }
}
