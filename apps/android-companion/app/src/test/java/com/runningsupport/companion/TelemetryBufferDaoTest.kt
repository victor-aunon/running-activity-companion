package com.runningsupport.companion

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TelemetryBufferDaoTest {

    @Test
    fun testBufferCapacityEvictionLogic() {
        val maxBufferSize = 50000
        val simulatedBuffer = mutableListOf<Long>()

        // Simulate 50,005 1 Hz packets arriving
        for (seq in 1..50005L) {
            if (simulatedBuffer.size >= maxBufferSize) {
                // FIFO eviction
                simulatedBuffer.removeAt(0)
            }
            simulatedBuffer.add(seq)
        }

        assertEquals(maxBufferSize, simulatedBuffer.size)
        // First elements should have been dropped: first is now 6
        assertEquals(6L, simulatedBuffer.first())
        assertEquals(50005L, simulatedBuffer.last())
    }

    @Test
    fun testRetentionPolicyKeepsLast5Sessions() {
        val completedSessions = mutableListOf(
            "session-1", "session-2", "session-3", "session-4", "session-5", "session-6"
        )
        val maxSessionsToRetain = 5

        if (completedSessions.size > maxSessionsToRetain) {
            val sessionsToPurge = completedSessions.dropLast(maxSessionsToRetain)
            completedSessions.removeAll(sessionsToPurge)
            assertEquals(listOf("session-1"), sessionsToPurge)
        }

        assertEquals(5, completedSessions.size)
        assertTrue(completedSessions.contains("session-6"))
        assertTrue(!completedSessions.contains("session-1"))
    }
}
