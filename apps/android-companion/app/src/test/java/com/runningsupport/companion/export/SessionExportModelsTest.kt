package com.runningsupport.companion.export

import org.junit.Assert.assertEquals
import org.junit.Test

class SessionExportModelsTest {

    @Test
    fun testSessionSummaryData_PaceAndKmCalculations() {
        val summary = SessionSummaryData(
            sessionId = "carrera-1",
            athleteName = "Víctor",
            status = "COMPLETED",
            startedAt = 1000L,
            endedAt = 4600L,
            totalDistanceM = 10000.0,
            elapsedSeconds = 3600L,
            startGps = GpsCoordinate(39.4699, -0.3763),
            endGps = GpsCoordinate(39.4750, -0.3600),
            cheers = listOf(
                TimelineCheer(
                    senderName = "Elena",
                    body = "¡Vamos!",
                    status = "AGRADECIDO",
                    runnerReplyText = "Gracias",
                    receivedAt = 2500L,
                    kmMark = 5.2,
                    elapsedSeconds = 1500L
                )
            )
        )

        assertEquals(10.0, summary.totalDistanceKm, 0.01)
        assertEquals(360.0, summary.avgPaceSecPerKm, 0.01) // 3600s / 10km = 360 s/km (6:00 min/km)
        assertEquals("6:00", summary.formattedPace)
        assertEquals("01:00:00", summary.formattedDuration)
        assertEquals(1, summary.cheers.size)
    }

    @Test
    fun testSessionSummaryData_ZeroDistanceSafePace() {
        val summary = SessionSummaryData(
            sessionId = "carrera-cero",
            athleteName = "Víctor",
            status = "COMPLETED",
            startedAt = 1000L,
            endedAt = 1000L,
            totalDistanceM = 0.0,
            elapsedSeconds = 0L,
            startGps = null,
            endGps = null,
            cheers = emptyList()
        )

        assertEquals(0.0, summary.totalDistanceKm, 0.001)
        assertEquals(0.0, summary.avgPaceSecPerKm, 0.001)
        assertEquals("--:--", summary.formattedPace)
        assertEquals("00:00:00", summary.formattedDuration)
    }

    @Test
    fun testTimelineCheer_FormattedElapsedFormat() {
        val cheerUnderHour = TimelineCheer(
            senderName = "Marta",
            body = "¡Fuerza!",
            status = "AGRADECIDO",
            receivedAt = 1000L,
            kmMark = 2.0,
            elapsedSeconds = 875L // 14 min 35 sec
        )
        assertEquals("14:35", cheerUnderHour.formattedElapsed)

        val cheerOverHour = TimelineCheer(
            senderName = "Marta",
            body = "¡Sprint final!",
            status = "EXPIRADO",
            receivedAt = 1000L,
            kmMark = 18.0,
            elapsedSeconds = 3905L // 1h 05 min 05 sec
        )
        assertEquals("01:05:05", cheerOverHour.formattedElapsed)
    }
}
