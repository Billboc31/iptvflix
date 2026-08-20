package com.iptvflix.androidtv.player

import android.content.Context
import android.net.Uri
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import com.iptvflix.androidtv.BuildConfig
import com.iptvflix.androidtv.storage.TokenStore
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import java.util.concurrent.TimeUnit

/** Same UA family as the API / media-relay — Xtream Cloudflare rejects unknown agents. */
private const val XTREAM_USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

@UnstableApi
object ExoPlayerFactory {

    fun create(context: Context, tokenStore: TokenStore): ExoPlayer {
        val apiHost = runCatching { Uri.parse(BuildConfig.API_BASE_URL).host }.getOrNull()
        val httpClient = OkHttpClient.Builder()
            .addInterceptor(PlaybackAuthInterceptor(tokenStore, apiHost))
            .addInterceptor(XtreamHeaderInterceptor())
            .followRedirects(true)
            .followSslRedirects(true)
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()

        val dataSourceFactory = OkHttpDataSource.Factory(httpClient)
            .setUserAgent(XTREAM_USER_AGENT)

        val mediaSourceFactory = DefaultMediaSourceFactory(context)
            .setDataSourceFactory(dataSourceFactory)

        // Keep buffers modest — large MKV buffers OOM / crash low-end Android TV boxes.
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                8_000,
                25_000,
                1_000,
                2_000,
            )
            .setPrioritizeTimeOverSizeThresholds(true)
            .build()

        return ExoPlayer.Builder(context)
            .setMediaSourceFactory(mediaSourceFactory)
            .setLoadControl(loadControl)
            .build()
    }
}

private class XtreamHeaderInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        // Don't rewrite auth requests to our API.
        if (request.url.host.contains("railway.app", ignoreCase = true) ||
            request.url.host.contains("iptvflix", ignoreCase = true)
        ) {
            return chain.proceed(request)
        }
        return chain.proceed(
            request.newBuilder()
                .header("User-Agent", XTREAM_USER_AGENT)
                .header("Accept", "*/*")
                .header("Connection", "keep-alive")
                .build(),
        )
    }
}

private class PlaybackAuthInterceptor(
    private val tokenStore: TokenStore,
    private val apiHost: String?,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (apiHost == null || request.url.host != apiHost) {
            return chain.proceed(request)
        }
        val token = tokenStore.getProfileToken() ?: tokenStore.getDeviceToken() ?: return chain.proceed(request)
        return chain.proceed(
            request.newBuilder()
                .header("Authorization", "Bearer $token")
                .build(),
        )
    }
}
