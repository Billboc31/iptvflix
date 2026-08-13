package com.iptvflix.androidtv.storage

interface TokenStore {
    fun saveDeviceToken(token: String)
    fun getDeviceToken(): String?
    fun clearDeviceToken()
}
