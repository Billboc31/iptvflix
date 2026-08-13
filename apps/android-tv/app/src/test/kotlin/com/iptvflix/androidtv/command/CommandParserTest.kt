package com.iptvflix.androidtv.command

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class CommandParserTest {

    @Test
    fun `valid movie command is parsed correctly`() {
        val json = """{"id":"cmd-1","mediaType":"movie","mediaId":"m-42","startPositionMs":0}"""
        val cmd = CommandParser.parseCommand(json)
        assertNotNull(cmd)
        assertEquals("cmd-1", cmd!!.id)
        assertEquals("movie", cmd.mediaType)
        assertEquals("m-42", cmd.mediaId)
        assertEquals(0L, cmd.startPositionMs)
        assertNull(cmd.availabilityId)
    }

    @Test
    fun `valid episode command with resume position is parsed correctly`() {
        val json = """
            {
              "id": "cmd-2",
              "mediaType": "episode",
              "mediaId": "ep-7",
              "availabilityId": "av-3",
              "startPositionMs": 30000
            }
        """.trimIndent()
        val cmd = CommandParser.parseCommand(json)
        assertNotNull(cmd)
        assertEquals("episode", cmd!!.mediaType)
        assertEquals("ep-7", cmd.mediaId)
        assertEquals("av-3", cmd.availabilityId)
        assertEquals(30_000L, cmd.startPositionMs)
    }

    @Test
    fun `unknown extra fields are ignored`() {
        val json = """
            {"id":"cmd-3","mediaType":"movie","mediaId":"m-1","startPositionMs":0,"unknownField":"x"}
        """.trimIndent()
        val cmd = CommandParser.parseCommand(json)
        assertNotNull(cmd)
        assertEquals("cmd-3", cmd!!.id)
    }

    @Test
    fun `missing id returns null`() {
        val json = """{"mediaType":"movie","mediaId":"m-1","startPositionMs":0}"""
        assertNull(CommandParser.parseCommand(json))
    }

    @Test
    fun `missing mediaId returns null`() {
        val json = """{"id":"cmd-4","mediaType":"movie","startPositionMs":0}"""
        assertNull(CommandParser.parseCommand(json))
    }

    @Test
    fun `malformed JSON returns null`() {
        assertNull(CommandParser.parseCommand("not-json"))
    }

    @Test
    fun `empty string returns null`() {
        assertNull(CommandParser.parseCommand(""))
    }

    @Test
    fun `blank id returns null`() {
        val json = """{"id":"","mediaType":"movie","mediaId":"m-1","startPositionMs":0}"""
        assertNull(CommandParser.parseCommand(json))
    }
}
