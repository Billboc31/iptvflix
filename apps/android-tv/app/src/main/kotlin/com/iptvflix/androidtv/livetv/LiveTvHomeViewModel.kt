package com.iptvflix.androidtv.livetv

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.iptvflix.androidtv.App
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

private const val TAG = "LiveTvHomeViewModel"

sealed class LiveTvHomeState {
    object Loading : LiveTvHomeState()
    data class Error(val message: String) : LiveTvHomeState()

    // Network errors per-section are treated as empty lists (documented choice):
    // ChannelRepository.recentChannels/favoriteChannels/allChannels swallow errors and return
    // emptyList(), so other sections are never blocked by a single failing request.
    // Error state here is a safety net for unexpected exceptions (e.g. JSON parse failure).
    data class Ready(
        val recent: List<ChannelResponse>,
        val favorites: List<ChannelResponse>,
        val all: List<ChannelResponse>,
    ) : LiveTvHomeState()
}

class LiveTvHomeViewModel(app: Application) : AndroidViewModel(app) {
    private val container get() = getApplication<App>()

    private val _state = MutableStateFlow<LiveTvHomeState>(LiveTvHomeState.Loading)
    val state: StateFlow<LiveTvHomeState> = _state

    init {
        load()
    }

    fun retry() {
        load()
    }

    private fun load() {
        _state.value = LiveTvHomeState.Loading
        viewModelScope.launch {
            try {
                val repo = container.channelRepository
                val recentDeferred = async { repo.recentChannels() }
                val favoritesDeferred = async { repo.favoriteChannels() }
                val allDeferred = async { repo.allChannels() }
                _state.value = LiveTvHomeState.Ready(
                    recent = recentDeferred.await(),
                    favorites = favoritesDeferred.await(),
                    all = allDeferred.await(),
                )
            } catch (e: Exception) {
                Log.e(TAG, "Channel load failed: ${e.message}", e)
                _state.value = LiveTvHomeState.Error(e.message ?: "Erreur de chargement")
            }
        }
    }
}
