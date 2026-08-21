package com.iptvflix.androidtv

import android.app.Application
import com.iptvflix.androidtv.network.ApiClient
import com.iptvflix.androidtv.network.ProfileApiService
import com.iptvflix.androidtv.network.SseClient
import com.iptvflix.androidtv.playback.LastAvailabilityStore
import com.iptvflix.androidtv.storage.SecureStorage

class App : Application() {
    val secureStorage: SecureStorage by lazy { SecureStorage(this) }
    val apiClient: ApiClient by lazy { ApiClient(secureStorage) }
    val sseClient: SseClient by lazy { SseClient(apiClient) }
    val profileApiService: ProfileApiService by lazy { ProfileApiService(apiClient) }
    val lastAvailabilityStore: LastAvailabilityStore by lazy { LastAvailabilityStore(this) }

    override fun onCreate() {
        super.onCreate()
        // Warm token cache once at startup (EncryptedSharedPreferences is slow on TV).
        Thread {
            runCatching {
                secureStorage.getDeviceToken()
                secureStorage.getProfileToken()
            }
        }.start()
    }
}
