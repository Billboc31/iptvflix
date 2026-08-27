package com.iptvflix.androidtv.livetv

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.iptvflix.androidtv.App
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

private const val TAG = "LiveSearchViewModel"
private const val DEBOUNCE_MS = 400L

sealed class LiveSearchState {
    object Idle : LiveSearchState()
    object Loading : LiveSearchState()
    data class Results(
        val liveNow: List<LiveNowResult>,
        val upcoming: List<UpcomingResult>,
        val channels: List<ChannelSearchResult>,
        val query: String,
    ) : LiveSearchState()
    object NoResults : LiveSearchState()
    data class Error(val query: String) : LiveSearchState()
}

class LiveSearchViewModel(
    private val repository: ChannelRepository,
) : ViewModel() {

    private val _state = MutableStateFlow<LiveSearchState>(LiveSearchState.Idle)
    val state: StateFlow<LiveSearchState> = _state

    val isSingleLiveNowResult: Boolean
        get() = (_state.value as? LiveSearchState.Results)?.liveNow?.size == 1

    private var searchJob: Job? = null

    fun onQueryChanged(q: String) {
        searchJob?.cancel()
        if (q.isBlank()) {
            _state.value = LiveSearchState.Idle
            return
        }
        searchJob = viewModelScope.launch {
            delay(DEBOUNCE_MS)
            _state.value = LiveSearchState.Loading
            try {
                val response = repository.searchLiveTV(q)
                _state.value = if (
                    response.liveNow.isEmpty() &&
                    response.upcoming.isEmpty() &&
                    response.channels.isEmpty()
                ) {
                    LiveSearchState.NoResults
                } else {
                    LiveSearchState.Results(
                        liveNow = response.liveNow,
                        upcoming = response.upcoming,
                        channels = response.channels,
                        query = q,
                    )
                }
            } catch (e: Exception) {
                Log.e(TAG, "Search failed for '$q': ${e.message}", e)
                _state.value = LiveSearchState.Error(q)
            }
        }
    }

    fun onVoiceResult(text: String) {
        onQueryChanged(text)
    }

    fun clearQuery() {
        searchJob?.cancel()
        _state.value = LiveSearchState.Idle
    }

    companion object {
        fun factory(app: App): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T =
                    LiveSearchViewModel(app.channelRepository) as T
            }
    }
}
