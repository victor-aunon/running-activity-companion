package com.runningsupport.companion.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.runningsupport.companion.data.AppDatabase
import com.runningsupport.companion.data.entities.CheerEntity
import com.runningsupport.companion.garmin.GarminDataFieldManager
import com.runningsupport.companion.network.WebSocketGatewayClient
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONObject

class RunningActivityService : Service() {
    private val serviceJob = SupervisorJob()
    private val serviceScope = CoroutineScope(Dispatchers.IO + serviceJob)

    private var wakeLock: PowerManager.WakeLock? = null
    private var gatewayClient: WebSocketGatewayClient? = null
    private var garminManager: GarminDataFieldManager? = null
    private var spotifyManager: SpotifyMediaSessionService? = null
    private lateinit var db: AppDatabase
    private var activeSessionId: String? = null

    override fun onCreate() {
        super.onCreate()
        db = AppDatabase.getDatabase(this)
        garminManager = GarminDataFieldManager(this, serviceScope)
        acquireWakeLock()
        startForegroundServiceNotification()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val serverUrl = intent?.getStringExtra(EXTRA_SERVER_URL) ?: DEFAULT_SERVER_URL
        val token = intent?.getStringExtra(EXTRA_TOKEN) ?: "default-token"
        val sessionId = intent?.getStringExtra(EXTRA_SESSION_ID) ?: "default-session"
        val pin = intent?.getStringExtra(EXTRA_PIN) ?: "4829"
        val isSimulation = intent?.getBooleanExtra(EXTRA_SIMULATION_MODE, false) ?: false
        activeSessionId = sessionId

        gatewayClient = WebSocketGatewayClient(serverUrl, token, sessionId, pin, serviceScope)
        gatewayClient?.connect()

        // Track cloud connection state
        serviceScope.launch {
            gatewayClient?.connectionState?.collect { connected ->
                _isCloudConnectedState.value = connected
            }
        }

        // Forward telemetry from Garmin (or simulation) to WebSocket gateway
        garminManager?.setTelemetryListener { snapshot ->
            gatewayClient?.send(snapshot)
        }

        // Configure simulation mode
        garminManager?.setSimulationMode(isSimulation, sessionId)
        _isGarminConnectedState.value = isSimulation
        _isServiceRunningState.value = true

        spotifyManager = SpotifyMediaSessionService(this) { state, pos, id, title, artist, album, art, dur, url ->
            val sId = activeSessionId ?: sessionId
            gatewayClient?.sendNowPlayingUpdate(sId, state, pos, id, title, artist, album, art, dur, url)
        }
        spotifyManager?.register()

        // Listen for cheers from Web and forward to Garmin Data Field
        serviceScope.launch {
            gatewayClient?.incomingCheers?.collect { cheerJson ->
                val notifId = cheerJson.optString("notificationId")
                val sender = cheerJson.optString("senderName")
                val body = cheerJson.optString("body")
                val preset = cheerJson.optString("presetId")
                val ttl = cheerJson.optLong("ttlSeconds", 60)

                val cheer = CheerEntity(
                    notificationId = notifId,
                    sessionId = sessionId,
                    senderName = sender,
                    presetId = preset,
                    body = body,
                    status = "EN_RELOJ",
                    receivedAt = System.currentTimeMillis(),
                    expiresAt = System.currentTimeMillis() + (ttl * 1000)
                )

                db.cheerDao().insertCheer(cheer)
                Log.i(TAG, "Forwarding cheer to Garmin Data Field: $body")

                // Forward via BLE to watch and only notify server upon delivery
                garminManager?.transmitCheerToWatch(cheerJson) { delivered ->
                    if (delivered) {
                        serviceScope.launch {
                            val updateEvent = JSONObject().apply {
                                put("type", "CHEER_STATUS_UPDATE")
                                put("notificationId", notifId)
                                put("sessionId", sessionId)
                                put("status", "EN_RELOJ")
                                put("timestamp", System.currentTimeMillis())
                            }
                            gatewayClient?.send(updateEvent)
                        }
                    }
                }
            }
        }

        return START_STICKY
    }

    fun onSessionCompleted() {
        activeSessionId?.let { sId ->
            serviceScope.launch {
                val completeEvent = JSONObject().apply {
                    put("type", "SESSION_STATE_CHANGED")
                    put("sessionId", sId)
                    put("status", "COMPLETED")
                    put("timestamp", System.currentTimeMillis())
                }
                gatewayClient?.send(completeEvent)
                gatewayClient?.disconnect()
            }
        }
    }

    private fun startForegroundServiceNotification() {
        val channelId = "running_activity_gateway_channel"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Running Activity Gateway",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }

        val notification: Notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("Running Support Gateway")
            .setContentText("Transmitiendo telemetría en tiempo real")
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setOngoing(true)
            .build()

        startForeground(101, notification)
    }

    override fun onDestroy() {
        serviceJob.cancel()
        garminManager?.setSimulationMode(false, "")
        spotifyManager?.unregister()
        spotifyManager = null
        gatewayClient?.disconnect()
        _isServiceRunningState.value = false
        _isCloudConnectedState.value = false
        _isGarminConnectedState.value = false
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun acquireWakeLock() {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "RunningSupport:GatewayWakeLock"
        ).apply {
            acquire(4 * 60 * 60 * 1000L) // 4 hours maximum timeout
        }
    }

    companion object {
        const val EXTRA_SERVER_URL = "extra_server_url"
        const val EXTRA_TOKEN = "extra_token"
        const val EXTRA_SESSION_ID = "extra_session_id"
        const val EXTRA_PIN = "extra_pin"
        const val EXTRA_SIMULATION_MODE = "extra_simulation_mode"
        const val DEFAULT_SERVER_URL = "ws://10.0.2.2:3001/api/ws/session"
        private const val TAG = "RunningActivityService"

        private val _isServiceRunningState = MutableStateFlow(false)
        val isServiceRunningState = _isServiceRunningState.asStateFlow()

        private val _isCloudConnectedState = MutableStateFlow(false)
        val isCloudConnectedState = _isCloudConnectedState.asStateFlow()

        private val _isGarminConnectedState = MutableStateFlow(false)
        val isGarminConnectedState = _isGarminConnectedState.asStateFlow()
    }
}
