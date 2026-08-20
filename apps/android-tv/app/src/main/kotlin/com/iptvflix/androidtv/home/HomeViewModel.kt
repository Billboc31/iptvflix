package com.iptvflix.androidtv.home

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.iptvflix.androidtv.App
import com.iptvflix.androidtv.network.ApiException
import com.iptvflix.androidtv.network.InteractionEventService
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
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
        viewModelScope.launch { loadInitialData() }
        viewModelScope.launch { monitorConnection() }
    }

    private suspend fun loadInitialData() {
        coroutineScope {
            val continueDeferred = async { fetchContinueWatching() }
            fetchDeviceAndConnection()
            continueDeferred.await()
        }
    }

    private suspend fun fetchDeviceAndConnection() {
        runCatching {
            val body = container.apiClient.get("/devices/me")
            val info = json.decodeFromString<DeviceInfo>(body)
            _uiState.value = _uiState.value.copy(
                deviceName = info.name,
                connectionStatus = ConnectionStatus.Connected,
            )
            emitHomeOpenedOnce()
        }.onFailure { err ->
            Log.w(TAG, "Initial device fetch failed: ${err.message}")
            if (err is ApiException && err.code == 401) {
                _uiState.value = _uiState.value.copy(
                    connectionStatus = ConnectionStatus.Revoked("Device access was revoked"),
                )
            } else {
                _uiState.value = _uiState.value.copy(connectionStatus = ConnectionStatus.Reconnecting)
            }
        }
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
        delay(30_000)
        while (true) {
            try {
                container.apiClient.get("/devices/me")
                _uiState.value = _uiState.value.copy(connectionStatus = ConnectionStatus.Connected)
                emitHomeOpenedOnce()
                delay(60_000)
            } catch (e: ApiException) {
                if (e.code == 401) {
                    _uiState.value = _uiState.value.copy(
                        connectionStatus = ConnectionStatus.Revoked("Device access was revoked"),
                    )
                    return
                }
                _uiState.value = _uiState.value.copy(connectionStatus = ConnectionStatus.Reconnecting)
                delay(15_000)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(connectionStatus = ConnectionStatus.Reconnecting)
                delay(15_000)
            }
        }
    }

    private suspend fun emitHomeOpenedOnce() {
        if (hasEmittedHomeOpened) return
        hasEmittedHomeOpened = true
        runCatching {
            interactionEvents.emit(mapOf("eventType" to "HOME_OPENED", "clientType" to "android-tv"))
        }
    }
}
