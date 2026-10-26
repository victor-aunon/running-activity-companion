package com.runningsupport.companion.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.util.Log

class SpotifyMediaSessionService(
    private val context: Context,
    private val onPlaybackChanged: (
        state: String,
        positionMs: Long,
        trackId: String?,
        title: String?,
        artist: String?,
        album: String?,
        artworkUrl: String?,
        durationMs: Long?,
        spotifyUrl: String?
    ) -> Unit
) {
    private var spotifyReceiver: BroadcastReceiver? = null

    // Cache metadata and state across separate broadcast intents
    private var cachedTrackId: String? = null
    private var cachedTitle: String? = null
    private var cachedArtist: String? = null
    private var cachedAlbum: String? = null
    private var cachedDurationMs: Long = 0L
    private var cachedSpotifyUrl: String? = null
    private var isPlaying: Boolean = false
    private var currentPositionMs: Long = 0L

    // Deduplication state to prevent broadcast spam
    private var lastEmittedState: String? = null
    private var lastEmittedTrackId: String? = null
    private var lastEmittedTitle: String? = null

    fun register() {
        try {
            val filter = IntentFilter().apply {
                addAction("com.spotify.music.metadatachanged")
                addAction("com.spotify.music.playbackstatechanged")
            }

            spotifyReceiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context, intent: Intent) {
                    try {
                        val action = intent.action ?: return

                        when (action) {
                            "com.spotify.music.metadatachanged" -> {
                                val rawId = intent.getStringExtra("id")
                                if (rawId != null) {
                                    val cleanId = rawId.replace("spotify:track:", "")
                                    cachedTrackId = cleanId
                                    cachedSpotifyUrl = "https://open.spotify.com/track/$cleanId"
                                }
                                intent.getStringExtra("track")?.let { if (it.isNotBlank()) cachedTitle = it }
                                intent.getStringExtra("artist")?.let { if (it.isNotBlank()) cachedArtist = it }
                                intent.getStringExtra("album")?.let { if (it.isNotBlank()) cachedAlbum = it }

                                val len = intent.getIntExtra("length", 0).toLong()
                                if (len > 0) {
                                    cachedDurationMs = if (len < 10000) len * 1000L else len
                                }
                            }
                            "com.spotify.music.playbackstatechanged" -> {
                                isPlaying = intent.getBooleanExtra("playing", isPlaying)
                                val pos = intent.getIntExtra("playbackPosition", currentPositionMs.toInt()).toLong()
                                currentPositionMs = pos

                                intent.getStringExtra("id")?.replace("spotify:track:", "")?.let {
                                    if (it.isNotBlank()) {
                                        cachedTrackId = it
                                        cachedSpotifyUrl = "https://open.spotify.com/track/$it"
                                    }
                                }
                                intent.getStringExtra("track")?.let { if (it.isNotBlank()) cachedTitle = it }
                                intent.getStringExtra("artist")?.let { if (it.isNotBlank()) cachedArtist = it }
                                intent.getStringExtra("album")?.let { if (it.isNotBlank()) cachedAlbum = it }
                                val len = intent.getIntExtra("length", 0).toLong()
                                if (len > 0) {
                                    cachedDurationMs = if (len < 10000) len * 1000L else len
                                }
                            }
                        }

                        val state = if (isPlaying) "PLAYING" else "PAUSED"

                        // Deduplicate: Don't spam relay if state and track have not changed
                        if (state == lastEmittedState &&
                            cachedTrackId == lastEmittedTrackId &&
                            cachedTitle == lastEmittedTitle
                        ) {
                            return
                        }

                        lastEmittedState = state
                        lastEmittedTrackId = cachedTrackId
                        lastEmittedTitle = cachedTitle

                        Log.d(TAG, "Spotify state: $state (track: $cachedTitle, artist: $cachedArtist, pos: $currentPositionMs)")

                        onPlaybackChanged(
                            state,
                            currentPositionMs,
                            cachedTrackId,
                            cachedTitle,
                            cachedArtist,
                            cachedAlbum,
                            null,
                            cachedDurationMs,
                            cachedSpotifyUrl
                        )
                    } catch (e: Exception) {
                        Log.e(TAG, "Error in spotify onReceive: ${e.message}")
                    }
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(spotifyReceiver, filter, Context.RECEIVER_EXPORTED)
            } else {
                context.registerReceiver(spotifyReceiver, filter)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not register Spotify receiver: ${e.message}")
        }
    }

    fun unregister() {
        spotifyReceiver?.let {
            try {
                context.unregisterReceiver(it)
            } catch (e: Exception) {
                Log.w(TAG, "Receiver not registered or already removed: ${e.message}")
            }
            spotifyReceiver = null
        }
    }

    companion object {
        private const val TAG = "SpotifyMediaSessionService"
    }
}
