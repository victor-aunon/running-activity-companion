package com.runningsupport.companion.data.entities

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "cheer_notifications",
    indices = [
        Index(value = ["sessionId", "status"]),
        Index(value = ["receivedAt"])
    ]
)
data class CheerEntity(
    @PrimaryKey
    val notificationId: String,
    val sessionId: String,
    val senderName: String,
    val presetId: String,
    val body: String,
    val status: String, // ENVIADO, EN_RELOJ, AGRADECIDO, EXPIRADO
    val runnerReplyText: String? = null,
    val receivedAt: Long = System.currentTimeMillis(),
    val expiresAt: Long
)
