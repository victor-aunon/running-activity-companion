package com.runningsupport.companion.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.*
import androidx.core.content.ContextCompat
import com.runningsupport.companion.data.AppDatabase
import com.runningsupport.companion.service.RunningActivityService
import com.runningsupport.companion.ui.screens.GatewayConsoleScreen
import kotlinx.coroutines.flow.distinctUntilChanged

data class ActiveSessionState(
    val sessionId: String,
    val token: String,
    val spectatorPin: String,
    val lastActivityEndTime: Long? = null
)

class SessionManager(private val context: Context) {
    private var currentSession: ActiveSessionState? = null

    fun getOrCreateSession(
        customToken: String = "carrera-victor",
        customPin: String = "4829"
    ): ActiveSessionState {
        val last = currentSession
        val tokenToUse = customToken.trim().ifEmpty { "carrera-victor" }
        val pinToUse = customPin.trim().ifEmpty { "4829" }

        if (last != null && last.token == tokenToUse && last.spectatorPin == pinToUse) {
            return last
        }

        val freshSession = ActiveSessionState(
            sessionId = tokenToUse,
            token = tokenToUse,
            spectatorPin = pinToUse
        )
        currentSession = freshSession
        return freshSession
    }

    fun markSessionCompleted() {
        currentSession = currentSession?.copy(lastActivityEndTime = System.currentTimeMillis())
    }

    companion object {
        const val REASSOCIATION_WINDOW_MS = 3 * 60 * 1000L // 3 minutes
    }
}

class MainActivity : ComponentActivity() {
    private lateinit var sessionManager: SessionManager
    private lateinit var db: AppDatabase

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        // Handle permissions
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        sessionManager = SessionManager(this)
        db = AppDatabase.getDatabase(this)

        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        requestRequiredPermissions()

