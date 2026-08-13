package com.iptvflix.androidtv.command

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.iptvflix.androidtv.App
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class CommandViewModel(app: Application) : AndroidViewModel(app) {

    private val container get() = getApplication<App>()

    private val _commands = MutableSharedFlow<PlaybackCommand>(replay = 1)
    val commands: SharedFlow<PlaybackCommand> = _commands

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
                _commands.emit(cmd)
            }
        }
    }

    fun currentCommand(): PlaybackCommand? = _current

    fun clearCommand() {
        _current = null
    }
}
