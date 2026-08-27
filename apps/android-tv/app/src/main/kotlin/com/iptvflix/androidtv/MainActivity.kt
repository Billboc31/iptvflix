package com.iptvflix.androidtv

import android.os.Bundle
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.iptvflix.androidtv.player.ChannelKeyEvent
import com.iptvflix.androidtv.player.ChannelKeyEventBus
import com.iptvflix.androidtv.ui.IptvFlixTvTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            IptvFlixTvTheme {
                AppNavGraph()
            }
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        return when (keyCode) {
            KeyEvent.KEYCODE_CHANNEL_UP -> {
                ChannelKeyEventBus.post(ChannelKeyEvent.Up)
                true
            }
            KeyEvent.KEYCODE_CHANNEL_DOWN -> {
                ChannelKeyEventBus.post(ChannelKeyEvent.Down)
                true
            }
            else -> super.onKeyDown(keyCode, event)
        }
    }
}
