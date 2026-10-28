package com.runningsupport.companion.export

import com.runningsupport.companion.data.entities.CheerEntity
import com.runningsupport.companion.data.entities.SessionEntity
import com.runningsupport.companion.data.entities.TelemetryEntity
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SessionExportEndToEndTest {

    @Test
    fun testCompleteExportPipeline_GeneratesValidHtmlWithPaceAndCheers() = runBlocking {
        val sId = "maraton-valencia-2026"
        val fakeTelemetryDao = SessionExportManagerTest.FakeTelemetryBufferDao()
        val fakeCheerDao = SessionExportManagerTest.FakeCheerDao()

        // 1. Sesión completada: 21.097 km en 1h 39m 15s (5955s)
        fakeTelemetryDao.insertSession(
            SessionEntity(
                sessionId = sId,
                shareableToken = "tok-valencia",
                spectatorPin = "4829",
                athleteName = "Víctor",
                status = "COMPLETED",
                startedAt = 1793100000000L,
                endedAt = 1793105955000L,
                totalDistanceM = 21097.0,
                elapsedSeconds = 5955L
            )
        )

        // 2. Puntos GPS de inicio (km 0.0), intermedio (km 10.5) y meta (km 21.1)
        fakeTelemetryDao.insertTelemetry(
            TelemetryEntity(
                sessionId = sId, seq = 1, timestamp = 1793100000000L,
                latitude = 39.4699, longitude = -0.3763, elevation = 12.0,
                speedMps = 3.5, paceSecPerKm = 285.0, heartRate = 145, cadence = 175,
                distanceM = 10.0
            )
        )
        fakeTelemetryDao.insertTelemetry(
            TelemetryEntity(
                sessionId = sId, seq = 100, timestamp = 1793103000000L,
                latitude = 39.4750, longitude = -0.3600, elevation = 15.0,
                speedMps = 3.55, paceSecPerKm = 281.0, heartRate = 160, cadence = 178,
                distanceM = 10500.0
            )
        )
        fakeTelemetryDao.insertTelemetry(
            TelemetryEntity(
                sessionId = sId, seq = 200, timestamp = 1793105955000L,
                latitude = 39.4810, longitude = -0.3450, elevation = 14.0,
                speedMps = 3.6, paceSecPerKm = 277.0, heartRate = 170, cadence = 182,
                distanceM = 21097.0
            )
        )

        // 3. Dos ánimos: uno enviado y otro agradecido desde el reloj
        fakeCheerDao.insertCheer(
            CheerEntity(
                notificationId = "cheer-1", sessionId = sId, senderName = "Carlos",
                presetId = "FUERZA", body = "¡Ritmo impecable Víctor!", status = "ENVIADO",
                receivedAt = 1793101500000L, expiresAt = 1793110000000L
            )
        )
        fakeCheerDao.insertCheer(
            CheerEntity(
                notificationId = "cheer-2", sessionId = sId, senderName = "Elena",
                presetId = "ANIMO", body = "¡Ya estás en meta casi!", status = "AGRADECIDO",
                runnerReplyText = "Víctor te lo agradece",
                receivedAt = 1793105000000L, expiresAt = 1793110000000L
            )
        )

        // 4. Ejecución del pipeline de exportación
        val manager = SessionExportManager(
            context = null,
            telemetryDao = fakeTelemetryDao,
            cheerDao = fakeCheerDao
        )

        val summary = manager.buildSessionSummary(sId)
        assertNotNull(summary)
        val html = SessionHtmlReportGenerator.generateHtml(summary!!)

        // Verificaciones del reporte HTML
        assertTrue("Debe contener Doctype HTML5", html.contains("<!DOCTYPE html>"))
        assertTrue("Debe incluir el atleta Víctor", html.contains("Víctor"))
        assertTrue("Debe incluir el id de sesión", html.contains("#maraton-valencia-2026"))
        assertTrue("Debe incluir la distancia de 21.10 km", html.contains("21.10"))
        assertTrue("Debe calcular y mostrar el ritmo medio (4:42 /km)", html.contains("4:42"))
        assertTrue("Debe mostrar coordenadas de salida", html.contains("39.4699, -0.3763"))
        assertTrue("Debe mostrar coordenadas de meta", html.contains("39.4810, -0.3450"))
        assertTrue("Debe listar el ánimo de Carlos", html.contains("Carlos"))
        assertTrue("Debe listar el ánimo de Elena", html.contains("Elena"))
        assertTrue("Debe reflejar el estado agradecido", html.contains("Agradecido"))
        assertTrue("Debe reflejar el agradecimiento del corredor", html.contains("Víctor te lo agradece"))
        assertTrue("Debe incluir reglas de impresión @media print", html.contains("@media print"))
    }
}
