package com.iptvflix.androidtv.network

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

private const val TAG = "InteractionEventService"
private const val MAX_BATCH = 50

/**
 * Fire-and-forget interaction event emitter for Android TV.
 * Failures are silently logged — analytics must never break playback.
 */
class InteractionEventService(private val apiClient: ApiClient) {

    suspend fun emit(event: Map<String, Any?>) {
        emitBatch(listOf(event))
    }

    suspend fun emitBatch(events: List<Map<String, Any?>>): String? {
        if (events.isEmpty()) return null
        return try {
            withContext(Dispatchers.IO) {
                val arr = JSONArray()
                events.take(MAX_BATCH).forEach { event ->
                    val obj = JSONObject()
                    event.forEach { (k, v) ->
                        if (v != null) obj.put(k, v)
                    }
                    arr.put(obj)
                }
                val body = JSONObject().put("events", arr).toString()
                val response = apiClient.post("/interaction-events/batch", body)
                // Extract sessionId from response if present
                try {
                    JSONObject(response).optString("sessionId", null)
                } catch (_: Exception) {
                    null
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to emit interaction events: ${e.message}")
            null
        }
    }
}
