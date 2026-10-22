package com.runningsupport.companion.garmin

import kotlinx.coroutines.*
import org.json.JSONObject

class MockTelemetryDataSource(
    private val onSnapshotGenerated: (JSONObject) -> Unit
) {
    private var job: Job? = null
    private var seq = 0L

    fun start(scope: CoroutineScope) {
        stop()
        job = scope.launch {
            while (isActive) {
                delay(1000)
                seq++
                val snapshot = JSONObject().apply {
                    put("type", "TELEMETRY_SNAPSHOT")
                    put("seq", seq)
                    put("timestamp", System.currentTimeMillis())

                    val coords = JSONObject().apply {
                        put("lat", 40.4168 + (seq * 0.0001))
                        put("lng", -3.7038 + (seq * 0.0001))
                        put("elevationM", 650.0)
                        put("gpsQuality", 4)
                    }
                    put("coordinates", coords)

                    val metrics = JSONObject().apply {
                        put("heartRateBpm", 155 + (seq % 15).toInt())
                        put("speedMps", 3.70)
                        put("paceSecPerKm", 270.0)
                        put("cadenceSpm", 176)
                        put("stepCount", (seq * 3).toInt())
                        put("totalDistanceM", seq * 3.7)
                        put("elapsedSeconds", seq)
                    }
                    put("metrics", metrics)

                    val health = JSONObject().apply {
                        put("watchBatteryPct", 85)
                        put("phoneBatteryPct", 75)
                        put("bleRssi", -60)
                    }
                    put("deviceHealth", health)
                }

                onSnapshotGenerated(snapshot)
            }
        }
    }

    fun stop() {
        job?.cancel()
        job = null
    }
}
