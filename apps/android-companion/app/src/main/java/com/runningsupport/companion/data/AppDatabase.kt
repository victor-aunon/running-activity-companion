package com.runningsupport.companion.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.runningsupport.companion.data.daos.CheerDao
import com.runningsupport.companion.data.daos.TelemetryBufferDao
import com.runningsupport.companion.data.entities.CheerEntity
import com.runningsupport.companion.data.entities.SessionEntity
import com.runningsupport.companion.data.entities.TelemetryEntity

@Database(
    entities = [
        SessionEntity::class,
        TelemetryEntity::class,
        CheerEntity::class
    ],
    version = 2,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun telemetryBufferDao(): TelemetryBufferDao
    abstract fun cheerDao(): CheerDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "running_support_companion.db"
                )
                    .setJournalMode(JournalMode.WRITE_AHEAD_LOGGING) // SQLite WAL mode
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
