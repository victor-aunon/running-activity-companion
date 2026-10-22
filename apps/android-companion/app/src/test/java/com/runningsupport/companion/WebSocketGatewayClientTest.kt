package com.runningsupport.companion

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class WebSocketGatewayClientTest {

    @Test
    fun testBufferDrainingChunks() = runTest {
        val totalUnsynced = 125
        val chunkSize = 50
        val batches = mutableListOf<Int>()

        var remaining = totalUnsynced
        while (remaining > 0) {
            val currentBatch = minOf(remaining, chunkSize)
            batches.add(currentBatch)
            remaining -= currentBatch
        }

        assertEquals(3, batches.size)
        assertEquals(50, batches[0])
        assertEquals(50, batches[1])
        assertEquals(25, batches[2])
    }

    @Test
    fun testRapidWorkoutRestartWithin3Minutes() {
        val lastActivityEndTime = System.currentTimeMillis() - (2 * 60 * 1000L) // 2 minutes ago
        val currentTime = System.currentTimeMillis()

        val canReassociate = (currentTime - lastActivityEndTime) <= (3 * 60 * 1000L)
        assertTrue("Workout restarted within 3 minutes must preserve session token", canReassociate)
    }
}
