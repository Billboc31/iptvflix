package com.iptvflix.androidtv.storage

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

private const val PREFS_FILE = "secure_prefs"
private const val KEY_DEVICE_TOKEN = "device_token"

private const val UX_PREFS_FILE = "ux_prefs"
private const val KEY_LAST_PROFILE_ID = "last_profile_id"

class SecureStorage(context: Context) : TokenStore {

    private val prefs = EncryptedSharedPreferences.create(
        context,
        PREFS_FILE,
        MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    private val uxPrefs: SharedPreferences =
        context.getSharedPreferences(UX_PREFS_FILE, Context.MODE_PRIVATE)

    override fun saveDeviceToken(token: String) {
        prefs.edit().putString(KEY_DEVICE_TOKEN, token).apply()
    }

    override fun getDeviceToken(): String? = prefs.getString(KEY_DEVICE_TOKEN, null)

    override fun clearDeviceToken() {
        prefs.edit().remove(KEY_DEVICE_TOKEN).apply()
    }

    override fun saveLastUsedProfileId(id: String) {
        uxPrefs.edit().putString(KEY_LAST_PROFILE_ID, id).apply()
    }

    override fun getLastUsedProfileId(): String? = uxPrefs.getString(KEY_LAST_PROFILE_ID, null)
}
