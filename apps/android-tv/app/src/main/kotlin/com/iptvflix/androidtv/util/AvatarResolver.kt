package com.iptvflix.androidtv.util

import com.iptvflix.androidtv.R

private val AVATAR_MAP = mapOf(
    "avatar_01" to R.drawable.avatar_01,
    "avatar_02" to R.drawable.avatar_02,
    "avatar_03" to R.drawable.avatar_03,
    "avatar_04" to R.drawable.avatar_04,
    "avatar_05" to R.drawable.avatar_05,
    "avatar_06" to R.drawable.avatar_06,
    "avatar_07" to R.drawable.avatar_07,
    "avatar_08" to R.drawable.avatar_08,
)

private const val FALLBACK_KEY = "avatar_01"

fun getAvatarRes(avatarKey: String?): Int =
    AVATAR_MAP[avatarKey] ?: AVATAR_MAP[FALLBACK_KEY]!!
