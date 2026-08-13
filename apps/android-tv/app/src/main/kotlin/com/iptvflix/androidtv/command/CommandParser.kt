package com.iptvflix.androidtv.command

import android.util.Log
import kotlinx.serialization.json.Json

private const val TAG = "CommandParser"

private val json = Json { ignoreUnknownKeys = true; isLenient = true }

object CommandParser {
    fun parseCommand(rawJson: String): PlaybackCommand? = runCatching {
        val cmd = json.decodeFromString<PlaybackCommand>(rawJson)
        if (cmd.id.isBlank() || cmd.mediaType.isBlank() || cmd.mediaId.isBlank()) {
            Log.w(TAG, "Command missing required fields")
            return null
        }
        cmd
    }.getOrElse { e ->
        Log.w(TAG, "Failed to parse command: ${e.message}")
        null
    }
}
