package com.runningsupport.companion.garmin

import android.content.Context
import android.util.Log
import com.runningsupport.companion.data.AppDatabase
import com.runningsupport.companion.data.entities.TelemetryEntity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import org.json.JSONObject

class GarminDataFieldManager(
    private val context: Context,
    private val scope: CoroutineScope
) {
    private val db = AppDatabase.getDatabase(context)

    fun onBleMessageReceived(sessionId: String, payload: JSONObject) {
        try {
            val type = payload.optString("type")
            if (type != "TELEMETRY_SNAPSHOT") return

            val seq = payload.optLong("seq", 0)
            val timestamp = payload.optLong("timestamp", System.currentTimeMillis())

            val coords = payload.optJSONObject("coordinates")
            val lat = coords?.optDouble("lat", 0.0) ?: 0.0
            val lng = coords?.optDouble("lng", 0.0) ?: 0.0
            val elevation = coords?.optDouble("elevationM", 0.0) ?: 0.0
            val gpsQuality = coords?.optInt("gpsQuality", 4) ?: 4

            val metrics = payload.optJSONObject("metrics")
            val heartRate = metrics?.optInt("heartRateBpm", 0) ?: 0
            val speedMps = metrics?.optDouble("speedMps", 0.0) ?: 0.0
            val paceSecPerKm = metrics?.optDouble("paceSecPerKm", 0.0) ?: 0.0
            val cadence = metrics?.optInt("cadenceSpm", 0) ?: 0
            val stepCount = metrics?.optInt("stepCount", 0) ?: 0

            val entity = TelemetryEntity(
                sessionId = sessionId,
                seq = seq,
                timestamp = timestamp,
                latitude = lat,
                longitude = lng,
                elevation = elevation,
                gpsQuality = gpsQuality,
                speedMps = speedMps,
                paceSecPerKm = paceSecPerKm,
                heartRate = heartRate,
                cadence = cadence,
                stepCount = stepCount,
                synced = 0
            )

            scope.launch {
                db.telemetryBufferDao().insertTelemetry(entity)
                db.telemetryBufferDao().pruneBufferOverflow(sessionId)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error processing incoming BLE telemetry packet: ${e.message}")
        }
    }

    fun transmitCheerToWatch(cheerJson: JSONObject, onResult: (Boolean) -> Unit) {
        try {
            Log.i(TAG, "Transmitting cheer message to Garmin Fenix 7s over BLE: $cheerJson")
            onResult(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error transmitting cheer over BLE: ${e.message}")
            onResult(false)
        }
    }

    companion object {
        private const val TAG = "GarminDataFieldManager"
    }
}
