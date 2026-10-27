package com.runningsupport.companion.service

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.runningsupport.companion.data.AppDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject

class CheerActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        val notifId = intent.getStringExtra(EXTRA_NOTIFICATION_ID) ?: return
        val sessionId = intent.getStringExtra(EXTRA_SESSION_ID) ?: return

        if (action == ACTION_THANK_CHEER) {
            Log.i(TAG, "Runner acknowledged cheer from notification action: $notifId")

            // 1. Cancel notification
            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            notificationManager?.cancel(notifId.hashCode())

            // 2. Update status in Room Database
            val db = AppDatabase.getDatabase(context)
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    db.cheerDao().updateStatus(notifId, "AGRADECIDO", "Víctor te lo agradece")
                } catch (e: Exception) {
                    Log.e(TAG, "Error updating cheer status in DB: ${e.message}")
                }
            }

            // 3. Send CHEER_STATUS_UPDATE to cloud WebSocket via RunningActivityService
            val replyEvent = JSONObject().apply {
                put("type", "CHEER_STATUS_UPDATE")
                put("notificationId", notifId)
                put("sessionId", sessionId)
                put("status", "AGRADECIDO")
                put("runnerReplyText", "Víctor te lo agradece")
                put("timestamp", System.currentTimeMillis())
            }
            RunningActivityService.sendGatewayEvent(replyEvent)
        }
    }

    companion object {
        private const val TAG = "CheerActionReceiver"
        const val ACTION_THANK_CHEER = "com.runningsupport.companion.ACTION_THANK_CHEER"
        const val EXTRA_NOTIFICATION_ID = "extra_notification_id"
        const val EXTRA_SESSION_ID = "extra_session_id"
    }
}
