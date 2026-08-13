package com.iptvflix.androidtv

import android.app.Application
import com.iptvflix.androidtv.network.ApiClient
import com.iptvflix.androidtv.network.SseClient
import com.iptvflix.androidtv.storage.SecureStorage

class App : Application() {
    val secureStorage: SecureStorage by lazy { SecureStorage(this) }
    val apiClient: ApiClient by lazy { ApiClient(secureStorage) }
    val sseClient: SseClient by lazy { SseClient(apiClient) }
}
