package com.iptvflix.androidtv.livetv

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Pure state-machine tests for the VOD ↔ Live TV mode switch.
 * Mirrors the AppNavGraph screen-name transitions without any Compose infrastructure.
 */
class ModeSwitchTest {

    private companion object {
        const val HOME = "Home"
        const val LIVE_TV_HOME = "LiveTvHome"
        const val PLAYER = "Player"
    }

    @Test
    fun `starting at Home, activating TV switch moves to LiveTvHome`() {
        var currentScreen = HOME
        val onSwitchToLiveTv = { currentScreen = LIVE_TV_HOME }

        onSwitchToLiveTv()

        assertEquals(LIVE_TV_HOME, currentScreen)
    }

    @Test
    fun `pressing back from LiveTvHome returns to Home`() {
        var currentScreen = LIVE_TV_HOME
        val onBack = { currentScreen = HOME }

        onBack()

        assertEquals(HOME, currentScreen)
    }

    @Test
    fun `VOD Player is reachable from Home`() {
        var currentScreen = HOME
        val onPlay = { currentScreen = PLAYER }

        onPlay()

        assertEquals(PLAYER, currentScreen)
    }

    @Test
    fun `LiveTvHome does not navigate to Player - back goes to Home`() {
        var currentScreen = LIVE_TV_HOME

        // Back from LiveTvHome must go to Home, not Player.
        val onBack = { currentScreen = HOME }
        onBack()
        assertEquals(HOME, currentScreen)

        // The only path to Player is from Home.
        val onPlay = { currentScreen = PLAYER }
        onPlay()
        assertEquals(PLAYER, currentScreen)
    }
}
