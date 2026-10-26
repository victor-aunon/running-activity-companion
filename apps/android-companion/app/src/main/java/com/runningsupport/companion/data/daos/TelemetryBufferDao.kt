package com.runningsupport.companion.data.daos

import androidx.room.*
import com.runningsupport.companion.data.entities.SessionEntity
import com.runningsupport.companion.data.entities.TelemetryEntity

@Dao
interface TelemetryBufferDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSession(session: SessionEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTelemetry(telemetry: TelemetryEntity): Long

    @Query("SELECT * FROM telemetry_buffer WHERE sessionId = :sessionId AND synced = 0 ORDER BY seq ASC LIMIT :limit")
    suspend fun getUnsyncedPackets(sessionId: String, limit: Int = 50): List<TelemetryEntity>

    @Query("SELECT * FROM telemetry_buffer WHERE sessionId = :sessionId AND synced = 0 ORDER BY seq ASC LIMIT :limit")
    suspend fun getUnsyncedTelemetry(sessionId: String, limit: Int = 50): List<TelemetryEntity>

    @Query("UPDATE telemetry_buffer SET synced = 1 WHERE id IN (:ids)")
    suspend fun markSynced(ids: List<Long>)

    @Query("SELECT COUNT(*) FROM telemetry_buffer WHERE sessionId = :sessionId AND synced = 0")
    suspend fun getUnsyncedCount(sessionId: String): Int

    // FIFO Eviction when buffer exceeds 50,000 records
    @Query("""
        DELETE FROM telemetry_buffer 
        WHERE id IN (
            SELECT id FROM telemetry_buffer 
            WHERE sessionId = :sessionId AND synced = 0 
            ORDER BY seq ASC 
            LIMIT CASE 
                WHEN (SELECT COUNT(*) FROM telemetry_buffer WHERE sessionId = :sessionId AND synced = 0) > 50000 
                THEN (SELECT COUNT(*) FROM telemetry_buffer WHERE sessionId = :sessionId AND synced = 0) - 50000 
                ELSE 0 
            END
        )
    """)
    suspend fun pruneBufferOverflow(sessionId: String)

    // Retention policy: Keep only last 5 completed sessions and cascade purge older
    @Query("""
        DELETE FROM workout_sessions 
        WHERE status = 'COMPLETED' 
        AND sessionId NOT IN (
            SELECT sessionId FROM workout_sessions 
            WHERE status = 'COMPLETED' 
            ORDER BY endedAt DESC 
            LIMIT 5
        )
    """)
    suspend fun pruneOldSessions()
}
