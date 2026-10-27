package com.runningsupport.companion.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.runningsupport.companion.data.AppDatabase
import com.runningsupport.companion.data.entities.CheerEntity
import com.runningsupport.companion.data.entities.SessionEntity
import com.runningsupport.companion.garmin.GarminDataFieldManager
import com.runningsupport.companion.network.WebSocketGatewayClient
import com.runningsupport.companion.ui.MainActivity
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
    private var receivedPacketsCount = 0
    private var lastTelemetryReceivedAt = 0L
    private var watchdogJob: kotlinx.coroutines.Job? = null
    private var isPromptingFinish = false
    private var promptCountdownJob: kotlinx.coroutines.Job? = null

    override fun onCreate() {
        super.onCreate()
        startForegroundServiceNotification()
        activeInstance = this
        try {
            db = AppDatabase.getDatabase(this)
            val mgr = GarminDataFieldManager(this, serviceScope)
            garminManager = mgr
            mgr.setConnectionStateListener { isConnected ->
                _isGarminConnectedState.value = isConnected
            }
            serviceScope.launch {
                mgr.diagnosticsState.collect { diag ->
                    _garminDiagnosticsState.value = diag
                }
            }
            acquireWakeLock()
        } catch (e: Exception) {
            Log.e(TAG, "Error initializing service components in onCreate: ${e.message}", e)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val serverUrl = intent?.getStringExtra(EXTRA_SERVER_URL) ?: DEFAULT_SERVER_URL
        val token = intent?.getStringExtra(EXTRA_TOKEN) ?: "default-token"
        val sessionId = intent?.getStringExtra(EXTRA_SESSION_ID) ?: "default-session"
        val pin = intent?.getStringExtra(EXTRA_PIN) ?: "4829"
        val isSimulation = intent?.getBooleanExtra(EXTRA_SIMULATION_MODE, false) ?: false
        activeSessionId = sessionId

        // Ensure SessionEntity exists in DB so foreign key constraints never fail
        serviceScope.launch {
            try {
                db.telemetryBufferDao().insertSession(
                    SessionEntity(
                        sessionId = sessionId,
                        shareableToken = token,
                        spectatorPin = pin,
                        athleteName = "Víctor",
                        status = "ACTIVE",
                        startedAt = System.currentTimeMillis()
                    )
                )
            } catch (e: Exception) {
                Log.e(TAG, "Error inserting session entity: ${e.message}", e)
            }
        }

        if (gatewayClient == null) {
            val client = WebSocketGatewayClient(serverUrl, token, sessionId, pin, serviceScope)
            gatewayClient = client
            client.connect()

            serviceScope.launch {
                client.connectionState.collect { connected ->
                    _isCloudConnectedState.value = connected
                    if (connected) {
                        try {
                            client.drainBuffer(
                                sessionId = sessionId,
                                fetchBatch = { sId, limit ->
                                    db.telemetryBufferDao().getUnsyncedPackets(sId, limit).map { entity ->
                                        Pair(entity.id, entity.toJsonObject())
                                    }
                                },
                                markSynced = { ids ->
                                    db.telemetryBufferDao().markSynced(ids)
                                }
                            )
                        } catch (e: Exception) {
                            Log.e(TAG, "Error draining telemetry buffer on connect: ${e.message}", e)
                        }
                    }
                }
            }

            garminManager?.setTelemetryListener { snapshot ->
                val type = snapshot.optString("type")
                if (type == "SESSION_STATE_CHANGED") {
                    val status = snapshot.optString("status")
                    if (status == "COMPLETED") {
                        Log.i(TAG, "Fin de carrera recibido del reloj. Completando sesión.")
                        onSessionCompleted()
                        return@setTelemetryListener true
                    }
                    serviceScope.launch {
                        gatewayClient?.send(snapshot)
                    }
                    true
                } else {
                    receivedPacketsCount++
                    lastTelemetryReceivedAt = System.currentTimeMillis()
                    if (isPromptingFinish) {
                        Log.i(TAG, "Telemetría del reloj recuperada. Cancelando aviso de fin de carrera.")
                        dismissFinishPrompt()
                    }
                    gatewayClient?.send(snapshot) ?: false
                }
            }

            setupSpotify(sessionId)
            setupCheersListener(sessionId)
            startInactivityWatchdog(sessionId)
        }

        // Configure simulation mode or real ConnectIQ listener dynamically
        if (isSimulation) {
            garminManager?.setSimulationMode(true, sessionId)
            _isGarminConnectedState.value = true
        } else {
            garminManager?.start(sessionId)
        }
        _isServiceRunningState.value = true

        return START_STICKY
    }

    private fun setupSpotify(sessionId: String) {
        spotifyManager = SpotifyMediaSessionService(this) { state, pos, id, title, artist, album, art, dur, url ->
            val sId = activeSessionId ?: sessionId
            gatewayClient?.sendNowPlayingUpdate(sId, state, pos, id, title, artist, album, art, dur, url)
        }
        spotifyManager?.register()
    }

    private fun setupCheersListener(sessionId: String) {
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

                // 1. Emitir notificación inteligente de Android (GCM la replica en el reloj sobre cualquier pantalla)
                postCheerNotification(
                    context = this@RunningActivityService,
                    notificationId = notifId,
                    sessionId = sessionId,
                    senderName = sender,
                    body = body,
                    ttlSeconds = ttl
                )

                // 2. Confirmar a la nube que el ánimo ya se ha entregado en el reloj
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

                // 3. Reenviar complementariamente al DataField si la pantalla está visible
                garminManager?.transmitCheerToWatch(cheerJson) { /* no-op */ }
            }
        }
    }

    fun onSessionCompleted() {
        val sId = activeSessionId ?: return
        serviceScope.launch {
            val completeEvent = JSONObject().apply {
                put("type", "SESSION_STATE_CHANGED")
                put("sessionId", sId)
                put("status", "COMPLETED")
                put("timestamp", System.currentTimeMillis())
            }
            gatewayClient?.send(completeEvent)
            try {
                db.cheerDao().expireInFlightCheersOnSessionCompleted(sId)
            } catch (e: Exception) {
                Log.w(TAG, "Error expirando ánimos: ${e.message}")
            }
            delay(300)
            gatewayClient?.disconnect()
        }
    }

    private fun startInactivityWatchdog(sessionId: String) {
        watchdogJob?.cancel()
        watchdogJob = serviceScope.launch {
            while (isActive) {
                delay(5_000L) // Comprobar cada 5s
                val now = System.currentTimeMillis()
                // Si la sesión ya estaba recibiendo datos del reloj (> 5 paquetes) y cesa la telemetría por más de 45 segundos
                if (receivedPacketsCount >= 5 && lastTelemetryReceivedAt > 0 && (now - lastTelemetryReceivedAt > 45_000L)) {
                    if (!isPromptingFinish) {
                        launchFinishPromptConfirmation(sessionId)
                    }
                }
            }
        }
    }

    private fun launchFinishPromptConfirmation(sessionId: String) {
        isPromptingFinish = true
        Log.i(TAG, "Telemetría del reloj inactiva (>45s). Emitiendo confirmación interactiva con 20s de cuenta atrás.")

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager

        val keepRunningIntent = Intent(this, SessionActionReceiver::class.java).apply {
            action = SessionActionReceiver.ACTION_KEEP_RUNNING
        }
        val keepRunningPendingIntent = PendingIntent.getBroadcast(
            this,
            103,
            keepRunningIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val keepRunningAction = NotificationCompat.Action.Builder(
            android.R.drawable.ic_media_play,
            "Aún no he finalizado",
            keepRunningPendingIntent
        ).build()

        val confirmFinishIntent = Intent(this, SessionActionReceiver::class.java).apply {
            action = SessionActionReceiver.ACTION_CONFIRM_FINISH
        }
        val confirmFinishPendingIntent = PendingIntent.getBroadcast(
            this,
            104,
            confirmFinishIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val confirmFinishAction = NotificationCompat.Action.Builder(
            android.R.drawable.ic_menu_close_clear_cancel,
            "Sí, finalizar",
            confirmFinishPendingIntent
        ).build()

        val notification = NotificationCompat.Builder(this, CHEERS_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("⚠️ ¿Has terminado la carrera?")
            .setContentText("Sin señal del reloj. Se finalizará en 20 segundos.")
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText("No se recibe telemetría del reloj Garmin. La carrera se dará por finalizada automáticamente en 20 segundos.")
            )
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setTimeoutAfter(20_000L)
            .addAction(keepRunningAction)
            .addAction(confirmFinishAction)
            .build()

        notificationManager?.notify(FINISH_PROMPT_NOTIFICATION_ID, notification)

        promptCountdownJob?.cancel()
        promptCountdownJob = serviceScope.launch {
            delay(20_000L)
            if (isPromptingFinish) {
                Log.i(TAG, "Cuenta atrás de 20s concluida sin veto. Finalizando carrera automáticamente.")
                dismissFinishPrompt()
                onSessionCompleted()
            }
        }
    }

    fun dismissFinishPrompt() {
        isPromptingFinish = false
        promptCountdownJob?.cancel()
        promptCountdownJob = null
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        notificationManager?.cancel(FINISH_PROMPT_NOTIFICATION_ID)
    }

    private fun startForegroundServiceNotification() {
        val channelId = "running_activity_gateway_channel"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Running Activity Gateway",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            manager?.createNotificationChannel(channel)
        }

        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val finishIntent = Intent(this, SessionActionReceiver::class.java).apply {
            action = SessionActionReceiver.ACTION_FINISH_SESSION
        }
        val finishPendingIntent = PendingIntent.getBroadcast(
            this,
            102,
            finishIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val finishAction = NotificationCompat.Action.Builder(
            android.R.drawable.ic_menu_close_clear_cancel,
            "Finalizar Carrera",
            finishPendingIntent
        ).build()

        val notification: Notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("Running Support Gateway")
            .setContentText("Transmitiendo telemetría en tiempo real")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(contentIntent)
            .addAction(finishAction)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    101,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                )
            } else {
                startForeground(101, notification)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error in startForeground with type: ${e.message}", e)
            try {
                startForeground(101, notification)
            } catch (e2: Exception) {
                Log.e(TAG, "Fallback startForeground error: ${e2.message}", e2)
            }
        }
    }

    override fun onDestroy() {
        dismissFinishPrompt()
        watchdogJob?.cancel()
        watchdogJob = null
        if (activeInstance == this) {
            activeInstance = null
        }
        serviceJob.cancel()
        garminManager?.stop()
        garminManager = null
        spotifyManager?.unregister()
        spotifyManager = null
        gatewayClient?.disconnect()
        gatewayClient = null
        _isServiceRunningState.value = false
        _isCloudConnectedState.value = false
        _isGarminConnectedState.value = false
        if (wakeLock?.isHeld == true) {
            try {
                wakeLock?.release()
            } catch (e: Exception) {
                Log.w(TAG, "Error releasing WakeLock: ${e.message}")
            }
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                stopForeground(true)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping foreground notification: ${e.message}")
        }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun acquireWakeLock() {
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
            wakeLock = powerManager?.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "RunningSupport:GatewayWakeLock"
            )?.apply {
                acquire(4 * 60 * 60 * 1000L) // 4 hours maximum timeout
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error acquiring WakeLock: ${e.message}")
        }
    }

    companion object {
        const val CHEERS_CHANNEL_ID = "running_activity_cheers_channel"
        const val EXTRA_SERVER_URL = "extra_server_url"
        const val EXTRA_TOKEN = "extra_token"
        const val EXTRA_SESSION_ID = "extra_session_id"
        const val EXTRA_PIN = "extra_pin"
        const val EXTRA_SIMULATION_MODE = "extra_simulation_mode"
        const val DEFAULT_SERVER_URL = "ws://10.0.2.2:3001/api/ws/session"
        private const val TAG = "RunningActivityService"

        private var activeInstance: RunningActivityService? = null

        private val _isServiceRunningState = MutableStateFlow(false)
        val isServiceRunningState = _isServiceRunningState.asStateFlow()

        private val _isCloudConnectedState = MutableStateFlow(false)
        val isCloudConnectedState = _isCloudConnectedState.asStateFlow()

        private val _isGarminConnectedState = MutableStateFlow(false)
        val isGarminConnectedState = _isGarminConnectedState.asStateFlow()

        private val _garminDiagnosticsState = MutableStateFlow(com.runningsupport.companion.garmin.GarminDiagnostics())
        val garminDiagnosticsState = _garminDiagnosticsState.asStateFlow()

        fun postCheerNotification(
            context: Context,
            notificationId: String,
            sessionId: String,
            senderName: String,
            body: String,
            ttlSeconds: Long = 60
        ) {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && notificationManager != null) {
                val channel = NotificationChannel(
                    CHEERS_CHANNEL_ID,
                    "Ánimos en Carrera",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Notificaciones interactivas de ánimos recibidos durante la actividad"
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 250, 100, 250)
                }
                notificationManager.createNotificationChannel(channel)
            }

            try {
                val thankIntent = Intent(context, CheerActionReceiver::class.java).apply {
                    action = CheerActionReceiver.ACTION_THANK_CHEER
                    putExtra(CheerActionReceiver.EXTRA_NOTIFICATION_ID, notificationId)
                    putExtra(CheerActionReceiver.EXTRA_SESSION_ID, sessionId)
                }
                val thankPendingIntent = PendingIntent.getBroadcast(
                    context,
                    notificationId.hashCode(),
                    thankIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                val thankAction = NotificationCompat.Action.Builder(
                    android.R.drawable.ic_menu_send,
                    "Agradecer",
                    thankPendingIntent
                ).build()

                val notification = NotificationCompat.Builder(context, CHEERS_CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setContentTitle("📣 Ánimo de $senderName")
                    .setContentText("\"$body\"")
                    .setStyle(NotificationCompat.BigTextStyle().bigText("\"$body\""))
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setDefaults(NotificationCompat.DEFAULT_ALL)
                    .setAutoCancel(true)
                    .setTimeoutAfter(ttlSeconds * 1000)
                    .addAction(thankAction)
                    .build()

                notificationManager?.notify(notificationId.hashCode(), notification)
                Log.i(TAG, "Notificación publicada para GCM/Reloj: $senderName - $body")
            } catch (e: Exception) {
                Log.e(TAG, "Error emitiendo notificación de sistema para ánimo: ${e.message}")
            }
        }

        fun sendTestCheerNotification(context: Context, sessionId: String = "carrera-victor"): String {
            val testId = "test-${System.currentTimeMillis()}"
            val sender = "Prueba Companion"
            val body = "¡Mucho ánimo Víctor! Notificación inteligente de prueba"
            postCheerNotification(
                context = context,
                notificationId = testId,
                sessionId = sessionId,
                senderName = sender,
                body = body,
                ttlSeconds = 60
            )
            return "Notificación de prueba enviada al reloj"
        }

        fun sendGarminTestPing(onResult: (String) -> Unit) {
            val mgr = activeInstance?.garminManager
            if (mgr != null) {
                mgr.sendTestPingToWatch(onResult)
            } else {
                onResult("El servicio en segundo plano debe estar activo para probar la conexión con el reloj.")
            }
        }

        fun sendGatewayEvent(event: JSONObject): Boolean {
            return activeInstance?.gatewayClient?.send(event) ?: false
        }

        fun onSessionCompleted() {
            activeInstance?.onSessionCompleted()
        }

        const val FINISH_PROMPT_NOTIFICATION_ID = 202

        fun cancelFinishPromptAndKeepRunning() {
            activeInstance?.let { instance ->
                instance.dismissFinishPrompt()
                instance.lastTelemetryReceivedAt = System.currentTimeMillis()
                Log.i(TAG, "Aviso de finalización cancelado por el corredor. Se extiende la actividad.")
            }
        }
    }
}
