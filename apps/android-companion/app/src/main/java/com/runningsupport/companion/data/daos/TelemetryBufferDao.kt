package com.runningsupport.companion.data.daos

import androidx.room.*
import com.runningsupport.companion.data.entities.SessionEntity
import com.runningsupport.companion.data.entities.TelemetryEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface TelemetryBufferDao {

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertSession(session: SessionEntity): Long

    @Query("UPDATE workout_sessions SET status = :status, startedAt = :startedAt, endedAt = null, shareableToken = :token, spectatorPin = :pin, athleteName = :athleteName WHERE sessionId = :sessionId")
    suspend fun resetSession(sessionId: String, token: String, pin: String, athleteName: String, status: String, startedAt: Long)

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

    @Query("SELECT COUNT(*) FROM telemetry_buffer WHERE sessionId = :sessionId AND synced = 0")
    fun observeUnsyncedCount(sessionId: String): Flow<Int>

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

    @Query("SELECT * FROM workout_sessions WHERE sessionId = :sessionId LIMIT 1")
    suspend fun getSession(sessionId: String): SessionEntity?

    @Query("SELECT * FROM workout_sessions ORDER BY startedAt DESC LIMIT 1")
    suspend fun getLatestSession(): SessionEntity?

    @Query("SELECT * FROM telemetry_buffer WHERE sessionId = :sessionId AND (latitude != 0.0 OR longitude != 0.0) AND gpsQuality > 0 ORDER BY timestamp ASC LIMIT 1")
    suspend fun getFirstValidGpsPoint(sessionId: String): TelemetryEntity?

    @Query("SELECT * FROM telemetry_buffer WHERE sessionId = :sessionId AND (latitude != 0.0 OR longitude != 0.0) AND gpsQuality > 0 ORDER BY timestamp DESC LIMIT 1")
    suspend fun getLastValidGpsPoint(sessionId: String): TelemetryEntity?

    @Query("SELECT * FROM telemetry_buffer WHERE sessionId = :sessionId ORDER BY timestamp ASC")
    suspend fun getAllTelemetryOrdered(sessionId: String): List<TelemetryEntity>

    @Query("UPDATE workout_sessions SET status = :status, endedAt = :endedAt, totalDistanceM = :totalDistanceM, elapsedSeconds = :elapsedSeconds WHERE sessionId = :sessionId")
    suspend fun updateSessionSummary(
        sessionId: String,
        status: String,
        endedAt: Long?,
        totalDistanceM: Double,
        elapsedSeconds: Long
    )
}
