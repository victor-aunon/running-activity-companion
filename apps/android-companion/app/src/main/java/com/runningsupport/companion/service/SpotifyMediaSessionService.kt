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

    fun register() {
        try {
            val filter = IntentFilter().apply {
                addAction("com.spotify.music.metadatachanged")
                addAction("com.spotify.music.playbackstatechanged")
                addAction("com.spotify.music.queuechanged")
            }

            spotifyReceiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context, intent: Intent) {
                    try {
                        val action = intent.action ?: return
                        val isPlaying = intent.getBooleanExtra("playing", false)
                        val state = if (isPlaying) "PLAYING" else "PAUSED"
                        val positionMs = intent.getIntExtra("playbackPosition", 0).toLong()
                        val id = intent.getStringExtra("id")?.replace("spotify:track:", "")
                        val track = intent.getStringExtra("track")
                        val artist = intent.getStringExtra("artist")
                        val album = intent.getStringExtra("album")
                        val length = intent.getIntExtra("length", 0).toLong()

                        val spotifyUrl = if (id != null) "https://open.spotify.com/track/$id" else null

                        Log.d(TAG, "Spotify broadcast received: $action (playing=$isPlaying, track=$track)")
                        onPlaybackChanged(
                            state,
                            positionMs,
                            id,
                            track,
                            artist,
                            album,
                            null,
                            length,
                            spotifyUrl
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
