package com.iptvflix.androidtv.pairing

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.iptvflix.androidtv.App
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed class PairingUiState {
    object Loading : PairingUiState()
    data class ShowingCode(val code: String, val expiresAt: String) : PairingUiState()
    object Approved : PairingUiState()
    object Expired : PairingUiState()
    data class Error(val message: String) : PairingUiState()
}

class PairingViewModel(app: Application) : AndroidViewModel(app) {

    private val container get() = getApplication<App>()

    private val repository = PairingRepository(
        api = PairingApi(container.apiClient),
        tokenStore = container.secureStorage,
    )

    private val _uiState = MutableStateFlow<PairingUiState>(PairingUiState.Loading)
    val uiState: StateFlow<PairingUiState> = _uiState

    private var pairingJob: Job? = null

    init {
        startPairing()
    }

    fun startPairing() {
        pairingJob?.cancel()
        _uiState.value = PairingUiState.Loading
        pairingJob = viewModelScope.launch {
            repository.runPairingFlow { state ->
                _uiState.value = when (state) {
                    is PairingState.Requesting -> PairingUiState.Loading
                    is PairingState.PollingCode -> PairingUiState.ShowingCode(state.code, state.expiresAt)
                    is PairingState.Approved -> PairingUiState.Approved
                    is PairingState.Expired -> PairingUiState.Expired
                    is PairingState.Error -> PairingUiState.Error(state.message)
                    else -> PairingUiState.Loading
                }
            }
        }
    }
}
