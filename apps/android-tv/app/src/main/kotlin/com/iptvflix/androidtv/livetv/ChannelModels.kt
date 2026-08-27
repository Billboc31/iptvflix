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
data class LiveNowResult(
    val channelId: String,
    val channelName: String,
    val logoUrl: String? = null,
    val programTitle: String,
    val startTime: String,
    val endTime: String,
    val progress: Float,
    val streamUrl: String,
    val deliveryMode: String,
)

@Serializable
data class UpcomingResult(
    val channelId: String,
    val channelName: String,
    val logoUrl: String? = null,
    val programTitle: String,
    val startTime: String,
    val endTime: String,
)

@Serializable
data class ChannelSearchResult(
    val channelId: String,
    val channelName: String,
    val logoUrl: String? = null,
    val categories: List<String> = emptyList(),
    val language: String? = null,
    val country: String? = null,
)

@Serializable
data class LiveSearchResponse(
    val liveNow: List<LiveNowResult> = emptyList(),
    val upcoming: List<UpcomingResult> = emptyList(),
    val channels: List<ChannelSearchResult> = emptyList(),
)
