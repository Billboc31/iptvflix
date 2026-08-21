package com.iptvflix.androidtv.pairing

import com.iptvflix.androidtv.storage.TokenStore
import kotlinx.coroutines.delay
import java.io.IOException
import java.net.SocketTimeoutException
import java.util.concurrent.TimeoutException

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
            onState(PairingState.Error(friendlyNetworkError(e)))
            return
        }

        onState(PairingState.PollingCode(codeResponse.code, codeResponse.expiresAt))

        var consecutivePollFailures = 0
        while (true) {
            delay(POLL_INTERVAL_MS)
            val status = try {
                api.pollStatus(codeResponse.code).also { consecutivePollFailures = 0 }
            } catch (e: Exception) {
                // Transient emulator / Wi-Fi blips: keep the QR on screen and retry.
                if (isTransientNetworkError(e) && consecutivePollFailures < MAX_TRANSIENT_POLL_FAILURES) {
                    consecutivePollFailures += 1
                    continue
                }
                onState(PairingState.Error(friendlyNetworkError(e)))
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
        private const val MAX_TRANSIENT_POLL_FAILURES = 8
    }
}

private fun isTransientNetworkError(e: Exception): Boolean {
    if (e is SocketTimeoutException || e is TimeoutException) return true
    if (e is IOException) {
        val msg = (e.message ?: "").lowercase()
        return msg.contains("timeout") ||
            msg.contains("timed out") ||
            msg.contains("connection reset") ||
            msg.contains("connection refused") ||
            msg.contains("unreachable") ||
            msg.contains("software caused connection abort")
    }
    val msg = (e.message ?: "").lowercase()
    return msg.contains("timeout") || msg.contains("timed out")
}

private fun friendlyNetworkError(e: Exception): String {
    val msg = (e.message ?: "").lowercase()
    return when {
        msg.contains("timeout") || msg.contains("timed out") ->
            "Délai dépassé — appuie sur Réessayer pour un nouveau code."
        msg.contains("unable to resolve") || msg.contains("unknown host") ->
            "DNS impossible — pas d'accès à l'API."
        msg.startsWith("http ") ->
            "Erreur API (${e.message})."
        else -> e.message?.takeIf { it.isNotBlank() } ?: "Échec réseau"
    }
}
