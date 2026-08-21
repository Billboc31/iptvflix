package com.iptvflix.androidtv.playback

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class StreamExtensionFallbackTest {

    @Test
    fun `next tries mp4 after mkv`() {
        val url = "http://cdn.example/movie/12345.mkv"
        val next = StreamExtensionFallback.next(url, emptySet())
        assertEquals("http://cdn.example/movie/12345.mp4" to "mp4", next)
    }

    @Test
    fun `next skips already tried extensions`() {
        val url = "http://cdn.example/movie/12345.mkv"
        val next = StreamExtensionFallback.next(url, setOf("mp4", "ts"))
        assertEquals("http://cdn.example/movie/12345.m3u8" to "m3u8", next)
    }

    @Test
    fun `next returns null when exhausted`() {
        val url = "http://cdn.example/movie/12345.mkv"
        assertNull(StreamExtensionFallback.next(url, setOf("mkv", "mp4", "ts", "m3u8")))
    }

    @Test
    fun `withExtension preserves query string`() {
        val url = "http://cdn.example/movie/1.mkv?token=abc"
        assertEquals(
            "http://cdn.example/movie/1.mp4?token=abc",
            StreamExtensionFallback.withExtension(url, "mp4"),
        )
    }
}
