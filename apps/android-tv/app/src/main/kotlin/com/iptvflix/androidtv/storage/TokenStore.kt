package com.iptvflix.androidtv.storage

interface TokenStore {
    fun saveDeviceToken(token: String)
    fun getDeviceToken(): String?
    fun clearDeviceToken()

    // Profile JWT — overwrites the device token since the profile JWT is a superset
    fun saveProfileToken(token: String) = saveDeviceToken(token)
    fun getProfileToken(): String? = getDeviceToken()

    // Last-used profile ID — UX hint only, not used for authorization
    fun saveLastUsedProfileId(id: String)
    fun getLastUsedProfileId(): String?
}
