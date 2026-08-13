package com.iptvflix.androidtv.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext
import java.io.IOException

class UnauthorizedException : IOException("Unauthorized — device token rejected")

class SseClient(private val apiClient: ApiClient) {

    fun commandStream(): Flow<String> = flow {
        var attempt = 0
        while (currentCoroutineContext().isActive) {
            try {
                val response = withContext(Dispatchers.IO) {
                    apiClient.openStream("/devices/me/commands/stream")
                }
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
                    while (!source.exhausted() && currentCoroutineContext().isActive) {
                        val line = withContext(Dispatchers.IO) { source.readUtf8Line() } ?: break
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
    }

    companion object {
        private const val MAX_ATTEMPT = 6

        fun nextBackoffDelayMs(attempt: Int): Long =
            minOf(1_000L * (1L shl attempt), 60_000L)
    }
}
