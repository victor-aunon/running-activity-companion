package com.runningsupport.companion

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TelemetryContractTest {

    @Test
    fun testTelemetryPacketSerializationAgainstSchema() {
        val json = JSONObject().apply {
            put("type", "TELEMETRY_SNAPSHOT")
            put("sessionId", "550e8400-e29b-41d4-a716-446655440000")
            put("seq", 1)
            put("timestamp", System.currentTimeMillis())

            val coords = JSONObject().apply {
                put("lat", 40.416775)
                put("lng", -3.703790)
                put("elevationM", 654.2)
                put("gpsQuality", 4)
            }
            put("coordinates", coords)

            val metrics = JSONObject().apply {
                put("heartRateBpm", 158)
                put("speedMps", 3.70)
                put("paceSecPerKm", 270.2)
                put("cadenceSpm", 176)
                put("stepCount", 230)
                put("totalDistanceM", 525.4)
                put("elapsedSeconds", 142)
            }
            put("metrics", metrics)

            val deviceHealth = JSONObject().apply {
                put("watchBatteryPct", 88)
                put("phoneBatteryPct", 74)
                put("bleRssi", -65)
            }
            put("deviceHealth", deviceHealth)
        }

        assertEquals("TELEMETRY_SNAPSHOT", json.getString("type"))
        assertTrue(json.has("sessionId"))
        assertTrue(json.getJSONObject("coordinates").getInt("gpsQuality") in 0..4)
        assertTrue(json.getJSONObject("metrics").getInt("heartRateBpm") in 0..250)
    }

    @Test
    fun testGarminPayloadParsesTotalDistanceM() {
        val json = JSONObject().apply {
            put("type", "TELEMETRY_SNAPSHOT")
            put("seq", 100)
            put("timestamp", 1700000000000L)
            put("metrics", JSONObject().apply {
                put("heartRateBpm", 152)
                put("speedMps", 3.4)
                put("totalDistanceM", 5230.5)
                put("elapsedSeconds", 1540L)
            })
        }
        val dist = json.optJSONObject("metrics")?.optDouble("totalDistanceM", 0.0) ?: 0.0
        val elapsed = json.optJSONObject("metrics")?.optLong("elapsedSeconds", 0L) ?: 0L
        assertEquals(5230.5, dist, 0.01)
        assertEquals(1540L, elapsed)
    }
}
