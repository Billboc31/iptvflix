package com.iptvflix.androidtv.network

import com.iptvflix.androidtv.BuildConfig
import com.iptvflix.androidtv.storage.TokenStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit

class ApiClient(private val tokenStore: TokenStore) {

    val httpClient: OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(TokenInterceptor(tokenStore))
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS) // streaming-safe; callers set per-request timeouts
        .build()

    private val baseUrl = BuildConfig.API_BASE_URL

    fun buildRequest(path: String, method: String = "GET", body: okhttp3.RequestBody? = null): Request =
        Request.Builder()
            .url("$baseUrl$path")
            .method(method, body)
            .build()

    suspend fun get(path: String): String = withContext(Dispatchers.IO) {
        httpClient.newCall(buildRequest(path)).execute().use { response ->
            if (!response.isSuccessful) throw ApiException(response.code)
            response.body?.string() ?: throw IOException("Empty body")
        }
    }

    suspend fun post(path: String, jsonBody: String = "{}"): String = withContext(Dispatchers.IO) {
        val body = jsonBody.toRequestBody("application/json".toMediaType())
        httpClient.newCall(buildRequest(path, "POST", body)).execute().use { response ->
            if (!response.isSuccessful) throw ApiException(response.code)
            response.body?.string() ?: ""
        }
    }

    suspend fun put(path: String, jsonBody: String): Boolean = withContext(Dispatchers.IO) {
        val body = jsonBody.toRequestBody("application/json".toMediaType())
        httpClient.newCall(buildRequest(path, "PUT", body)).execute().use { response ->
            response.isSuccessful
        }
    }

    fun openStream(path: String): Response = httpClient.newCall(buildRequest(path)).execute()
}

class ApiException(val code: Int) : IOException("HTTP $code")

private class TokenInterceptor(private val tokenStore: TokenStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val path = chain.request().url.encodedPath
        val token = when {
            path.contains("/devices/me/") -> tokenStore.getDeviceToken()
            else -> tokenStore.getProfileToken() ?: tokenStore.getDeviceToken()
        }
        val request = if (token != null) {
            chain.request().newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            chain.request()
        }
        return chain.proceed(request)
    }
}
