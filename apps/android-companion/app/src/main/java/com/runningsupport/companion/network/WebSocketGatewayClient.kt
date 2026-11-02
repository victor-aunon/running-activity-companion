package com.runningsupport.companion.network

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class WebSocketGatewayClient(
    private val serverUrl: String,
    private val token: String,
    private val sessionId: String,
    private val spectatorPin: String,
    private val targetPaceSecPerKm: Double = 270.0,
    private val totalRaceDistanceM: Double = 10000.0,
    private val scope: CoroutineScope
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private val httpBaseUrl = resolveHttpBaseUrl(serverUrl)

    @Volatile
    private var isConnected = false
    private var shouldReconnect = true
    private var reconnectJob: kotlinx.coroutines.Job? = null

    private val _incomingCheers = MutableSharedFlow<JSONObject>(extraBufferCapacity = 64)
    val incomingCheers: SharedFlow<JSONObject> = _incomingCheers

    private val _connectionState = MutableSharedFlow<Boolean>(replay = 1)
    val connectionState: SharedFlow<Boolean> = _connectionState.asSharedFlow()

    private val _connectionError = MutableStateFlow<String?>(null)
    val connectionError: StateFlow<String?> = _connectionError.asStateFlow()

    fun connect() {
        shouldReconnect = true
        scope.launch(Dispatchers.IO) {
            try {
                val registerMsg = JSONObject().apply {
                    put("token", token)
                    put("sessionId", sessionId)
                    put("spectatorPin", spectatorPin)
                    put("athleteName", "Víctor")
                    put("targetPaceSecPerKm", targetPaceSecPerKm)
                    put("totalRaceDistanceM", totalRaceDistanceM)
                }
                val body = registerMsg.toString().toRequestBody(jsonMediaType)
                val req = Request.Builder()
                    .url("$httpBaseUrl/api/gateway/session")
                    .post(body)
                    .build()

                client.newCall(req).enqueue(object : Callback {
                    override fun onFailure(call: Call, e: IOException) {
                        _connectionError.value = "${e.javaClass.simpleName}: ${e.message}"
                        _connectionState.tryEmit(false)
                        Log.w(TAG, "HTTP Gateway connection error: ${e.message}. Retrying in 3s...")
                        if (shouldReconnect) {
                            reconnectJob?.cancel()
                            reconnectJob = scope.launch {
                                delay(3000)
                                if (shouldReconnect) connect()
                            }
                        }
                    }

                    override fun onResponse(call: Call, response: Response) {
                        response.use { resp ->
                            if (resp.isSuccessful) {
                                isConnected = true
                                _connectionError.value = null
                                _connectionState.tryEmit(true)
                                Log.i(TAG, "Gateway HTTP session registered: $token ($sessionId)")
                            } else {
                                val err = "HTTP ${resp.code} ${resp.message}"
                                _connectionError.value = err
                                _connectionState.tryEmit(false)
                                Log.w(TAG, "Failed to register gateway HTTP session: $err. Retrying in 3s...")
                                if (shouldReconnect) {
                                    reconnectJob?.cancel()
                                    reconnectJob = scope.launch {
                                        delay(3000)
                                        if (shouldReconnect) connect()
                                    }
                                }
                            }
                        }
                    }
                })
            } catch (e: Exception) {
                _connectionError.value = "${e.javaClass.simpleName}: ${e.message}"
                _connectionState.tryEmit(false)
                Log.w(TAG, "HTTP Gateway connection error: ${e.message}")
            }
        }
    }

    fun send(payload: JSONObject): Boolean {
        if (!payload.has("token")) {
            payload.put("token", token)
        }
        if (!payload.has("sessionId")) {
            payload.put("sessionId", sessionId)
        }
        val type = payload.optString("type")
        val endpoint = when (type) {
            "NOW_PLAYING_UPDATE" -> "$httpBaseUrl/api/gateway/now-playing"
            "SESSION_STATE_CHANGED" -> "$httpBaseUrl/api/gateway/session/complete"
            "CHEER_STATUS_UPDATE" -> "$httpBaseUrl/api/gateway/cheer-ack"
            else -> "$httpBaseUrl/api/gateway/telemetry"
        }

        try {
            val body = payload.toString().toRequestBody(jsonMediaType)
            val req = Request.Builder()
                .url(endpoint)
                .post(body)
                .build()

            client.newCall(req).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    Log.w(TAG, "Gateway HTTP send network error: ${e.message}")
                }

                override fun onResponse(call: Call, response: Response) {
                    response.use { resp ->
                        if (resp.isSuccessful) {
                            if (!isConnected) {
                                isConnected = true
                                _connectionState.tryEmit(true)
                            }
                            _connectionError.value = null

                            val respStr = resp.body?.string()
                            if (!respStr.isNullOrBlank()) {
                                processPendingCheers(respStr)
                            }
                        } else {
                            Log.w(TAG, "Gateway HTTP send error: HTTP ${resp.code}")
                        }
                    }
                }
            })
            return true
        } catch (e: Exception) {
            Log.w(TAG, "Gateway HTTP network error: ${e.message}")
            return false
        }
    }

    private fun sendSync(payload: JSONObject): Boolean {
        if (!payload.has("token")) {
            payload.put("token", token)
        }
        if (!payload.has("sessionId")) {
            payload.put("sessionId", sessionId)
        }
        val type = payload.optString("type")
        val endpoint = when (type) {
            "NOW_PLAYING_UPDATE" -> "$httpBaseUrl/api/gateway/now-playing"
            "SESSION_STATE_CHANGED" -> "$httpBaseUrl/api/gateway/session/complete"
            "CHEER_STATUS_UPDATE" -> "$httpBaseUrl/api/gateway/cheer-ack"
            else -> "$httpBaseUrl/api/gateway/telemetry"
        }

        return try {
            val body = payload.toString().toRequestBody(jsonMediaType)
            val req = Request.Builder()
                .url(endpoint)
                .post(body)
                .build()

            client.newCall(req).execute().use { response ->
                if (response.isSuccessful) {
                    if (!isConnected) {
                        isConnected = true
                        _connectionState.tryEmit(true)
                    }
                    _connectionError.value = null

                    val respStr = response.body?.string()
                    if (!respStr.isNullOrBlank()) {
                        processPendingCheers(respStr)
                    }
                    true
                } else {
                    Log.w(TAG, "Gateway HTTP sync upload error: HTTP ${response.code}")
                    false
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Gateway HTTP sync network error: ${e.message}")
            false
        }
    }

    private fun processPendingCheers(respStr: String) {
        try {
            val respJson = JSONObject(respStr)
            val pendingCheers = respJson.optJSONArray("pendingCheers")
            if (pendingCheers != null && pendingCheers.length() > 0) {
                for (i in 0 until pendingCheers.length()) {
                    val cheer = pendingCheers.getJSONObject(i)
                    _incomingCheers.tryEmit(cheer)
                    Log.i(TAG, "Incoming cheer delivered to watch: ${cheer.optString("body")}")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing gateway cheer response: ${e.message}")
        }
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
            if (title != null && artist != null && title.isNotBlank() && artist.isNotBlank()) {
                val effectiveId = trackId?.ifBlank { null } ?: "track-${Math.abs((title + artist).hashCode())}"
                val effectiveUrl = spotifyUrl?.ifBlank { null } ?: "https://open.spotify.com/track/$effectiveId"
                val trackObj = JSONObject().apply {
                    put("trackId", effectiveId)
                    put("title", title)
                    put("artist", artist)
                    if (album != null) put("album", album)
                    if (artworkUrl != null) put("artworkUrl", artworkUrl)
                    put("durationMs", durationMs ?: 0L)
                    put("spotifyUrl", effectiveUrl)
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
        if (!isConnected) return

        withContext(Dispatchers.IO) {
            while (isConnected) {
                val batch = fetchBatch(sessionId, 50)
                if (batch.isEmpty()) break

                val syncedIds = mutableListOf<Long>()
                for ((id, json) in batch) {
                    if (!isConnected) break
                    if (sendSync(json)) {
                        syncedIds.add(id)
                    } else {
                        // Preserves unconfirmed records in Room DB for next retry
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
    }

    fun disconnect() {
        shouldReconnect = false
        reconnectJob?.cancel()
        reconnectJob = null
        scope.launch(Dispatchers.IO + NonCancellable) {
            try {
                val completePayload = JSONObject().apply {
                    put("token", token)
                    put("status", "COMPLETED")
                }
                val body = completePayload.toString().toRequestBody(jsonMediaType)
                val req = Request.Builder()
                    .url("$httpBaseUrl/api/gateway/session/complete")
                    .post(body)
                    .build()
                client.newCall(req).execute().close()
            } catch (_: Exception) {}
        }
        isConnected = false
        _connectionState.tryEmit(false)
    }

    companion object {
        private const val TAG = "WebSocketGatewayClient"

        private fun resolveHttpBaseUrl(rawUrl: String): String {
            var url = rawUrl.trim()
            if (url.startsWith("wss://", ignoreCase = true)) {
                url = "https://" + url.substring(6)
            } else if (url.startsWith("ws://", ignoreCase = true)) {
                url = "http://" + url.substring(5)
            }
            val queryIdx = url.indexOf('?')
            if (queryIdx != -1) {
                url = url.substring(0, queryIdx)
            }
            val wsIdx = url.indexOf("/api/ws/session")
            if (wsIdx != -1) {
                url = url.substring(0, wsIdx)
            }
            return url.trimEnd('/')
        }
    }
}
