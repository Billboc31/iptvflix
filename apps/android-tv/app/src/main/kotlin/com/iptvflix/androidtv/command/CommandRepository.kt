package com.iptvflix.androidtv.command

import android.util.Log
import com.iptvflix.androidtv.network.ApiClient
import com.iptvflix.androidtv.network.SseClient
import com.iptvflix.androidtv.network.UnauthorizedException
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

private const val TAG = "CommandRepository"

class CommandRepository(
    private val sseClient: SseClient,
    private val apiClient: ApiClient,
    private val onRevoked: () -> Unit,
) {
    private val acknowledgedIds = java.util.Collections.synchronizedSet(mutableSetOf<String>())

    fun commands(): Flow<PlaybackCommand> = callbackFlow {
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
        } catch (e: UnauthorizedException) {
            Log.w(TAG, "Device revoked — clearing token")
            onRevoked()
        }
        awaitClose()
    }

    private suspend fun acknowledgeCommand(id: String) {
        runCatching { apiClient.post("/devices/me/commands/$id/ack") }
    }
}
