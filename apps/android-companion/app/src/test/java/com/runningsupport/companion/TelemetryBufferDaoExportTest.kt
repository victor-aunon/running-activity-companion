package com.runningsupport.companion

import com.runningsupport.companion.data.entities.SessionEntity
import com.runningsupport.companion.data.entities.TelemetryEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class TelemetryBufferDaoExportTest {

    @Test
    fun testTelemetryEntity_CarriesDistanceM() {
        val telemetry = TelemetryEntity(
            sessionId = "carrera-1",
            seq = 10,
            timestamp = 1700000000000L,
            latitude = 39.4699,
            longitude = -0.3763,
            elevation = 15.0,
            speedMps = 3.5,
            paceSecPerKm = 285.0,
            heartRate = 145,
            cadence = 175,
            distanceM = 5230.5
        )

        assertEquals("carrera-1", telemetry.sessionId)
        assertEquals(5230.5, telemetry.distanceM, 0.001)
        assertEquals(39.4699, telemetry.latitude, 0.0001)
        assertEquals(-0.3763, telemetry.longitude, 0.0001)

        val json = telemetry.toJsonObject()
        assertNotNull(json)
        assertEquals(5230.5, json.getJSONObject("metrics").getDouble("totalDistanceM"), 0.001)
    }

    @Test
    fun testSessionEntity_CarriesMetricsForSummary() {
        val session = SessionEntity(
            sessionId = "carrera-1",
            shareableToken = "tok-1",
            spectatorPin = "4829",
            athleteName = "Víctor",
            status = "COMPLETED",
            startedAt = 1000L,
            endedAt = 5000L,
            totalDistanceM = 10500.0,
            elapsedSeconds = 2500L
        )

        assertEquals("Víctor", session.athleteName)
        assertEquals("COMPLETED", session.status)
        assertEquals(10500.0, session.totalDistanceM, 0.001)
        assertEquals(2500L, session.elapsedSeconds)
    }
}
