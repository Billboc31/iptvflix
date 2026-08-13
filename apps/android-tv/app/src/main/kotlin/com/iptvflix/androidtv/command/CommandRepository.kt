package com.iptvflix.androidtv.command

import android.util.Log
import com.iptvflix.androidtv.network.ApiClient
import com.iptvflix.androidtv.network.SseClient
import com.iptvflix.androidtv.network.UnauthorizedException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject

private const val TAG = "CommandRepository"
private const val POLL_INTERVAL_MS = 10_000L
private const val SSE_MAX_FAILURES = 3

class CommandRepository(
    private val sseClient: SseClient,
    private val apiClient: ApiClient,
    private val onRevoked: () -> Unit,
) {
    private val acknowledgedIds = Collections.synchronizedSet(mutableSetOf<String>())

    fun commands(): Flow<PlaybackCommand> = callbackFlow {
        var sseFailed = 0

        while (true) {
            if (sseFailed < SSE_MAX_FAILURES) {
                try {
                    sseClient.commandStream().collect { rawJson ->
                        CommandParser.parseCommand(rawJson)?.let { cmd ->
                            if (!acknowledgedIds.contains(cmd.id)) {
                                acknowledgedIds.add(cmd.id)
                                trySend(cmd)
                                acknowledgeCommand(cmd.id)
                            }
                        }
                    }
                    sseFailed = 0
                } catch (e: UnauthorizedException) {
                    Log.w(TAG, "Device revoked — clearing token")
                    onRevoked()
                    break
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    Log.w(TAG, "SSE error (attempt $sseFailed): ${e.message}")
                    sseFailed++
                }
            } else {
                try {
                    pollCommands().forEach { cmd ->
                        if (!acknowledgedIds.contains(cmd.id)) {
                            acknowledgedIds.add(cmd.id)
                            trySend(cmd)
                            acknowledgeCommand(cmd.id)
                        }
                    }
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    Log.w(TAG, "Poll error: ${e.message}")
                }
                delay(POLL_INTERVAL_MS)
            }
        }
        awaitClose()
    }

    private suspend fun pollCommands(): List<PlaybackCommand> {
        val body = apiClient.get("/devices/me/commands")
        return runCatching {
            Json.parseToJsonElement(body).jsonArray.mapNotNull { element ->
                CommandParser.parseCommand(element.jsonObject.toString())
            }
        }.getOrDefault(emptyList())
    }

    private suspend fun acknowledgeCommand(id: String) {
        runCatching { apiClient.post("/devices/me/commands/$id/ack") }
    }
}

private object Collections {
    fun <T> synchronizedSet(set: MutableSet<T>): MutableSet<T> =
        java.util.Collections.synchronizedSet(set)
}
