package com.runningsupport.companion.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
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
            var isServiceRunning by remember { mutableStateOf(false) }
            var isGarminConnected by remember { mutableStateOf(true) }
            var isCloudConnected by remember { mutableStateOf(false) }
            var pendingBufferCount by remember { mutableStateOf(0) }
            var spectatorPin by remember { mutableStateOf("4829") }
            var serverUrl by remember {
                mutableStateOf(
                    prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL
                )
            }

            val session = remember { sessionManager.getOrCreateSession() }
            spectatorPin = session.spectatorPin

            // Monitor buffer count from Room
            LaunchedEffect(session.sessionId) {
                db.telemetryBufferDao().getUnsyncedTelemetry(session.sessionId, 1000)
                    .let {
                        pendingBufferCount = it.size
                    }
            }

            GatewayConsoleScreen(
                isServiceRunning = isServiceRunning,
                isGarminConnected = isGarminConnected,
                isCloudConnected = isCloudConnected,
                pendingBufferCount = pendingBufferCount,
                spectatorPin = spectatorPin,
                serverUrl = serverUrl,
                onServerUrlChange = { newUrl ->
                    serverUrl = newUrl
                    prefs.edit().putString(KEY_SERVER_URL, newUrl).apply()
                },
                onToggleService = { enabled ->
                    isServiceRunning = enabled
                    if (enabled) {
                        startTrackingService(session, serverUrl)
                        isCloudConnected = true
                    } else {
                        stopTrackingService()
                        sessionManager.markSessionCompleted()
                        isCloudConnected = false
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

    private fun startTrackingService(session: ActiveSessionState, serverUrl: String) {
        val serviceIntent = Intent(this, RunningActivityService::class.java).apply {
            putExtra(RunningActivityService.EXTRA_TOKEN, session.token)
            putExtra(RunningActivityService.EXTRA_SESSION_ID, session.sessionId)
            putExtra(RunningActivityService.EXTRA_SERVER_URL, serverUrl)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }
    }

    private fun stopTrackingService() {
        val serviceIntent = Intent(this, RunningActivityService::class.java)
        stopService(serviceIntent)
    }

    companion object {
        private const val PREFS_NAME = "gateway_prefs"
        private const val KEY_SERVER_URL = "server_url"
        private const val DEFAULT_SERVER_URL = "ws://10.0.2.2:3001/api/ws/session"
    }
}
