package com.iptvflix.androidtv.livetv

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

private val json = Json { ignoreUnknownKeys = true }

class ChannelApiParserTest {

    @Test
    fun `full response with epg now, next, logo, categories and isFavorite`() {
        val input = """
            [{
              "id": "ch-1",
              "name": "TF1",
              "logoUrl": "https://cdn.example.com/tf1.png",
              "categories": ["News", "General"],
              "language": "fr",
              "country": "FR",
              "iptvOrgId": "TF1.fr",
              "epg": {
                "now": {
                  "title": "Journal 20h",
                  "startTime": "2026-08-27T18:00:00Z",
                  "endTime": "2026-08-27T18:45:00Z"
                },
                "next": {
                  "title": "Météo",
                  "startTime": "2026-08-27T18:45:00Z",
                  "endTime": "2026-08-27T19:00:00Z"
                }
              },
              "isFavorite": true
            }]
        """.trimIndent()
        val channels = json.decodeFromString<List<ChannelResponse>>(input)
        assertEquals(1, channels.size)
        val ch = channels[0]
        assertEquals("ch-1", ch.id)
        assertEquals("TF1", ch.name)
        assertEquals("https://cdn.example.com/tf1.png", ch.logoUrl)
        assertEquals(listOf("News", "General"), ch.categories)
        assertEquals("fr", ch.language)
        assertEquals("FR", ch.country)
        assertEquals("TF1.fr", ch.iptvOrgId)
        assertNotNull(ch.epg)
        assertEquals("Journal 20h", ch.epg!!.now!!.title)
        assertEquals("2026-08-27T18:00:00Z", ch.epg.now!!.startTime)
        assertEquals("Météo", ch.epg.next!!.title)
        assertTrue(ch.isFavorite)
    }

    @Test
    fun `epg absent is decoded as null`() {
        val input = """[{"id":"ch-2","name":"France 2","categories":[]}]"""
        val channels = json.decodeFromString<List<ChannelResponse>>(input)
        assertEquals(1, channels.size)
        val ch = channels[0]
        assertEquals("ch-2", ch.id)
        assertEquals("France 2", ch.name)
        assertNull(ch.epg)
    }

    @Test
    fun `logo absent is decoded as null`() {
        val input = """[{"id":"ch-3","name":"M6","categories":["Entertainment"]}]"""
        val channels = json.decodeFromString<List<ChannelResponse>>(input)
        val ch = channels[0]
        assertEquals("ch-3", ch.id)
        assertNull(ch.logoUrl)
        assertEquals(listOf("Entertainment"), ch.categories)
    }

    @Test
    fun `minimal response with only id and name uses defaults`() {
        val input = """[{"id":"ch-min","name":"MinimalChannel","categories":[]}]"""
        val channels = json.decodeFromString<List<ChannelResponse>>(input)
        val ch = channels[0]
        assertEquals("ch-min", ch.id)
        assertEquals("MinimalChannel", ch.name)
        assertTrue(ch.categories.isEmpty())
        assertNull(ch.logoUrl)
        assertNull(ch.language)
        assertNull(ch.country)
        assertNull(ch.iptvOrgId)
        assertNull(ch.epg)
        assertFalse(ch.isFavorite)
    }
}
