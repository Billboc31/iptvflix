package com.iptvflix.androidtv.storage

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

private const val PREFS_FILE = "secure_prefs"
private const val KEY_DEVICE_TOKEN = "device_token"
private const val KEY_PROFILE_TOKEN = "profile_token"

private const val UX_PREFS_FILE = "ux_prefs"
private const val KEY_LAST_PROFILE_ID = "last_profile_id"

/**
 * Tokens are cached in memory after the first read so OkHttp interceptors
 * don't hit EncryptedSharedPreferences on every HTTP request (very slow on TV).
 */
class SecureStorage(context: Context) : TokenStore {

    private val appContext = context.applicationContext

    private val prefs by lazy {
        EncryptedSharedPreferences.create(
            appContext,
            PREFS_FILE,
            MasterKey.Builder(appContext)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build(),
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    private val uxPrefs: SharedPreferences =
        appContext.getSharedPreferences(UX_PREFS_FILE, Context.MODE_PRIVATE)

    @Volatile private var cachedDeviceToken: String? = null
    @Volatile private var cachedProfileToken: String? = null
    @Volatile private var deviceTokenLoaded = false
    @Volatile private var profileTokenLoaded = false

    override fun saveDeviceToken(token: String) {
        cachedDeviceToken = token
        deviceTokenLoaded = true
        prefs.edit().putString(KEY_DEVICE_TOKEN, token).commit()
    }

    override fun getDeviceToken(): String? {
        if (!deviceTokenLoaded) {
            cachedDeviceToken = prefs.getString(KEY_DEVICE_TOKEN, null)
            deviceTokenLoaded = true
        }
        return cachedDeviceToken
    }

    override fun clearDeviceToken() {
        cachedDeviceToken = null
        cachedProfileToken = null
        deviceTokenLoaded = true
        profileTokenLoaded = true
        prefs.edit()
            .remove(KEY_DEVICE_TOKEN)
            .remove(KEY_PROFILE_TOKEN)
            .commit()
    }

    override fun saveProfileToken(token: String) {
        cachedProfileToken = token
        profileTokenLoaded = true
        prefs.edit().putString(KEY_PROFILE_TOKEN, token).commit()
    }

    override fun getProfileToken(): String? {
        if (!profileTokenLoaded) {
            cachedProfileToken = prefs.getString(KEY_PROFILE_TOKEN, null)
            profileTokenLoaded = true
        }
        return cachedProfileToken
    }

    override fun clearProfileToken() {
        cachedProfileToken = null
        profileTokenLoaded = true
        prefs.edit().remove(KEY_PROFILE_TOKEN).commit()
    }

    override fun saveLastUsedProfileId(id: String) {
        uxPrefs.edit().putString(KEY_LAST_PROFILE_ID, id).apply()
    }

    override fun getLastUsedProfileId(): String? = uxPrefs.getString(KEY_LAST_PROFILE_ID, null)
}
