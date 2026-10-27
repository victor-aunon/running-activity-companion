package com.runningsupport.companion.service

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * BroadcastReceiver para acciones rápidas desde las notificaciones del sistema
 */
class SessionActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager

        when (intent.action) {
            ACTION_FINISH_SESSION, ACTION_CONFIRM_FINISH -> {
                Log.i(TAG, "El usuario confirmó finalizar la carrera desde la notificación")
                notificationManager?.cancel(RunningActivityService.FINISH_PROMPT_NOTIFICATION_ID)
                RunningActivityService.onSessionCompleted()
            }
            ACTION_KEEP_RUNNING -> {
                Log.i(TAG, "El usuario indicó 'Aún no he finalizado' desde el reloj/móvil")
                notificationManager?.cancel(RunningActivityService.FINISH_PROMPT_NOTIFICATION_ID)
                RunningActivityService.cancelFinishPromptAndKeepRunning()
            }
        }
    }

    companion object {
        private const val TAG = "SessionActionReceiver"
        const val ACTION_FINISH_SESSION = "com.runningsupport.companion.ACTION_FINISH_SESSION"
        const val ACTION_CONFIRM_FINISH = "com.runningsupport.companion.ACTION_CONFIRM_FINISH"
        const val ACTION_KEEP_RUNNING = "com.runningsupport.companion.ACTION_KEEP_RUNNING"
    }
}
