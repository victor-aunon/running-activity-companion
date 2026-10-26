package com.runningsupport.companion.data.entities

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import org.json.JSONObject

@Entity(
    tableName = "telemetry_buffer",
    foreignKeys = [
        ForeignKey(
            entity = SessionEntity::class,
            parentColumns = ["sessionId"],
            childColumns = ["sessionId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["sessionId", "synced", "seq"])
    ]
)
data class TelemetryEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val sessionId: String,
    val seq: Long,
    val timestamp: Long,
    val latitude: Double,
    val longitude: Double,
    val elevation: Double,
    val gpsQuality: Int = 4,
    val speedMps: Double,
    val paceSecPerKm: Double,
    val heartRate: Int,
    val cadence: Int,
    val stepCount: Int = 0,
    val synced: Int = 0 // 0 = unsynced, 1 = synced
) {
    fun toJsonObject(): JSONObject {
        return JSONObject().apply {
            put("type", "TELEMETRY_SNAPSHOT")
            put("sessionId", sessionId)
            put("seq", seq)
            put("timestamp", timestamp)
            put("coordinates", JSONObject().apply {
                put("lat", latitude)
                put("lng", longitude)
                put("elevationM", elevation)
                put("gpsQuality", gpsQuality)
            })
            put("metrics", JSONObject().apply {
                put("heartRateBpm", heartRate)
                put("speedMps", speedMps)
                put("paceSecPerKm", paceSecPerKm)
                put("cadenceSpm", cadence)
                put("stepCount", stepCount)
                put("totalDistanceM", seq * 3.7)
                put("elapsedSeconds", seq)
            })
            put("deviceHealth", JSONObject().apply {
                put("watchBatteryPct", 85)
                put("phoneBatteryPct", 80)
                put("bleRssi", -60)
            })
        }
    }
}
