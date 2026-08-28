package com.iptvflix.androidtv.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import com.iptvflix.androidtv.R

/** Remap the red F mark to [accent] using the red channel as a luminance mask (keeps black). */
private fun accentMarkColorFilter(accent: Color): ColorFilter {
    val r = accent.red
    val g = accent.green
    val b = accent.blue
    return ColorFilter.colorMatrix(
        ColorMatrix(
            floatArrayOf(
                r, 0f, 0f, 0f, 0f,
                g, 0f, 0f, 0f, 0f,
                b, 0f, 0f, 0f, 0f,
                0f, 0f, 0f, 1f, 0f,
            ),
        ),
    )
}

@Composable
fun IptvFlixMark(
    modifier: Modifier = Modifier,
    size: Dp = 72.dp,
    /** Brand accent for the F mark — red on VOD, orange on Live TV. */
    accent: Color = TvColors.Accent,
) {
    Image(
        painter = painterResource(id = R.drawable.iptvflix_logo_mark),
        contentDescription = "IPTVFlix",
        modifier = modifier.size(size),
        colorFilter = if (accent == TvColors.Accent) null else accentMarkColorFilter(accent),
    )
}

@Composable
fun IptvFlixWordmark(
    modifier: Modifier = Modifier,
    markSize: Dp = 36.dp,
    textSize: TextUnit = 28.sp,
    showMark: Boolean = true,
    accent: Color = TvColors.Accent,
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Start,
    ) {
        if (showMark) {
            IptvFlixMark(size = markSize, accent = accent)
            Spacer(modifier = Modifier.width(12.dp))
        }
        Column {
            Text(
                "IPTVFlix",
                color = TvColors.TextPrimary,
                fontSize = textSize,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}
