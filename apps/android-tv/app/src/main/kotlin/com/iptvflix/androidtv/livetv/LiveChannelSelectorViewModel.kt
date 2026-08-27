package com.iptvflix.androidtv.livetv

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.iptvflix.androidtv.App
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

private const val TAG = "LiveChannelSelectorVM"

sealed class LiveChannelSelectorState {
    object Loading : LiveChannelSelectorState()
    data class Ready(val channels: List<ChannelResponse>) : LiveChannelSelectorState()
    data class Error(val message: String) : LiveChannelSelectorState()
}

class LiveChannelSelectorViewModel(private val repo: ChannelRepository) : ViewModel() {

    private val _state = MutableStateFlow<LiveChannelSelectorState>(LiveChannelSelectorState.Loading)
    val state: StateFlow<LiveChannelSelectorState> = _state

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _state.value = LiveChannelSelectorState.Loading
            runCatching {
                repo.allChannelsOrThrow()
            }.fold(
                onSuccess = { channels ->
                    _state.value = LiveChannelSelectorState.Ready(channels)
                },
                onFailure = { e ->
                    Log.w(TAG, "Channel list load failed: ${e.message}")
                    _state.value = LiveChannelSelectorState.Error(
                        e.message ?: "Erreur de chargement",
                    )
                },
            )
        }
    }

    companion object {
        fun factory(app: App): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T =
                    LiveChannelSelectorViewModel(app.channelRepository) as T
            }
    }
}
