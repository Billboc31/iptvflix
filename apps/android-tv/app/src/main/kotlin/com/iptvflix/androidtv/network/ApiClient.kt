package com.iptvflix.androidtv.network

import com.iptvflix.androidtv.BuildConfig
import com.iptvflix.androidtv.storage.TokenStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Dns
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.net.Inet4Address
import java.net.InetAddress
import java.util.concurrent.TimeUnit

class ApiClient(private val tokenStore: TokenStore) {

    private val apiHttpClient: OkHttpClient = baseClientBuilder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()

    private val streamHttpClient: OkHttpClient = baseClientBuilder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()

    /** Shared by PlaybackApi redirect resolution and other callers needing custom clients. */
    val httpClient: OkHttpClient get() = apiHttpClient

    private val baseUrl = BuildConfig.API_BASE_URL

    private fun baseClientBuilder(): OkHttpClient.Builder =
        OkHttpClient.Builder()
            .dns(Ipv4OnlyDns)
            .addInterceptor(UserAgentInterceptor())
            .addInterceptor(TokenInterceptor(tokenStore))

    fun buildRequest(
        path: String,
        method: String = "GET",
        body: okhttp3.RequestBody? = null,
        clientType: String? = null,
    ): Request {
        val builder = Request.Builder()
            .url("$baseUrl$path")
            .method(method, body)
        if (clientType != null) {
            builder.header("X-Client-Type", clientType)
        }
        return builder.build()
    }

    suspend fun get(path: String): String = withContext(Dispatchers.IO) {
        apiHttpClient.newCall(buildRequest(path)).execute().use { response ->
            if (!response.isSuccessful) throw ApiException(response.code)
            response.body?.string() ?: throw IOException("Empty body")
        }
    }

    suspend fun post(path: String, jsonBody: String = "{}", clientType: String? = null): String =
        withContext(Dispatchers.IO) {
            val body = jsonBody.toRequestBody("application/json".toMediaType())
            apiHttpClient.newCall(buildRequest(path, "POST", body, clientType)).execute().use { response ->
                if (!response.isSuccessful) throw ApiException(response.code)
                response.body?.string() ?: ""
            }
        }

    suspend fun put(path: String, jsonBody: String): Boolean = withContext(Dispatchers.IO) {
        val body = jsonBody.toRequestBody("application/json".toMediaType())
        apiHttpClient.newCall(buildRequest(path, "PUT", body)).execute().use { response ->
            response.isSuccessful
        }
    }

    fun openStream(path: String): Response = streamHttpClient.newCall(buildRequest(path)).execute()
}

class ApiException(val code: Int) : IOException("HTTP $code")

/**
 * Emulator networks often break on IPv6 (or race Happy-Eyeballs).
 * Keep IPv4 only when available. Shared by ApiClient + ExoPlayer OkHttp.
 */
object Ipv4OnlyDns : Dns {
    override fun lookup(hostname: String): List<InetAddress> {
        val addresses = Dns.SYSTEM.lookup(hostname)
        val ipv4 = addresses.filterIsInstance<Inet4Address>()
        return ipv4.ifEmpty { addresses }
    }
}

private class UserAgentInterceptor : Interceptor {
    private val userAgent = "IPTVFlix-AndroidTV/${BuildConfig.VERSION_NAME}"

    override fun intercept(chain: Interceptor.Chain): Response =
        chain.proceed(
            chain.request().newBuilder()
                .header("User-Agent", userAgent)
                .build(),
        )
}

private class TokenInterceptor(private val tokenStore: TokenStore) : Interceptor {
    private val apiHost = runCatching { java.net.URI(BuildConfig.API_BASE_URL).host }.getOrNull()

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        // Never attach IPTVFlix JWT to Xtream / CDN hosts (breaks Cloudflare / provider auth).
        if (apiHost == null || request.url.host != apiHost) {
            return chain.proceed(request)
        }
        val path = request.url.encodedPath
        val token = when {
            path.startsWith("/pairing/") -> null
            path.startsWith("/devices/me") -> tokenStore.getDeviceToken()
            else -> tokenStore.getProfileToken() ?: tokenStore.getDeviceToken()
        }
        val authed = if (token != null) {
            request.newBuilder().header("Authorization", "Bearer $token").build()
        } else {
            request
        }
        return chain.proceed(authed)
    }
}
