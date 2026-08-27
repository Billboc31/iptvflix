package com.iptvflix.androidtv.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.tv.material3.ExperimentalTvMaterial3Api
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.darkColorScheme

object TvColors {
    val Background = Color(0xFF0A0A12)
    val Surface = Color(0xFF161622)
    val SurfaceFocused = Color(0xFF252538)
    val Accent = Color(0xFFE50914)
    val LiveTvAccent = Color(0xFFFF8C00)
    val TextPrimary = Color(0xFFF5F5F5)
    val TextSecondary = Color(0xFFAAAAAA)
    val TextMuted = Color(0xFF777777)
    val Success = Color(0xFF4CAF50)
    val Warning = Color(0xFFFFA726)
    val Error = Color(0xFFEF5350)
}

@OptIn(ExperimentalTvMaterial3Api::class)
private val TvDarkColors = darkColorScheme(
    primary = TvColors.Accent,
    onPrimary = Color.White,
    background = TvColors.Background,
    onBackground = TvColors.TextPrimary,
    surface = TvColors.Surface,
    onSurface = TvColors.TextPrimary,
)

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
fun IptvFlixTvTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) TvDarkColors else TvDarkColors,
        content = content,
    )
}
