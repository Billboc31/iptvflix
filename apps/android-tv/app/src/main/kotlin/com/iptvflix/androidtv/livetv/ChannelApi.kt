package com.iptvflix.androidtv.livetv

import com.iptvflix.androidtv.network.ApiClient
import kotlinx.serialization.json.Json

class ChannelApi(private val apiClient: ApiClient) {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun getChannels(
        recentlyWatched: Boolean = false,
        favoritesFirst: Boolean = false,
    ): List<ChannelResponse> {
        val params = buildList {
            if (recentlyWatched) add("recentlyWatched=true")
            if (favoritesFirst) add("favoritesFirst=true")
        }
        val query = if (params.isEmpty()) "" else "?" + params.joinToString("&")
        val body = apiClient.get("/channels$query")
        return json.decodeFromString(body)
    }
}
