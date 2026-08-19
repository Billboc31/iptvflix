package com.iptvflix.androidtv.command

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.iptvflix.androidtv.App
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class CommandViewModel(app: Application) : AndroidViewModel(app) {

    private val container get() = getApplication<App>()

    private val _latestCommand = MutableStateFlow<PlaybackCommand?>(null)
    val latestCommand: StateFlow<PlaybackCommand?> = _latestCommand

    private val _isRevoked = MutableStateFlow(false)
    val isRevoked: StateFlow<Boolean> = _isRevoked

    private var _current: PlaybackCommand? = null

    private val repository by lazy {
        CommandRepository(
            sseClient = container.sseClient,
            apiClient = container.apiClient,
            onRevoked = {
                container.secureStorage.clearDeviceToken()
                _isRevoked.value = true
            },
        )
    }

    init {
        viewModelScope.launch {
            repository.commands().collect { cmd ->
                _current = cmd
                _latestCommand.value = cmd
            }
        }
    }

    fun currentCommand(): PlaybackCommand? = _current

    fun clearCommand() {
        _current = null
        _latestCommand.value = null
    }
}
