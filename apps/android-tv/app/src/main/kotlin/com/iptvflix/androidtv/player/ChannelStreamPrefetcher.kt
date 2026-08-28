package com.iptvflix.androidtv.player

import com.iptvflix.androidtv.playback.PlaybackDescriptor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap

/**
 * Prefetches channel stream URLs while the user browses the zap carousel so OK
 * can swap instantly instead of waiting on API + remux.
 */
internal class ChannelStreamPrefetcher(
    private val scope: CoroutineScope,
    private val resolve: suspend (channelId: String) -> PlaybackDescriptor,
) {
    private val cache = ConcurrentHashMap<String, PlaybackDescriptor>()
    private val jobs = ConcurrentHashMap<String, Job>()

    fun prefetch(channelId: String) {
        if (channelId.isBlank() || cache.containsKey(channelId)) return
        jobs[channelId]?.cancel()
        jobs[channelId] = scope.launch(Dispatchers.IO) {
            runCatching { resolve(channelId) }.onSuccess { cache[channelId] = it }
        }
    }

    fun take(channelId: String): PlaybackDescriptor? = cache.remove(channelId)

    fun clear() {
        jobs.values.forEach { it.cancel() }
        jobs.clear()
        cache.clear()
    }
}
