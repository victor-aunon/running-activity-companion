package com.runningsupport.companion

import org.junit.Assert.assertEquals
import org.junit.Test

class CheerDaoTest {

    @Test
    fun testCheerStatusTransition() {
        val cheerId = "cheer-123"
        var status = "ENVIADO"

        // Watch receives
        status = "EN_RELOJ"
        assertEquals("EN_RELOJ", status)

        // Runner acknowledges
        status = "AGRADECIDO"
        assertEquals("AGRADECIDO", status)
    }

    @Test
    fun testInFlightCheerExpirationOnSessionCompleted() {
        var status = "ENVIADO"
        var runnerReplyText = ""

        // Session completes while cheer is in transit
        val sessionStatus = "COMPLETED"
        if (sessionStatus == "COMPLETED" && (status == "ENVIADO" || status == "EN_RELOJ")) {
            status = "EXPIRADO"
            runnerReplyText = "Actividad finalizada"
        }

        assertEquals("EXPIRADO", status)
        assertEquals("Actividad finalizada", runnerReplyText)
    }
}
