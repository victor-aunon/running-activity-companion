package com.runningsupport.companion.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * BroadcastReceiver para acciones rápidas desde la notificación de Foreground Service
 */
class SessionActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == ACTION_FINISH_SESSION) {
            Log.i(TAG, "El usuario solicitó finalizar carrera desde la notificación del sistema")
            RunningActivityService.onSessionCompleted()
        }
    }

    companion object {
        private const val TAG = "SessionActionReceiver"
        const val ACTION_FINISH_SESSION = "com.runningsupport.companion.ACTION_FINISH_SESSION"
    }
}
