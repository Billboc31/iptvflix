package com.iptvflix.androidtv.profiles

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.iptvflix.androidtv.App
import com.iptvflix.androidtv.network.InteractionEventService
import com.iptvflix.androidtv.network.ApiException
import com.iptvflix.androidtv.network.ProfileResponse
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

private const val TAG = "ProfileViewModel"

data class ProfileUiState(
    val profiles: List<ProfileResponse> = emptyList(),
    val loading: Boolean = true,
    val selectingProfileId: String? = null,
    val error: String? = null,
)

class ProfileViewModel(app: Application) : AndroidViewModel(app) {

    private val container get() = getApplication<App>()
    private val interactionEvents by lazy { InteractionEventService(container.apiClient) }

    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState

    init {
        loadProfiles()
    }

    fun loadProfiles() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true, error = null)
            runCatching {
                container.profileApiService.listProfiles()
            }.onSuccess { list ->
                _uiState.value = ProfileUiState(profiles = list, loading = false)
            }.onFailure { err ->
                Log.e(TAG, "Failed to load profiles", err)
                _uiState.value = ProfileUiState(loading = false, error = "Impossible de charger les profils.")
            }
        }
    }

    fun selectProfile(profileId: String, onSuccess: () -> Unit) {
        if (_uiState.value.selectingProfileId != null) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(selectingProfileId = profileId, error = null)
            runCatching {
                val result = container.profileApiService.selectProfile(profileId)
                container.secureStorage.saveProfileToken(result.token)
                container.secureStorage.saveLastUsedProfileId(profileId)
                result.profile
            }.onSuccess {
                _uiState.value = _uiState.value.copy(selectingProfileId = null, error = null)
                onSuccess()
                viewModelScope.launch {
                    runCatching {
                        interactionEvents.emit(mapOf("eventType" to "PROFILE_SELECTED", "clientType" to "android-tv"))
                    }
                }
            }.onFailure { err ->
                Log.e(TAG, "Failed to select profile $profileId", err)
                _uiState.value = _uiState.value.copy(
                    selectingProfileId = null,
                    error = profileSelectErrorMessage(err),
                )
            }
        }
    }

    private fun profileSelectErrorMessage(err: Throwable): String = when (err) {
        is ApiException -> when (err.code) {
            401, 403 -> "Session expirée — relancez l'application."
            else -> "Erreur réseau (${err.code}). Réessayez."
        }
        else -> err.message?.takeIf { it.isNotBlank() }
            ?: "Impossible de sélectionner ce profil."
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}
