package com.iptvflix.androidtv.network

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class ProfileResponse(
    val id: String,
    val name: String,
    val avatarKey: String? = null,
    val isKids: Boolean = false,
    val accountId: String? = null,
    val maturityLevel: String? = null,
    val lastUsedAt: String? = null,
)

@Serializable
data class SelectProfileResponse(
    val token: String,
    val profile: ProfileResponse,
)

class ProfileApiService(private val apiClient: ApiClient) {

    private val json = Json { ignoreUnknownKeys = true }

    suspend fun listProfiles(): List<ProfileResponse> {
        val body = apiClient.get("/profiles")
        return json.decodeFromString(body)
    }

    suspend fun getCurrentProfile(): ProfileResponse {
        val body = apiClient.get("/profiles/me")
        return json.decodeFromString(body)
    }

    suspend fun selectProfile(profileId: String): SelectProfileResponse {
        val body = apiClient.post("/profiles/$profileId/select")
        return json.decodeFromString(body)
    }
}
