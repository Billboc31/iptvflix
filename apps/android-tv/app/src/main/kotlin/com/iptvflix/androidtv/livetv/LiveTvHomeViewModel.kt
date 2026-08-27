package com.iptvflix.androidtv.livetv

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.iptvflix.androidtv.App
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.supervisorScope
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

class LiveTvHomeViewModel(
    private val repository: ChannelRepository,
) : ViewModel() {

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
                // supervisorScope isolates each async so one failing section
                // does not cancel siblings; exceptions surface via await().
                val (recent, favorites, all) = supervisorScope {
                    val r = async { repository.recentChannels() }
                    val f = async { repository.favoriteChannels() }
                    val a = async { repository.allChannels() }
                    Triple(r.await(), f.await(), a.await())
                }
                _state.value = LiveTvHomeState.Ready(
                    recent = recent,
                    favorites = favorites,
                    all = all,
                )
            } catch (e: Exception) {
                Log.e(TAG, "Channel load failed: ${e.message}", e)
                _state.value = LiveTvHomeState.Error(e.message ?: "Erreur de chargement")
            }
        }
    }

    companion object {
        fun factory(app: App): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T =
                    LiveTvHomeViewModel(app.channelRepository) as T
            }
    }
}
