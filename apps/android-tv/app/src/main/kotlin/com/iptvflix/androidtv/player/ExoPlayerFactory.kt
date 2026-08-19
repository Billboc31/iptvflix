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

@UnstableApi
object ExoPlayerFactory {

    fun create(context: Context, tokenStore: TokenStore): ExoPlayer {
        val apiHost = runCatching { Uri.parse(BuildConfig.API_BASE_URL).host }.getOrNull()
        val httpClient = OkHttpClient.Builder()
            .addInterceptor(PlaybackAuthInterceptor(tokenStore, apiHost))
            .followRedirects(true)
            .followSslRedirects(true)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()

        val dataSourceFactory = OkHttpDataSource.Factory(httpClient)
            .setUserAgent("IPTVFlix-AndroidTV/1.0")

        val mediaSourceFactory = DefaultMediaSourceFactory(context)
            .setDataSourceFactory(dataSourceFactory)

        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                60_000,
                180_000,
                5_000,
                10_000,
            )
            .setPrioritizeTimeOverSizeThresholds(true)
            .build()

        return ExoPlayer.Builder(context)
            .setMediaSourceFactory(mediaSourceFactory)
            .setLoadControl(loadControl)
            .build()
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
