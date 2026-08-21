package com.iptvflix.androidtv.playback

import kotlinx.serialization.Serializable

@Serializable
data class AvailabilityVariant(
    val id: String,
    val status: String? = null,
    val providerId: String? = null,
    val audioLanguage: String? = null,
    val subtitleLanguage: String? = null,
    val videoQuality: String? = null,
    val rawTitle: String? = null,
    val sourceDisplayName: String? = null,
    val codecName: String? = null,
    val hdrFormat: String? = null,
    val releaseHint: String? = null,
    val audioFormat: String? = null,
)

/**
 * Human label for Sources panel.
 * Provider short names like "UNIV" stay as a suffix when richer metadata exists
 * (e.g. "Multi · 1080p · UNIV").
 */
fun AvailabilityVariant.label(
    all: List<AvailabilityVariant> = emptyList(),
    embeddedAudioTrackCount: Int = 0,
): String {
    val blob = listOfNotNull(rawTitle, releaseHint, sourceDisplayName).joinToString(" ")
    val isMulti = audioFormat.equals("MULTI", ignoreCase = true) ||
        audioLanguage.equals("multi", ignoreCase = true) ||
        MULTI_IN_TITLE.containsMatchIn(blob) ||
        embeddedAudioTrackCount > 1

    val parts = mutableListOf<String>()
    when {
        !audioLanguage.isNullOrBlank() && !audioLanguage.equals("multi", ignoreCase = true) -> {
            parts += languageName(audioLanguage)
        }
        isMulti -> parts += "Multi"
        subtitleLanguage.equals("fr", ignoreCase = true) -> parts += "VOSTFR"
    }

    val quality = videoQuality?.takeIf { it.isNotBlank() } ?: inferQuality(blob)
    quality?.let { parts += it }
    hdrFormat?.takeIf { it.isNotBlank() }?.let { parts += it }
    releaseHint
        ?.takeIf { it.isNotBlank() && parts.none { p -> p.equals(it, ignoreCase = true) } }
        ?.let { parts += it }

    val provider = sourceDisplayName?.takeIf { it.isNotBlank() }
        ?: rawTitle?.takeIf { looksLikeProviderCode(it) }

    val base = when {
        parts.isNotEmpty() -> parts.joinToString(" · ")
        !rawTitle.isNullOrBlank() && !looksLikeProviderCode(rawTitle) -> shortenTitle(rawTitle)
        !provider.isNullOrBlank() -> provider
        !rawTitle.isNullOrBlank() -> rawTitle
        else -> "Source"
    }

    var label = if (
        !provider.isNullOrBlank() &&
        !base.contains(provider, ignoreCase = true)
    ) {
        "$base · $provider"
    } else {
        base
    }

    // If two variants collide, force the provider name on.
    if (all.size > 1 && !sourceDisplayName.isNullOrBlank()) {
        val collisions = all.count { other ->
            other.id != id && other.coreLabel() == coreLabel()
        }
        if (collisions > 0 && !label.contains(sourceDisplayName, ignoreCase = true)) {
            label = "$label · $sourceDisplayName"
        }
    }

    return label
}

/** Label without provider suffix — used to detect collisions. */
private fun AvailabilityVariant.coreLabel(): String {
    val blob = listOfNotNull(rawTitle, releaseHint).joinToString(" ")
    val isMulti = audioFormat.equals("MULTI", ignoreCase = true) ||
        audioLanguage.equals("multi", ignoreCase = true) ||
        MULTI_IN_TITLE.containsMatchIn(blob)

    val parts = mutableListOf<String>()
    when {
        !audioLanguage.isNullOrBlank() && !audioLanguage.equals("multi", ignoreCase = true) -> {
            parts += languageName(audioLanguage)
        }
        isMulti -> parts += "Multi"
        subtitleLanguage.equals("fr", ignoreCase = true) -> parts += "VOSTFR"
    }
    (videoQuality?.takeIf { it.isNotBlank() } ?: inferQuality(blob))?.let { parts += it }
    return if (parts.isNotEmpty()) parts.joinToString(" · ") else (rawTitle ?: id)
}

private val MULTI_IN_TITLE = Regex("(?i)\\bmulti\\b|mul\\s*ti")

private fun inferQuality(blob: String): String? = when {
    QUALITY_4K.containsMatchIn(blob) -> "4K"
    QUALITY_1080.containsMatchIn(blob) -> "1080p"
    QUALITY_720.containsMatchIn(blob) -> "720p"
    QUALITY_480.containsMatchIn(blob) -> "480p"
    else -> null
}

private val QUALITY_4K = Regex("(?i)\\b(4k|uhd|2160p?)\\b")
private val QUALITY_1080 = Regex("(?i)\\b(1080p?|fhd)\\b")
private val QUALITY_720 = Regex("(?i)\\b(720p?|hd)\\b")
private val QUALITY_480 = Regex("(?i)\\b(480p?|sd)\\b")

/** Short IPTV bouquet codes like UNIV — not a movie title. */
private fun looksLikeProviderCode(value: String): Boolean {
    val t = value.trim()
    if (t.length !in 2..12) return false
    if (t.contains(' ')) return false
    return t.all { it.isLetterOrDigit() || it == '-' || it == '_' }
}

private fun shortenTitle(title: String): String {
    val cleaned = title
        .replace(Regex("(?i)\\b(4k|uhd|2160p?|1080p?|720p?|multi|mul\\s*ti)\\b"), " ")
        .replace(Regex("\\s+"), " ")
        .trim()
        .trim('-', '|', '·', ' ')
    return cleaned.takeIf { it.length >= 3 } ?: title
}

private fun languageName(code: String): String = when (code.lowercase()) {
    "fr", "fra", "fre" -> "FR"
    "en", "eng" -> "EN"
    "es", "spa" -> "ES"
    "de", "ger", "deu" -> "DE"
    "it", "ita" -> "IT"
    "pt", "por" -> "PT"
    "ja", "jpn" -> "JA"
    "ko", "kor" -> "KO"
    "zh", "chi", "zho" -> "ZH"
    "multi" -> "Multi"
    else -> code.uppercase()
}
