package com.iptvflix.androidtv.player

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

enum class ChannelKeyEvent { Up, Down }

object ChannelKeyEventBus {
    private val _events = MutableSharedFlow<ChannelKeyEvent>(extraBufferCapacity = 8)
    val events: SharedFlow<ChannelKeyEvent> = _events.asSharedFlow()

    fun post(event: ChannelKeyEvent): Boolean = _events.tryEmit(event)
}