        setContent {
            val isServiceRunning by RunningActivityService.isServiceRunningState.collectAsState()
            val isCloudConnected by RunningActivityService.isCloudConnectedState.collectAsState()
            val isGarminConnected by RunningActivityService.isGarminConnectedState.collectAsState()
            val garminDiagnostics by RunningActivityService.garminDiagnosticsState.collectAsState()
            var isSimulationMode by remember { mutableStateOf(false) }

            var pendingBufferCount by remember { mutableStateOf(0) }

            var sessionName by remember {
                mutableStateOf(
                    prefs.getString(KEY_SESSION_NAME, "carrera-victor") ?: "carrera-victor"
                )
            }

            var spectatorPin by remember {
                mutableStateOf(
                    prefs.getString(KEY_SPECTATOR_PIN, "4829") ?: "4829"
                )
            }

            var session by remember {
                mutableStateOf(sessionManager.getOrCreateSession(sessionName, spectatorPin))
            }

            val savedUrl = prefs.getString(KEY_SERVER_URL, null)
            val initialUrl = if (savedUrl != null && !savedUrl.contains("localhost")) {
                savedUrl
            } else {
                DEFAULT_SERVER_URL
            }

            var serverUrl by remember { mutableStateOf(initialUrl) }

            // Whenever sessionName or spectatorPin changes, refresh active session
            LaunchedEffect(sessionName, spectatorPin) {
                session = sessionManager.getOrCreateSession(sessionName, spectatorPin)
            }

            // Monitor buffer count from Room reactively in real time
            LaunchedEffect(session.sessionId) {
                db.telemetryBufferDao().observeUnsyncedCount(session.sessionId).collect { count ->
                    pendingBufferCount = count
                }
            }

            GatewayConsoleScreen(
                isServiceRunning = isServiceRunning,
                isGarminConnected = isGarminConnected,
                isCloudConnected = isCloudConnected,
                isSimulationMode = isSimulationMode,
                pendingBufferCount = pendingBufferCount,
                spectatorPin = spectatorPin,
                sessionName = sessionName,
                serverUrl = serverUrl,
                garminDiagnostics = garminDiagnostics,
                onSendTestPing = {
                    RunningActivityService.sendGarminTestPing { result ->
                        Toast.makeText(this@MainActivity, result, Toast.LENGTH_LONG).show()
                    }
                },
                onSendTestNotification = {
                    val activeSessionId = session?.sessionId ?: sessionName
                    val msg = RunningActivityService.sendTestCheerNotification(this@MainActivity, activeSessionId)
                    Toast.makeText(this@MainActivity, msg, Toast.LENGTH_LONG).show()
                },
                onSessionNameChange = { newName ->
                    val clean = newName.trim().lowercase().replace(Regex("[^a-z0-9_-]"), "-")
                    sessionName = clean
                    prefs.edit().putString(KEY_SESSION_NAME, clean).apply()
                },
                onSpectatorPinChange = { newPin ->
                    val cleanPin = newPin.filter { it.isDigit() }.take(4)
                    spectatorPin = cleanPin
                    prefs.edit().putString(KEY_SPECTATOR_PIN, cleanPin).apply()
                },
                onServerUrlChange = { newUrl ->
                    serverUrl = newUrl
                    prefs.edit().putString(KEY_SERVER_URL, newUrl).apply()
                },
                onToggleSimulationMode = { enabled ->
                    isSimulationMode = enabled
                    if (isServiceRunning) {
                        startTrackingService(session, serverUrl, enabled)
                    }
                },
                onToggleService = { enabled ->
                    if (enabled) {
                        val activeSession = sessionManager.getOrCreateSession(sessionName, spectatorPin)
                        session = activeSession
                        startTrackingService(activeSession, serverUrl, isSimulationMode)
                    } else {
                        RunningActivityService.onSessionCompleted()
                        stopTrackingService()
                        sessionManager.markSessionCompleted()
                    }
                }
            )
        }
    }

    private fun requestRequiredPermissions() {
        val permissions = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            permissions.add(Manifest.permission.BLUETOOTH_CONNECT)
            permissions.add(Manifest.permission.BLUETOOTH_SCAN)
        }
        if (permissions.isNotEmpty()) {
            requestPermissionLauncher.launch(permissions.toTypedArray())
        }
    }

    private fun sanitizeServerUrl(rawUrl: String): String {
        val trimmed = rawUrl.trim()
        val isEmulator = Build.FINGERPRINT.contains("generic") ||
                         Build.HARDWARE.contains("ranchu") ||
                         Build.HARDWARE.contains("goldfish") ||
                         Build.MODEL.contains("google_sdk")
        if (isEmulator && trimmed.contains("localhost")) {
            return trimmed.replace("localhost", "10.0.2.2")
        }
        return trimmed
    }

    private fun startTrackingService(
        session: ActiveSessionState,
        serverUrl: String,
        isSimulation: Boolean
    ) {
        try {
            val resolvedUrl = sanitizeServerUrl(serverUrl)
            val serviceIntent = Intent(this, RunningActivityService::class.java).apply {
                putExtra(RunningActivityService.EXTRA_TOKEN, session.token)
                putExtra(RunningActivityService.EXTRA_SESSION_ID, session.sessionId)
                putExtra(RunningActivityService.EXTRA_PIN, session.spectatorPin)
                putExtra(RunningActivityService.EXTRA_SERVER_URL, resolvedUrl)
                putExtra(RunningActivityService.EXTRA_SIMULATION_MODE, isSimulation)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
        } catch (e: Exception) {
            Log.e("MainActivity", "Error launching foreground service: ${e.message}", e)
        }
    }

    private fun stopTrackingService() {
        try {
            val serviceIntent = Intent(this, RunningActivityService::class.java)
            stopService(serviceIntent)
        } catch (e: Exception) {
            Log.e("MainActivity", "Error stopping service: ${e.message}", e)
        }
    }

    companion object {
        const val PREFS_NAME = "gateway_prefs"
        const val KEY_SERVER_URL = "server_url"
        const val KEY_SESSION_NAME = "session_name"
        const val KEY_SPECTATOR_PIN = "spectator_pin"
        const val DEFAULT_SERVER_URL = "ws://10.0.2.2:3001/api/ws/session"
    }
}
