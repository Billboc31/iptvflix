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
    val mediaType: String,
    val mediaId: String,
    val progressSeconds: Long = 0L,
    val durationSeconds: Long = 0L,
    val episodeTitle: String? = null,
    val seriesId: String? = null,
    val seasonNumber: Int? = null,
    val episodeNumber: Int? = null,
)

sealed class ConnectionStatus {
    object Connected : ConnectionStatus()
    object Reconnecting : ConnectionStatus()
    data class Revoked(val reason: String) : ConnectionStatus()
}

data class ContinueWatchingUi(
    val title: String,
    val subtitle: String? = null,
    val posterUrl: String? = null,
    val mediaType: String,
    val mediaId: String,
    val startPositionMs: Long,
    val progressFraction: Float,
    val seriesId: String? = null,
    val seasonNumber: Int? = null,
)

data class HomeUiState(
    val deviceName: String = "IPTVFlix TV",
    val connectionStatus: ConnectionStatus = ConnectionStatus.Reconnecting,
    val continueWatching: List<ContinueWatchingUi> = emptyList(),
    val profileName: String? = null,
    val profileAvatarKey: String? = null,
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

    /** Call when Home is shown again (e.g. after leaving the player). */
    fun refreshContinueWatching() {
        viewModelScope.launch { fetchContinueWatching() }
    }

    private suspend fun loadInitialData() {
        coroutineScope {
            val continueDeferred = async { fetchContinueWatching() }
            val profileDeferred = async { fetchCurrentProfile() }
            fetchDeviceAndConnection()
            continueDeferred.await()
            profileDeferred.await()
        }
    }

    private suspend fun fetchCurrentProfile() {
        runCatching {
            container.profileApiService.getCurrentProfile()
        }.onSuccess { profile ->
            _uiState.value = _uiState.value.copy(
                profileName = profile.name,
                profileAvatarKey = profile.avatarKey,
            )
        }.onFailure { err ->
            Log.w(TAG, "Current profile fetch failed: ${err.message}")
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
            Log.i(TAG, "Continue-watching: ${items.size} item(s)")
            _uiState.value = _uiState.value.copy(
                continueWatching = items.map { item ->
                    val fraction = if (item.durationSeconds > 0L) {
                        (item.progressSeconds.toFloat() / item.durationSeconds.toFloat()).coerceIn(0f, 1f)
                    } else {
                        0f
                    }
                    val subtitle = when {
                        item.mediaType.equals("EPISODE", ignoreCase = true) &&
                            item.seasonNumber != null && item.episodeNumber != null -> {
                            val ep = item.episodeTitle?.takeIf { it.isNotBlank() }
                            "S${item.seasonNumber} E${item.episodeNumber}" +
                                (ep?.let { " · $it" } ?: "")
                        }
                        else -> null
                    }
                    ContinueWatchingUi(
                        title = item.title,
                        subtitle = subtitle,
                        posterUrl = item.posterUrl,
                        mediaType = item.mediaType.lowercase(),
                        mediaId = item.mediaId,
                        startPositionMs = (item.progressSeconds * 1000L).coerceAtLeast(0L),
                        progressFraction = fraction,
                        seriesId = item.seriesId,
                        seasonNumber = item.seasonNumber,
                    )
                },
            )
        }.onFailure { Log.w(TAG, "Continue-watching fetch failed: ${it.message}", it) }
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
