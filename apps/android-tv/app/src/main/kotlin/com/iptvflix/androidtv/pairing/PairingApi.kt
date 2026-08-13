package com.iptvflix.androidtv.pairing

import com.iptvflix.androidtv.network.ApiClient
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class PairingCodeResponse(val code: String, val expiresAt: String)

@Serializable
data class PairingStatusResponse(val status: String, val deviceToken: String? = null)

open class PairingApi(private val apiClient: ApiClient) {

    private val json = Json { ignoreUnknownKeys = true }

    open suspend fun requestCode(): PairingCodeResponse {
        val body = apiClient.post("/pairing/codes")
        return json.decodeFromString(body)
    }

    open suspend fun pollStatus(code: String): PairingStatusResponse {
        val body = apiClient.get("/pairing/codes/$code/status")
        return json.decodeFromString(body)
    }
}
