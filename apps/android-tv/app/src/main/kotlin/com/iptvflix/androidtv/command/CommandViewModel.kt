package com.iptvflix.androidtv.command

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.iptvflix.androidtv.App
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
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
        // Storage + SSE must stay off Main (blocking OkHttp reads caused ANRs on click).
        viewModelScope.launch(Dispatchers.IO) {
            while (container.secureStorage.getDeviceToken() == null && !_isRevoked.value) {
                delay(500)
            }
            if (container.secureStorage.getDeviceToken() == null) return@launch
            repository.commands().collect { cmd ->
                _current = cmd
                _latestCommand.value = cmd
            }
        }
    }

    fun currentCommand(): PlaybackCommand? = _current

    /** Local resume (home « dernière lecture ») — same path as SSE commands. */
    fun playLocal(command: PlaybackCommand) {
        _current = command
        _latestCommand.value = command
    }

    fun clearCommand() {
        _current = null
        _latestCommand.value = null
    }
}
