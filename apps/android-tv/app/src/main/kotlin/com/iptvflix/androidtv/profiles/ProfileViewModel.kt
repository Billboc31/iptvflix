package com.iptvflix.androidtv.profiles

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.iptvflix.androidtv.App
import com.iptvflix.androidtv.network.ProfileResponse
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

private const val TAG = "ProfileViewModel"

data class ProfileUiState(
    val profiles: List<ProfileResponse> = emptyList(),
    val loading: Boolean = true,
    val error: String? = null,
)

class ProfileViewModel(app: Application) : AndroidViewModel(app) {

    private val container get() = getApplication<App>()

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
        viewModelScope.launch {
            runCatching {
                val result = container.profileApiService.selectProfile(profileId)
                container.secureStorage.saveProfileToken(result.token)
                container.secureStorage.saveLastUsedProfileId(profileId)
                result.profile
            }.onSuccess {
                onSuccess()
            }.onFailure { err ->
                Log.e(TAG, "Failed to select profile $profileId", err)
                _uiState.value = _uiState.value.copy(error = "Impossible de sélectionner ce profil.")
            }
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}
