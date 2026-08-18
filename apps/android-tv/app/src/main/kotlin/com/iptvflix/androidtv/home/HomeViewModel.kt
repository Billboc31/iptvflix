package com.iptvflix.androidtv.home

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.iptvflix.androidtv.App
import com.iptvflix.androidtv.network.ApiException
import com.iptvflix.androidtv.network.InteractionEventService
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

private const val TAG = "HomeViewModel"

@Serializable
private data class DeviceInfo(val name: String = "TV")

@Serializable
private data class ContinueWatchingItem(
    val title: String,
    val posterUrl: String? = null,
)

sealed class ConnectionStatus {
    object Connected : ConnectionStatus()
    object Reconnecting : ConnectionStatus()
    data class Revoked(val reason: String) : ConnectionStatus()
}

data class HomeUiState(
    val deviceName: String = "IPTVFlix TV",
    val connectionStatus: ConnectionStatus = ConnectionStatus.Reconnecting,
    val lastPlayedTitle: String? = null,
    val lastPlayedPosterUrl: String? = null,
)

class HomeViewModel(app: Application) : AndroidViewModel(app) {

    private val container get() = getApplication<App>()
    private val json = Json { ignoreUnknownKeys = true }
    private val interactionEvents by lazy { InteractionEventService(container.apiClient) }
    private var hasEmittedHomeOpened = false

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState

    init {
        viewModelScope.launch { fetchDeviceInfo() }
        viewModelScope.launch { fetchContinueWatching() }
        viewModelScope.launch { monitorConnection() }
    }

    private suspend fun fetchDeviceInfo() {
        runCatching {
            val body = container.apiClient.get("/devices/me")
            val info = json.decodeFromString<DeviceInfo>(body)
            _uiState.value = _uiState.value.copy(deviceName = info.name)
        }.onFailure { Log.w(TAG, "Device info fetch failed: ${it.message}") }
    }

    private suspend fun fetchContinueWatching() {
        runCatching {
            val body = container.apiClient.get("/continue-watching")
            val items = json.decodeFromString<List<ContinueWatchingItem>>(body)
            items.firstOrNull()?.let { item ->
                _uiState.value = _uiState.value.copy(
                    lastPlayedTitle = item.title,
                    lastPlayedPosterUrl = item.posterUrl,
                )
            }
        }.onFailure { Log.w(TAG, "Continue-watching fetch failed: ${it.message}") }
    }

    private suspend fun monitorConnection() {
        while (true) {
            try {
                container.apiClient.get("/devices/me")
                _uiState.value = _uiState.value.copy(connectionStatus = ConnectionStatus.Connected)
                if (!hasEmittedHomeOpened) {
                    hasEmittedHomeOpened = true
                    runCatching {
                        interactionEvents.emit(mapOf("eventType" to "HOME_OPENED", "clientType" to "android-tv"))
                    }
                }
                delay(30_000)
            } catch (e: ApiException) {
                if (e.code == 401) {
                    _uiState.value = _uiState.value.copy(
                        connectionStatus = ConnectionStatus.Revoked("Device access was revoked"),
                    )
                    return
                }
                _uiState.value = _uiState.value.copy(connectionStatus = ConnectionStatus.Reconnecting)
                delay(10_000)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(connectionStatus = ConnectionStatus.Reconnecting)
                delay(10_000)
            }
        }
    }
}
