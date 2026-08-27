package com.iptvflix.androidtv.livetv

import kotlinx.serialization.Serializable

@Serializable
data class EpgProgram(
    val title: String,
    val startTime: String,
    val endTime: String,
)

@Serializable
data class ChannelEpg(
    val now: EpgProgram? = null,
    val next: EpgProgram? = null,
)

@Serializable
data class ChannelResponse(
    val id: String,
    val name: String,
    val logoUrl: String? = null,
    val categories: List<String> = emptyList(),
    val language: String? = null,
    val country: String? = null,
    val iptvOrgId: String? = null,
    val epg: ChannelEpg? = null,
    val isFavorite: Boolean = false,
)

@Serializable
data class ChannelListResponse(
    val channels: List<ChannelResponse>,
)
