package com.runningsupport.companion.data.entities

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

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
)
