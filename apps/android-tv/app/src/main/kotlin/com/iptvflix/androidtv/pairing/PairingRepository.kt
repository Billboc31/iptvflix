package com.iptvflix.androidtv.pairing

import com.iptvflix.androidtv.storage.TokenStore
import kotlinx.coroutines.delay

sealed class PairingState {
    object Idle : PairingState()
    object Requesting : PairingState()
    data class PollingCode(val code: String, val expiresAt: String) : PairingState()
    data class Approved(val deviceToken: String) : PairingState()
    object Expired : PairingState()
    data class Error(val message: String) : PairingState()
}

class PairingRepository(
    private val api: PairingApi,
    private val tokenStore: TokenStore,
) {
    suspend fun runPairingFlow(
        onState: (PairingState) -> Unit,
    ) {
        onState(PairingState.Requesting)
        val codeResponse = try {
            api.requestCode()
        } catch (e: Exception) {
            onState(PairingState.Error(e.message ?: "Failed to request code"))
            return
        }

        onState(PairingState.PollingCode(codeResponse.code, codeResponse.expiresAt))

        while (true) {
            delay(POLL_INTERVAL_MS)
            val status = try {
                api.pollStatus(codeResponse.code)
            } catch (e: Exception) {
                onState(PairingState.Error(e.message ?: "Poll failed"))
                return
            }
            when (status.status) {
                "approved" -> {
                    val token = status.deviceToken
                        ?: run { onState(PairingState.Error("No token in approved response")); return }
                    tokenStore.saveDeviceToken(token)
                    onState(PairingState.Approved(token))
                    return
                }
                "expired" -> {
                    onState(PairingState.Expired)
                    return
                }
                else -> Unit // "pending" — keep polling
            }
        }
    }

    companion object {
        private const val POLL_INTERVAL_MS = 3_000L
    }
}
