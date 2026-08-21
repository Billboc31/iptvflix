package com.iptvflix.androidtv.playback

/**
 * Some Xtream panels return HTTP 551 for one container extension (.mkv) while
 * .mp4 / .ts / .m3u8 of the same stream id still work. Try the next shape.
 */
object StreamExtensionFallback {

    private val CANDIDATES = listOf("mkv", "mp4", "ts", "m3u8")

    fun extractExtension(url: String): String? {
        val path = url.substringBefore('?').substringBefore('#')
        val name = path.substringAfterLast('/')
        val dot = name.lastIndexOf('.')
        if (dot <= 0 || dot >= name.length - 1) return null
        return name.substring(dot + 1).lowercase()
    }

    fun withExtension(url: String, extension: String): String? {
        val q = url.indexOf('?').takeIf { it >= 0 } ?: url.length
        val hash = url.indexOf('#', startIndex = 0).takeIf { it >= 0 } ?: Int.MAX_VALUE
        val pathEnd = minOf(q, hash)
        val path = url.substring(0, pathEnd)
        val suffix = url.substring(pathEnd)
        val slash = path.lastIndexOf('/')
        if (slash < 0) return null
        val file = path.substring(slash + 1)
        val dot = file.lastIndexOf('.')
        if (dot <= 0) return null
        val nextPath = path.substring(0, slash + 1) + file.substring(0, dot + 1) + extension
        return nextPath + suffix
    }

    /** Returns next URL + extension, or null when nothing left to try. */
    fun next(url: String, alreadyTried: Set<String>): Pair<String, String>? {
        val current = extractExtension(url)
        val tried = alreadyTried.toMutableSet()
        if (current != null) tried.add(current)
        for (ext in CANDIDATES) {
            if (ext in tried) continue
            val nextUrl = withExtension(url, ext) ?: continue
            return nextUrl to ext
        }
        return null
    }
}
