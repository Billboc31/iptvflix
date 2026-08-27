package com.iptvflix.androidtv.livetv

import android.util.Log

private const val TAG = "ChannelRepository"

class ChannelRepository(private val api: ChannelApi) {

    suspend fun recentChannels(): List<ChannelResponse> = runCatching {
        api.getChannels(recentlyWatched = true)
    }.onFailure { Log.w(TAG, "Recent channels fetch failed: ${it.message}") }
        .getOrDefault(emptyList())

    suspend fun favoriteChannels(): List<ChannelResponse> = runCatching {
        api.getChannels(favoritesFirst = true).filter { it.isFavorite }
    }.onFailure { Log.w(TAG, "Favorite channels fetch failed: ${it.message}") }
        .getOrDefault(emptyList())

    suspend fun allChannels(): List<ChannelResponse> = runCatching {
        api.getChannels()
    }.onFailure { Log.w(TAG, "All channels fetch failed: ${it.message}") }
        .getOrDefault(emptyList())

    suspend fun allChannelsOrThrow(): List<ChannelResponse> = api.getChannels()
}
