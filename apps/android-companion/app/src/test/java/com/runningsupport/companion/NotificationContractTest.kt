package com.runningsupport.companion

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationContractTest {

    @Test
    fun testDispatchCheerPayloadCompliance() {
        val json = JSONObject().apply {
            put("type", "DISPATCH_CHEER")
            put("notificationId", "e305e91e-089c-4bf0-baec-2c1bbbe178a9")
            put("sessionId", "b47c9431-7e53-488b-a81d-8472506e9021")
            put("spectatorPin", "4829")
            put("senderName", "Laura")
            put("presetId", "TU_PUEDES")
            put("body", "¡Tú puedes!")
            put("ttlSeconds", 60)
        }

        assertEquals("DISPATCH_CHEER", json.getString("type"))
        assertEquals("4829", json.getString("spectatorPin"))
        assertTrue(json.getString("body").length <= 50)
    }

    @Test
    fun testCheerStatusEventCompliance() {
        val json = JSONObject().apply {
            put("type", "CHEER_STATUS_UPDATE")
            put("notificationId", "e305e91e-089c-4bf0-baec-2c1bbbe178a9")
            put("sessionId", "b47c9431-7e53-488b-a81d-8472506e9021")
            put("status", "AGRADECIDO")
            put("runnerReplyText", "Víctor te lo agradece")
            put("timestamp", System.currentTimeMillis())
        }

        assertEquals("CHEER_STATUS_UPDATE", json.getString("type"))
        assertEquals("AGRADECIDO", json.getString("status"))
        assertEquals("Víctor te lo agradece", json.getString("runnerReplyText"))
    }
}
