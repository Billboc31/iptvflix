package com.iptvflix.androidtv.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.isActive
import java.io.IOException

class UnauthorizedException : IOException("Unauthorized — device token rejected")

class SseClient(private val apiClient: ApiClient) {

    /**
     * Long-lived SSE read. Must never run on Main — [okio.Source] reads block the caller
     * and previously caused ANRs on the emulator when clicking UI.
     */
    fun commandStream(): Flow<String> = flow {
        var attempt = 0
        while (currentCoroutineContext().isActive) {
            try {
                val response = apiClient.openStream("/devices/me/commands/stream")
                if (response.code == 401) {
                    response.close()
                    throw UnauthorizedException()
                }
                if (!response.isSuccessful) {
                    response.close()
                    throw IOException("HTTP ${response.code}")
                }
                response.use {
                    val source = it.body?.source() ?: throw IOException("No SSE body")
                    attempt = 0
                    // Do NOT call source.exhausted() — on an idle SSE stream it blocks forever.
                    while (currentCoroutineContext().isActive) {
                        val line = source.readUtf8Line() ?: break
                        if (line.startsWith("data:")) {
                            val data = line.removePrefix("data:").trim()
                            if (data.isNotEmpty() && data != "keep-alive") {
                                emit(data)
                            }
                        }
                    }
                }
            } catch (e: UnauthorizedException) {
                throw e
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                val backoffMs = nextBackoffDelayMs(attempt)
                attempt = minOf(attempt + 1, MAX_ATTEMPT)
                delay(backoffMs)
            }
        }
    }.flowOn(Dispatchers.IO)

    companion object {
        private const val MAX_ATTEMPT = 6

        fun nextBackoffDelayMs(attempt: Int): Long =
            minOf(1_000L * (1L shl attempt), 60_000L)
    }
}
