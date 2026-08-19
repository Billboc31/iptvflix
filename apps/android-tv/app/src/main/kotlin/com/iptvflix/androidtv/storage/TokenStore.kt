package com.iptvflix.androidtv.storage

interface TokenStore {
    fun saveDeviceToken(token: String)
    fun getDeviceToken(): String?
    fun clearDeviceToken()

    // Profile JWT — stored separately so device SSE/commands keep working
    fun saveProfileToken(token: String)
    fun getProfileToken(): String?

    // Last-used profile ID — UX hint only, not used for authorization
    fun saveLastUsedProfileId(id: String)
    fun getLastUsedProfileId(): String?
}
