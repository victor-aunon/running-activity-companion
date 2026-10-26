package com.runningsupport.companion.network

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import okhttp3.*
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class WebSocketGatewayClient(
    private val serverUrl: String,
    private val token: String,
    private val sessionId: String,
    private val spectatorPin: String,
    private val scope: CoroutineScope
) {
    private val client = OkHttpClient.Builder()
        .pingInterval(15, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private var webSocket: WebSocket? = null
    private var isConnected = false
    private var shouldReconnect = true

    private val _incomingCheers = MutableSharedFlow<JSONObject>(extraBufferCapacity = 64)
    val incomingCheers: SharedFlow<JSONObject> = _incomingCheers

    private val _connectionState = MutableSharedFlow<Boolean>(replay = 1)
    val connectionState: SharedFlow<Boolean> = _connectionState.asSharedFlow()

    fun connect() {
        shouldReconnect = true
        val fullUrl = "$serverUrl?token=$token&role=gateway"
        try {
            val request = Request.Builder().url(fullUrl).build()

            webSocket = client.newWebSocket(request, object : WebSocketListener() {
                override fun onOpen(ws: WebSocket, response: Response) {
                    isConnected = true
                    _connectionState.tryEmit(true)
                    Log.i(TAG, "Gateway WebSocket connected to $fullUrl")

                    val registerMsg = JSONObject().apply {
                        put("type", "GATEWAY_REGISTER")
                        put("sessionId", sessionId)
                        put("spectatorPin", spectatorPin)
                        put("athleteName", "Víctor")
                    }
                    ws.send(registerMsg.toString())
                }

                override fun onMessage(ws: WebSocket, text: String) {
                    try {
                        val json = JSONObject(text)
                        val type = json.optString("type")
                        if (type == "DISPATCH_CHEER") {
                            _incomingCheers.tryEmit(json)
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error parsing incoming WebSocket frame: ${e.message}")
                    }
                }

                override fun onClosing(ws: WebSocket, code: Int, reason: String) {
                    isConnected = false
                    _connectionState.tryEmit(false)
                }

                override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                    isConnected = false
                    _connectionState.tryEmit(false)
                    Log.w(TAG, "WebSocket failure: ${t.message}. Reconnecting in 3s...")
                    if (shouldReconnect) {
                        scope.launch {
                            delay(3000)
                            connect()
                        }
                    }
                }
            })
        } catch (e: Exception) {
            Log.e(TAG, "Error initiating WebSocket to $fullUrl: ${e.message}")
            isConnected = false
            _connectionState.tryEmit(false)
        }
    }

    fun send(payload: JSONObject): Boolean {
        val jsonStr = payload.toString()
        val sent = webSocket?.send(jsonStr) ?: false
        if (!sent) {
            Log.w(TAG, "Failed to send WebSocket payload: type=${payload.optString("type")}, isConnected=$isConnected")
        }
        return sent
    }

    fun sendNowPlayingUpdate(
        sessionId: String,
        state: String,
        positionMs: Long,
        trackId: String?,
        title: String?,
        artist: String?,
        album: String?,
        artworkUrl: String?,
        durationMs: Long?,
        spotifyUrl: String?
    ): Boolean {
        val packet = JSONObject().apply {
            put("type", "NOW_PLAYING_UPDATE")
            put("sessionId", sessionId)
            put("timestamp", System.currentTimeMillis())
            val playbackObj = JSONObject().apply {
                put("state", state)
                put("positionMs", positionMs)
                put("capturedAt", System.currentTimeMillis())
                put("isLiveSync", true)
            }
            put("playback", playbackObj)
            if (trackId != null && title != null && artist != null) {
                val trackObj = JSONObject().apply {
                    put("trackId", trackId)
                    put("title", title)
                    put("artist", artist)
                    if (album != null) put("album", album)
                    if (artworkUrl != null) put("artworkUrl", artworkUrl)
                    put("durationMs", durationMs ?: 0L)
                    put("spotifyUrl", spotifyUrl ?: "https://open.spotify.com/track/$trackId")
                }
                put("track", trackObj)
            } else {
                put("track", JSONObject.NULL)
            }
        }
        return send(packet)
    }

    suspend fun drainBuffer(
        sessionId: String,
        fetchBatch: suspend (String, Int) -> List<Pair<Long, JSONObject>>,
        markSynced: suspend (List<Long>) -> Unit
    ) {
        if (!isConnected || webSocket == null) return

        while (isConnected) {
            val batch = fetchBatch(sessionId, 50)
            if (batch.isEmpty()) break

            val syncedIds = mutableListOf<Long>()
            for ((id, json) in batch) {
                if (send(json)) {
                    syncedIds.add(id)
                } else {
                    break
                }
            }

            if (syncedIds.isNotEmpty()) {
                markSynced(syncedIds)
            } else {
                delay(1000)
                break
            }
        }
    }

    fun disconnect() {
        shouldReconnect = false
        webSocket?.close(1000, "Normal closure")
        webSocket = null
        isConnected = false
        _connectionState.tryEmit(false)
    }

    companion object {
        private const val TAG = "WebSocketGatewayClient"
    }
}
