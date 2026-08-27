package com.iptvflix.androidtv.player

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LiveChannelSwitchTest {

    @Test
    fun `buildChannelSwitchCommand sets mediaType to channel`() {
        val cmd = buildChannelSwitchCommand("ch-123", "TF1", null)
        assertEquals("channel", cmd.mediaType)
    }

    @Test
    fun `buildChannelSwitchCommand uses supplied channelId as mediaId`() {
        val cmd = buildChannelSwitchCommand("ch-abc", "Arte", null)
        assertEquals("ch-abc", cmd.mediaId)
    }

    @Test
    fun `buildChannelSwitchCommand propagates title and logoUrl`() {
        val cmd = buildChannelSwitchCommand("ch-1", "M6", "https://cdn.example.com/m6.png")
        assertEquals("M6", cmd.title)
        assertEquals("https://cdn.example.com/m6.png", cmd.posterUrl)
    }

    @Test
    fun `buildChannelSwitchCommand sets startPositionMs to zero`() {
        val cmd = buildChannelSwitchCommand("ch-1", null, null)
        assertEquals(0L, cmd.startPositionMs)
    }

    @Test
    fun `buildChannelSwitchCommand with null title and logoUrl stores nulls`() {
        val cmd = buildChannelSwitchCommand("ch-x", null, null)
        assertNull(cmd.title)
        assertNull(cmd.posterUrl)
    }

    @Test
    fun `repeated calls produce commands with different ids`() {
        val cmd1 = buildChannelSwitchCommand("ch-1", null, null)
        val cmd2 = buildChannelSwitchCommand("ch-1", null, null)
        assertNotEquals(cmd1.id, cmd2.id)
    }

    @Test
    fun `command id starts with ch- prefix`() {
        val cmd = buildChannelSwitchCommand("ch-99", "Canal+", null)
        assert(cmd.id.startsWith("ch-")) { "Expected id to start with 'ch-' but was '${cmd.id}'" }
    }

    @Test
    fun `zap path - channel id name and logo all propagate through buildChannelSwitchCommand`() {
        val channelId = "live-zap-42"
        val channelName = "Zap Live"
        val channelLogo = "https://cdn.example.com/zap-live.png"
        val cmd = buildChannelSwitchCommand(channelId, channelName, channelLogo)
        assertEquals(channelId, cmd.mediaId)
        assertEquals(channelName, cmd.title)
        assertEquals(channelLogo, cmd.posterUrl)
        assertEquals("channel", cmd.mediaType)
        assertEquals(0L, cmd.startPositionMs)
    }
}
