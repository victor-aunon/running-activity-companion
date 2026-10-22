package com.runningsupport.companion.data.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "workout_sessions")
data class SessionEntity(
    @PrimaryKey
    val sessionId: String,
    val shareableToken: String,
    val spectatorPin: String,
    val athleteName: String,
    val status: String, // INITIALIZING, ACTIVE, PAUSED, COMPLETED, INTERRUPTED
    val startedAt: Long,
    val endedAt: Long? = null,
    val totalDistanceM: Double = 0.0,
    val elapsedSeconds: Long = 0,
    val createdAt: Long = System.currentTimeMillis()
)
