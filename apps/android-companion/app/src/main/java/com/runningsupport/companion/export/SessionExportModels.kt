package com.runningsupport.companion.export

import java.util.Locale

data class GpsCoordinate(
    val lat: Double,
    val lng: Double
) {
    fun toFormattedString(): String {
        return String.format(Locale.US, "%.4f, %.4f", lat, lng)
    }
}

data class TimelineCheer(
    val senderName: String,
    val body: String,
    val status: String, // ENVIADO, EN_RELOJ, AGRADECIDO, EXPIRADO
    val runnerReplyText: String? = null,
    val receivedAt: Long,
    val kmMark: Double,
    val elapsedSeconds: Long
) {
    val formattedKm: String
        get() = String.format(Locale.US, "KM %.1f", kmMark)

    val formattedElapsed: String
        get() {
            val minutes = elapsedSeconds / 60
            val seconds = elapsedSeconds % 60
            return String.format(Locale.US, "%02d:%02d", minutes, seconds)
        }
}

data class SessionSummaryData(
    val sessionId: String,
    val athleteName: String,
    val status: String, // ACTIVE, COMPLETED, etc.
    val startedAt: Long,
    val endedAt: Long? = null,
    val totalDistanceM: Double = 0.0,
    val elapsedSeconds: Long = 0,
    val startGps: GpsCoordinate? = null,
    val endGps: GpsCoordinate? = null,
    val cheers: List<TimelineCheer> = emptyList()
) {
    val totalDistanceKm: Double
        get() = totalDistanceM / 1000.0

    val avgPaceSecPerKm: Double
        get() = if (totalDistanceKm > 0.05 && elapsedSeconds > 0) {
            elapsedSeconds / totalDistanceKm
        } else {
            0.0
        }

    val formattedPace: String
        get() {
            if (avgPaceSecPerKm <= 0.0) return "--:--"
            val totalSec = avgPaceSecPerKm.toInt()
            val m = totalSec / 60
            val s = totalSec % 60
            return String.format(Locale.US, "%d:%02d", m, s)
        }

    val formattedDuration: String
        get() {
            val hrs = elapsedSeconds / 3600
            val mins = (elapsedSeconds % 3600) / 60
            val secs = elapsedSeconds % 60
            return String.format(Locale.US, "%02d:%02d:%02d", hrs, mins, secs)
        }
}
