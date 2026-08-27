package com.iptvflix.androidtv.livetv

import com.iptvflix.androidtv.network.ApiClient
import kotlinx.serialization.json.Json
import java.net.URLEncoder

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

    suspend fun searchLiveTV(query: String): LiveSearchResponse {
        val encoded = URLEncoder.encode(query, "UTF-8")
        val body = apiClient.get("/channels/search?q=$encoded")
        return json.decodeFromString(body)
    }
}
