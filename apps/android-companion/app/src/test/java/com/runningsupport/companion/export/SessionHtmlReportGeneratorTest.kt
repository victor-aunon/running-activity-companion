package com.runningsupport.companion.export

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SessionHtmlReportGeneratorTest {

    @Test
    fun testGenerateHtml_ContainsBentoHeaderAndTimeline() {
        val summary = SessionSummaryData(
            sessionId = "maraton-valencia",
            athleteName = "Víctor",
            status = "COMPLETED",
            startedAt = 1793100000000L,
            endedAt = 1793106000000L,
            totalDistanceM = 21097.0,
            elapsedSeconds = 5940L,
            startGps = GpsCoordinate(39.4699, -0.3763),
            endGps = GpsCoordinate(39.4750, -0.3600),
            cheers = listOf(
                TimelineCheer(
                    senderName = "Elena",
                    body = "¡A tope!",
                    status = "AGRADECIDO",
                    runnerReplyText = "Víctor te lo agradece",
                    receivedAt = 1793102000000L,
                    kmMark = 7.5,
                    elapsedSeconds = 2000L
                )
            )
        )

        val html = SessionHtmlReportGenerator.generateHtml(summary)

        assertTrue(html.contains("<!DOCTYPE html>"))
        assertTrue(html.contains("Víctor"))
        assertTrue(html.contains("#maraton-valencia"))
        assertTrue(html.contains("21.10"))
        assertTrue(html.contains("39.4699, -0.3763"))
        assertTrue(html.contains("39.4750, -0.3600"))
        assertTrue(html.contains("KM 7.5"))
        assertTrue(html.contains("Elena"))
        assertTrue(html.contains("¡A tope!"))
        assertTrue(html.contains("Víctor te lo agradece"))
        assertTrue(html.contains("<style>"))
        assertTrue(html.contains("FINALIZADA"))
    }

    @Test
    fun testGenerateHtml_ZeroCheers_RendersEmptyMessageGracefully() {
        val summary = SessionSummaryData(
            sessionId = "sesion-vacia",
            athleteName = "Víctor",
            status = "COMPLETED",
            startedAt = 1000L,
            endedAt = 2000L,
            totalDistanceM = 5000.0,
            elapsedSeconds = 1500L,
            startGps = null,
            endGps = null,
            cheers = emptyList()
        )

        val html = SessionHtmlReportGenerator.generateHtml(summary)

        assertTrue(html.contains("Carrera completada sin ánimos registrados"))
        assertTrue(html.contains("No disponible"))
    }

    @Test
    fun testGenerateHtml_ActiveSession_ShowsEnCurso() {
        val summary = SessionSummaryData(
            sessionId = "sesion-activa",
            athleteName = "Víctor",
            status = "ACTIVE",
            startedAt = 1000L,
            endedAt = null,
            totalDistanceM = 3000.0,
            elapsedSeconds = 900L,
            startGps = GpsCoordinate(39.4699, -0.3763),
            endGps = GpsCoordinate(39.4710, -0.3750),
            cheers = emptyList()
        )

        val html = SessionHtmlReportGenerator.generateHtml(summary)

        assertTrue(html.contains("EN CURSO"))
        assertTrue(html.contains("Última posición"))
    }

    @Test
    fun testGenerateHtml_XssSanitization() {
        val summary = SessionSummaryData(
            sessionId = "xss-test",
            athleteName = "<script>alert('atleta')</script>",
            status = "COMPLETED",
            startedAt = 1000L,
            endedAt = 2000L,
            totalDistanceM = 1000.0,
            elapsedSeconds = 300L,
            startGps = null,
            endGps = null,
            cheers = listOf(
                TimelineCheer(
                    senderName = "<b>Hacker</b>",
                    body = "<img src=x onerror=alert(1)>",
                    status = "ENVIADO",
                    runnerReplyText = null,
                    receivedAt = 1500L,
                    kmMark = 0.5,
                    elapsedSeconds = 150L
                )
            )
        )

        val html = SessionHtmlReportGenerator.generateHtml(summary)

        assertFalse(html.contains("<script>"))
        assertTrue(html.contains("&lt;script&gt;"))
        assertFalse(html.contains("<img src=x"))
        assertTrue(html.contains("&lt;img src=x"))
    }
}
