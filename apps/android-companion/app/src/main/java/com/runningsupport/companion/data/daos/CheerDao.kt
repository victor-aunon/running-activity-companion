package com.runningsupport.companion.data.daos

import androidx.room.*
import com.runningsupport.companion.data.entities.CheerEntity

@Dao
interface CheerDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCheer(cheer: CheerEntity)

    @Update
    suspend fun updateCheer(cheer: CheerEntity)

    @Query("SELECT * FROM cheer_notifications WHERE sessionId = :sessionId ORDER BY receivedAt DESC")
    suspend fun getCheersForSession(sessionId: String): List<CheerEntity>

    @Query("UPDATE cheer_notifications SET status = :status, runnerReplyText = :replyText WHERE notificationId = :notificationId")
    suspend fun updateStatus(notificationId: String, status: String, replyText: String? = null)

    @Query("UPDATE cheer_notifications SET status = 'EXPIRADO', runnerReplyText = 'Actividad finalizada' WHERE sessionId = :sessionId AND status IN ('ENVIADO', 'EN_RELOJ')")
    suspend fun expireInFlightCheersOnSessionCompleted(sessionId: String)
}
