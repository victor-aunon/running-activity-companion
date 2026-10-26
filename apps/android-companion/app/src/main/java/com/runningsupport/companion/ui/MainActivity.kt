package com.runningsupport.companion.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.*
import androidx.core.content.ContextCompat
import com.runningsupport.companion.data.AppDatabase
import com.runningsupport.companion.service.RunningActivityService
import com.runningsupport.companion.ui.screens.GatewayConsoleScreen
import kotlinx.coroutines.flow.distinctUntilChanged
import java.util.UUID

data class ActiveSessionState(
    val sessionId: String,
    val token: String,
    val spectatorPin: String,
    val lastActivityEndTime: Long? = null
)

class SessionManager(private val context: Context) {
    private var currentSession: ActiveSessionState? = null

    fun getOrCreateSession(): ActiveSessionState {
        val now = System.currentTimeMillis()
        val last = currentSession

        if (last != null && last.lastActivityEndTime != null) {
            val elapsed = now - last.lastActivityEndTime
            if (elapsed <= REASSOCIATION_WINDOW_MS) {
                // Reassociate workout session within 3 minutes
                currentSession = last.copy(lastActivityEndTime = null)
                return currentSession!!
            }
        }

        val newSessionId = UUID.randomUUID().toString()
        val newToken = UUID.randomUUID().toString().substring(0, 8)
        val pin = (1000..9999).random().toString()

        val freshSession = ActiveSessionState(
            sessionId = newSessionId,
            token = newToken,
            spectatorPin = pin
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
            var isSimulationMode by remember { mutableStateOf(false) }

            var pendingBufferCount by remember { mutableStateOf(0) }
            var spectatorPin by remember { mutableStateOf("4829") }

            val savedUrl = prefs.getString(KEY_SERVER_URL, null)
            val initialUrl = if (savedUrl != null && !savedUrl.contains("localhost")) {
                savedUrl
            } else {
                DEFAULT_SERVER_URL
            }

            var serverUrl by remember { mutableStateOf(initialUrl) }

            val session = remember { sessionManager.getOrCreateSession() }
            spectatorPin = session.spectatorPin

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
                serverUrl = serverUrl,
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
                        startTrackingService(session, serverUrl, isSimulationMode)
                    } else {
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
        private const val PREFS_NAME = "gateway_prefs"
        private const val KEY_SERVER_URL = "server_url"
        private const val DEFAULT_SERVER_URL = "ws://10.0.2.2:3001/api/ws/session"
    }
}
