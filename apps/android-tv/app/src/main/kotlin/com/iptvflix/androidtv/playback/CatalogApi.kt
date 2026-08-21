package com.iptvflix.androidtv.playback

import com.iptvflix.androidtv.network.ApiClient
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonArray

@Serializable
data class EpisodeContext(
    val id: String,
    val seriesId: String,
    val seasonNumber: Int,
    val episodeNumber: Int,
    val title: String? = null,
    val posterUrl: String? = null,
)

@Serializable
data class SeasonSummary(
    val seasonNumber: Int,
    val title: String? = null,
    val episodeCount: Int = 0,
    val availableEpisodeCount: Int = 0,
)

@Serializable
data class EpisodeListItem(
    val id: String,
    val episodeNumber: Int,
    val title: String? = null,
    val synopsis: String? = null,
    val durationMinutes: Int? = null,
    val posterUrl: String? = null,
    val availabilityCount: Int = 0,
    val availabilityStatus: String = "UNAVAILABLE",
    val selectedVariantId: String? = null,
    val watchState: String? = null,
)

class CatalogApi(private val apiClient: ApiClient) {

    private val json = Json { ignoreUnknownKeys = true }

    suspend fun getEpisodeContext(episodeId: String): EpisodeContext {
        val body = apiClient.get("/episodes/$episodeId")
        return json.decodeFromString(body)
    }

    suspend fun getSeriesSeasons(seriesId: String): List<SeasonSummary> {
        val body = apiClient.get("/series/$seriesId")
        val root = json.parseToJsonElement(body) as? JsonObject ?: return emptyList()
        val seasons = root["seasons"]?.jsonArray ?: return emptyList()
        return seasons.map { json.decodeFromJsonElement(SeasonSummary.serializer(), it) }
    }

    suspend fun getSeasonEpisodes(
        seriesId: String,
        seasonNumber: Int,
        profileId: String? = null,
    ): List<EpisodeListItem> {
        val qs = if (!profileId.isNullOrBlank()) "?profileId=$profileId" else ""
        val body = apiClient.get("/series/$seriesId/seasons/$seasonNumber/episodes$qs")
        return json.decodeFromString(kotlinx.serialization.builtins.ListSerializer(EpisodeListItem.serializer()), body)
    }
}
