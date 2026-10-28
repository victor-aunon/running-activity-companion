package com.runningsupport.companion.export

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.runningsupport.companion.data.AppDatabase
import com.runningsupport.companion.data.daos.CheerDao
import com.runningsupport.companion.data.daos.TelemetryBufferDao
import com.runningsupport.companion.data.entities.TelemetryEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.abs

class SessionExportManager(
    private val context: Context?,
    private val telemetryDao: TelemetryBufferDao,
    private val cheerDao: CheerDao
) {
    constructor(context: Context, db: AppDatabase) : this(
        context,
        db.telemetryBufferDao(),
        db.cheerDao()
    )

    suspend fun buildSessionSummary(sessionId: String): SessionSummaryData? = withContext(Dispatchers.IO) {
        val session = telemetryDao.getSession(sessionId) ?: telemetryDao.getLatestSession() ?: return@withContext null
        val actualSessionId = session.sessionId

        val startGpsEntity = telemetryDao.getFirstValidGpsPoint(actualSessionId)
        val endGpsEntity = telemetryDao.getLastValidGpsPoint(actualSessionId)

        val startGps = startGpsEntity?.let { GpsCoordinate(it.latitude, it.longitude) }
        val endGps = endGpsEntity?.let { GpsCoordinate(it.latitude, it.longitude) }

        val allTelemetry = telemetryDao.getAllTelemetryOrdered(actualSessionId)
        val rawCheers = cheerDao.getCheersForSession(actualSessionId).sortedBy { it.receivedAt }

        val lastTelemetry = allTelemetry.lastOrNull()
        val effectiveDistanceM = if (session.totalDistanceM > 0.0) {
            session.totalDistanceM
        } else {
            lastTelemetry?.distanceM ?: 0.0
        }
        val effectiveElapsedSeconds = if (session.elapsedSeconds > 0) {
            session.elapsedSeconds
        } else {
            ((System.currentTimeMillis() - session.startedAt) / 1000L).coerceAtLeast(0L)
        }

        val timelineCheers = rawCheers.map { cheer ->
            val closestTelemetry = findClosestTelemetry(allTelemetry, cheer.receivedAt)
            val kmMark = if (closestTelemetry != null && closestTelemetry.distanceM > 0) {
                closestTelemetry.distanceM / 1000.0
            } else if (effectiveDistanceM > 0 && effectiveElapsedSeconds > 0) {
                val elapsedFrac = (cheer.receivedAt - session.startedAt).coerceAtLeast(0) / 1000.0
                (elapsedFrac * (effectiveDistanceM / effectiveElapsedSeconds)) / 1000.0
            } else {
                0.0
            }

            val elapsedSec = ((cheer.receivedAt - session.startedAt) / 1000L).coerceAtLeast(0L)

            TimelineCheer(
                senderName = cheer.senderName,
                body = cheer.body,
                status = cheer.status,
                runnerReplyText = cheer.runnerReplyText,
                receivedAt = cheer.receivedAt,
                kmMark = kmMark,
                elapsedSeconds = elapsedSec
            )
        }

        SessionSummaryData(
            sessionId = actualSessionId,
            athleteName = session.athleteName,
            status = session.status,
            startedAt = session.startedAt,
            endedAt = session.endedAt,
            totalDistanceM = effectiveDistanceM,
            elapsedSeconds = effectiveElapsedSeconds,
            startGps = startGps,
            endGps = endGps,
            cheers = timelineCheers
        )
    }

    private fun findClosestTelemetry(telemetries: List<TelemetryEntity>, timestamp: Long): TelemetryEntity? {
        if (telemetries.isEmpty()) return null
        var closest = telemetries.first()
        var minDiff = abs(closest.timestamp - timestamp)
        for (t in telemetries) {
            val diff = abs(t.timestamp - timestamp)
            if (diff < minDiff) {
                minDiff = diff
                closest = t
            }
        }
        return closest
    }

    suspend fun exportSessionHtml(sessionId: String): Result<Uri> = withContext(Dispatchers.IO) {
        val summary = buildSessionSummary(sessionId)
            ?: return@withContext Result.failure(IllegalStateException("No hay datos de sesión disponibles para exportar"))
        val htmlContent = SessionHtmlReportGenerator.generateHtml(summary)

        val ctx = context ?: return@withContext Result.failure(IllegalStateException("Contexto Android no disponible"))

        val timestampStr = SimpleDateFormat("yyyyMMdd-HHmm", Locale.US).format(Date(summary.startedAt))
        val fileName = "running-session-${summary.sessionId}-$timestampStr.html"

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val resolver = ctx.contentResolver
                val contentValues = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                    put(MediaStore.MediaColumns.MIME_TYPE, "text/html")
                    put(MediaStore.MediaColumns.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/RunningSupport")
                }
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                    ?: return@withContext Result.failure(IllegalStateException("Error creando archivo en MediaStore Downloads"))

                val stream = resolver.openOutputStream(uri)
                    ?: return@withContext Result.failure(IllegalStateException("No se pudo abrir el stream para escritura en MediaStore"))
                stream.use { outputStream ->
                    outputStream.write(htmlContent.toByteArray(Charsets.UTF_8))
                    outputStream.flush()
                }
                Result.success(uri)
            } else {
                val downloadsDir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "RunningSupport")
                if (!downloadsDir.exists()) downloadsDir.mkdirs()
                val file = File(downloadsDir, fileName)
                FileOutputStream(file).use { fos ->
                    fos.write(htmlContent.toByteArray(Charsets.UTF_8))
                    fos.flush()
                }
                val uri = Uri.fromFile(file)
                Result.success(uri)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun createShareIntent(fileUri: Uri): Intent {
        return Intent(Intent.ACTION_SEND).apply {
            type = "text/html"
            putExtra(Intent.EXTRA_STREAM, fileUri)
            clipData = android.content.ClipData.newRawUri("Running Session", fileUri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }

    fun createViewIntent(fileUri: Uri): Intent {
        return Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(fileUri, "text/html")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }
}
