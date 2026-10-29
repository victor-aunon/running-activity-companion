package com.runningsupport.companion.export

import com.runningsupport.companion.data.daos.CheerDao
import com.runningsupport.companion.data.daos.TelemetryBufferDao
import com.runningsupport.companion.data.entities.CheerEntity
import com.runningsupport.companion.data.entities.SessionEntity
import com.runningsupport.companion.data.entities.TelemetryEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class SessionExportManagerTest {

    private lateinit var fakeTelemetryDao: FakeTelemetryBufferDao
    private lateinit var fakeCheerDao: FakeCheerDao
    private lateinit var manager: SessionExportManager

    class FakeTelemetryBufferDao : TelemetryBufferDao {
        var session: SessionEntity? = null
        val telemetries = mutableListOf<TelemetryEntity>()

        override suspend fun insertSession(session: SessionEntity): Long {
            this.session = session
            return 1L
        }
        override suspend fun insertTelemetry(telemetry: TelemetryEntity): Long {
            telemetries.add(telemetry)
            return telemetries.size.toLong()
        }
        override suspend fun getUnsyncedPackets(sessionId: String, limit: Int): List<TelemetryEntity> = emptyList()
        override suspend fun getUnsyncedTelemetry(sessionId: String, limit: Int): List<TelemetryEntity> = emptyList()
        override suspend fun markSynced(ids: List<Long>) {}
        override suspend fun getUnsyncedCount(sessionId: String): Int = 0
        override fun observeUnsyncedCount(sessionId: String): Flow<Int> = flowOf(0)
        override suspend fun pruneBufferOverflow(sessionId: String) {}
        override suspend fun pruneOldSessions() {}

        override suspend fun getSession(sessionId: String): SessionEntity? = session
        override suspend fun getLatestSession(): SessionEntity? = session
        override suspend fun getFirstValidGpsPoint(sessionId: String): TelemetryEntity? =
            telemetries.firstOrNull { it.latitude != 0.0 || it.longitude != 0.0 }
        override suspend fun getLastValidGpsPoint(sessionId: String): TelemetryEntity? =
            telemetries.lastOrNull { it.latitude != 0.0 || it.longitude != 0.0 }
        override suspend fun getAllTelemetryOrdered(sessionId: String): List<TelemetryEntity> =
            telemetries.sortedBy { it.timestamp }
        override suspend fun updateSessionSummary(
            sessionId: String, status: String, endedAt: Long?, totalDistanceM: Double, elapsedSeconds: Long
        ) {
            session = session?.copy(
                status = status, endedAt = endedAt, totalDistanceM = totalDistanceM, elapsedSeconds = elapsedSeconds
            )
        }
        override suspend fun resetSession(
            sessionId: String, token: String, pin: String, athleteName: String, status: String, startedAt: Long
        ) {
            session = session?.copy(
                sessionId = sessionId, shareableToken = token, spectatorPin = pin,
                athleteName = athleteName, status = status, startedAt = startedAt
            )
        }
    }

    class FakeCheerDao : CheerDao {
        val cheers = mutableListOf<CheerEntity>()

        override suspend fun insertCheer(cheer: CheerEntity) { cheers.add(cheer) }
        override suspend fun updateCheer(cheer: CheerEntity) {}
        override suspend fun getCheersForSession(sessionId: String): List<CheerEntity> = cheers
        override suspend fun getCheersReceivedSince(sinceTimestamp: Long): List<CheerEntity> =
            cheers.filter { it.receivedAt >= sinceTimestamp }
        override suspend fun getAllRecentCheers(): List<CheerEntity> = cheers
        override suspend fun updateStatus(notificationId: String, status: String, replyText: String?) {}
        override suspend fun expireInFlightCheersOnSessionCompleted(sessionId: String) {}
    }

    @Before
    fun setup() {
        fakeTelemetryDao = FakeTelemetryBufferDao()
        fakeCheerDao = FakeCheerDao()
        manager = SessionExportManager(
            context = null,
            telemetryDao = fakeTelemetryDao,
            cheerDao = fakeCheerDao
        )
    }

    @Test
    fun testBuildSessionSummary_MapsCheersToTelemetryKmAndElapsed() = runBlocking {
        val sId = "carrera-test"
        fakeTelemetryDao.insertSession(
            SessionEntity(
                sessionId = sId,
                shareableToken = "tok",
                spectatorPin = "4829",
                athleteName = "Víctor",
                status = "COMPLETED",
                startedAt = 10000L,
                endedAt = 70000L,
                totalDistanceM = 10000.0,
                elapsedSeconds = 3600L
            )
        )

        // Telemetría de inicio (km 0.1)
        fakeTelemetryDao.insertTelemetry(
            TelemetryEntity(
                sessionId = sId, seq = 1, timestamp = 10000L,
                latitude = 39.4699, longitude = -0.3763, elevation = 10.0,
                speedMps = 3.0, paceSecPerKm = 333.0, heartRate = 140, cadence = 170,
                distanceM = 100.0
            )
        )
        // Telemetría a mitad de camino (km 5.0)
        fakeTelemetryDao.insertTelemetry(
            TelemetryEntity(
                sessionId = sId, seq = 20, timestamp = 35000L,
                latitude = 39.4720, longitude = -0.3700, elevation = 12.0,
                speedMps = 3.2, paceSecPerKm = 312.0, heartRate = 155, cadence = 175,
                distanceM = 5000.0
            )
        )

        // Ánimo recibido a los 36000L (cerca de km 5.0)
        fakeCheerDao.insertCheer(
            CheerEntity(
                notificationId = "cheer-1", sessionId = sId, senderName = "Carlos",
                presetId = "VAMOS", body = "¡Fuerza!", status = "ENVIADO",
                receivedAt = 36000L, expiresAt = 90000L
            )
        )

        val summary = manager.buildSessionSummary(sId)
        assertNotNull(summary)
        val validSummary = summary!!
        assertEquals("Víctor", validSummary.athleteName)
        assertEquals(1, validSummary.cheers.size)
        // El km asignado al ánimo debe ser aproximadamente 5.0
        assertEquals(5.0, validSummary.cheers[0].kmMark, 0.2)
        assertEquals(26L, validSummary.cheers[0].elapsedSeconds) // 36000 - 10000 = 26000ms = 26s
    }

    @Test
    fun testBuildSessionSummary_ActiveSession_CalculatesEffectiveDistanceAndElapsedFromTelemetry() = runBlocking {
        val sId = "carrera-activa"
        val startTime = System.currentTimeMillis() - 60000L // Hace 60 segundos
        fakeTelemetryDao.insertSession(
            SessionEntity(
                sessionId = sId,
                shareableToken = "tok",
                spectatorPin = "4829",
                athleteName = "Víctor",
                status = "ACTIVE",
                startedAt = startTime,
                endedAt = null,
                totalDistanceM = 0.0, // Aún no actualizado en la entidad
                elapsedSeconds = 0L
            )
        )

        fakeTelemetryDao.insertTelemetry(
            TelemetryEntity(
                sessionId = sId, seq = 1, timestamp = startTime,
                latitude = 39.4699, longitude = -0.3763, elevation = 10.0,
                gpsQuality = 4,
                speedMps = 3.2, paceSecPerKm = 312.0, heartRate = 145, cadence = 175,
                distanceM = 1500.0
            )
        )

        val summary = manager.buildSessionSummary(sId)
        assertNotNull(summary)
        assertEquals("ACTIVE", summary?.status)
        // La distancia no debe ser 0.0, debe tomar la telemetría más reciente (1500m = 1.5km)
        assertEquals(1500.0, summary!!.totalDistanceM, 0.001)
        assertTrue("Elapsed seconds debe ser > 0", summary.elapsedSeconds >= 50L)
    }
}
