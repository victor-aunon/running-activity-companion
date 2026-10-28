# Registro HTML de Sesión y Ánimos para el Corredor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Proporcionar al corredor un archivo HTML autónomo descargable directamente desde la app Android Companion (`Downloads/`) que recopile de forma visual y offline las métricas de su actividad (encabezado Bento con coordenadas GPS de salida y meta) y la crónica cronológica (timeline por km y minuto) de todos los ánimos recibidos.

**Architecture:** Mapeo de datos locales desde Room (`workout_sessions`, `cheer_notifications`, `telemetry_buffer`) a un modelo desacoplado de presentación `SessionSummaryData`. Un generador puro en Kotlin `SessionHtmlReportGenerator` construye el HTML autónomo con CSS inline sin dependencias externas. `SessionExportManager` persiste el archivo en el almacenamiento público vía `MediaStore.Downloads` y proporciona `Intent` para abrir o compartir. La UI de Compose `GatewayConsoleScreen` expone una tarjeta persistente de exportación accesible en cualquier momento.

**Tech Stack:** Kotlin, Android Jetpack (Compose, Material3), Room DB (SQLite WAL), Android MediaStore API, JUnit 4, Kotlin Coroutines Test.

**Spec:** `docs/superpowers/specs/2026-10-27-session-html-export-design.md`

## Global Constraints

- Android API compatibility: Android 10+ (API 29+) compatible con Scoped Storage (`MediaStore.Downloads`), `minSdk 26`.
- El archivo HTML generado debe ser 100% autocontenido (CSS inline, cero llamadas externas de red a Google Fonts, CDN o scripts).
- Escapado estricto contra inyección XSS de todo texto de remitente, sesión y cuerpo de mensajes antes de incrustar en el DOM HTML.
- Persistencia no destructiva: los métodos de Room deben soportar sesiones con o sin ánimos y con o sin coordenadas GPS válidas sin lanzar excepciones.

## Review Focus

1. **Sesión sin mensajes recibidos (0 ánimos):** El generador HTML debe renderizar limpiamente una tarjeta de estado "Carrera completada sin ánimos registrados" sin romper la estructura del timeline.
2. **Intentos de inyección de código (XSS en `senderName` o `body`):** Caracteres especiales como `<script>`, `"`, `&`, `'` deben codificarse como entidades HTML seguras (`&lt;`, `&gt;`, `&amp;`, `&quot;`, `&#39;`).
3. **Pérdida de señal GPS / Puntos GPS (0,0):** Coordenadas `(0.0, 0.0)` o con `gpsQuality == 0` no deben seleccionarse como puntos de salida o meta; si no hay coordenadas válidas, se debe indicar "No disponible" sin crashear.
4. **Cálculo de ritmo con distancia 0 o tiempo 0:** División por cero en el cálculo de `min/km` debe retornar `--:-- /km` de forma segura.
5. **Sesión activa vs finalizada:** Si la sesión aún no ha terminado (`endedAt == null`), el estado debe ser `EN CURSO` y la meta debe etiquetarse como "Última posición conocida".

---

### Task 1: Ampliar DAO y Entidades de Telemetría para Distancia y Consulta de Sesión

**Files:**
- Modify: `apps/android-companion/app/src/main/java/com/runningsupport/companion/data/entities/TelemetryEntity.kt`
- Modify: `apps/android-companion/app/src/main/java/com/runningsupport/companion/data/daos/TelemetryBufferDao.kt`
- Modify: `apps/android-companion/app/src/main/java/com/runningsupport/companion/data/AppDatabase.kt`
- Test: `apps/android-companion/app/src/test/java/com/runningsupport/companion/TelemetryBufferDaoExportTest.kt`

**Interfaces:**
- Consumes: `SessionEntity`, `TelemetryEntity`
- Produces:
  - `TelemetryEntity.distanceM: Double`
  - `TelemetryBufferDao.getSession(sessionId: String): SessionEntity?`
  - `TelemetryBufferDao.getLatestSession(): SessionEntity?`
  - `TelemetryBufferDao.getFirstValidGpsPoint(sessionId: String): TelemetryEntity?`
  - `TelemetryBufferDao.getLastValidGpsPoint(sessionId: String): TelemetryEntity?`
  - `TelemetryBufferDao.getAllTelemetryOrdered(sessionId: String): List<TelemetryEntity>`
  - `TelemetryBufferDao.updateSessionSummary(sessionId: String, status: String, endedAt: Long?, totalDistanceM: Double, elapsedSeconds: Long)`

- [ ] **Step 1: Write the failing test**

```kotlin
package com.runningsupport.companion

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.runningsupport.companion.data.AppDatabase
import com.runningsupport.companion.data.entities.SessionEntity
import com.runningsupport.companion.data.entities.TelemetryEntity
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class TelemetryBufferDaoExportTest {
    private lateinit var db: AppDatabase

    @Before
    fun createDb() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java)
            .allowMainThreadQueries()
            .build()
    }

    @After
    fun closeDb() {
        db.close()
    }

    @Test
    fun testExportQueries_ReturnValidGpsAndSessionMetrics() = runBlocking {
        val sessionId = "carrera-test-1"
        val session = SessionEntity(
            sessionId = sessionId,
            shareableToken = "token-1",
            spectatorPin = "1234",
            athleteName = "Víctor",
            status = "COMPLETED",
            startedAt = 1000L,
            endedAt = 5000L,
            totalDistanceM = 10000.0,
            elapsedSeconds = 2400L
        )
        db.telemetryBufferDao().insertSession(session)

        val t1 = TelemetryEntity(
            sessionId = sessionId, seq = 1, timestamp = 1000L,
            latitude = 39.4699, longitude = -0.3763, elevation = 15.0,
            speedMps = 3.5, paceSecPerKm = 285.0, heartRate = 145, cadence = 175,
            distanceM = 10.0
        )
        val t2 = TelemetryEntity(
            sessionId = sessionId, seq = 2, timestamp = 5000L,
            latitude = 39.4750, longitude = -0.3600, elevation = 16.0,
            speedMps = 3.6, paceSecPerKm = 277.0, heartRate = 160, cadence = 180,
            distanceM = 10000.0
        )
        db.telemetryBufferDao().insertTelemetry(t1)
        db.telemetryBufferDao().insertTelemetry(t2)

        val retrievedSession = db.telemetryBufferDao().getSession(sessionId)
        assertNotNull(retrievedSession)
        assertEquals("Víctor", retrievedSession?.athleteName)

        val firstGps = db.telemetryBufferDao().getFirstValidGpsPoint(sessionId)
        assertNotNull(firstGps)
        assertEquals(39.4699, firstGps!!.latitude, 0.0001)

        val lastGps = db.telemetryBufferDao().getLastValidGpsPoint(sessionId)
        assertNotNull(lastGps)
        assertEquals(39.4750, lastGps!!.latitude, 0.0001)

        val allTelemetries = db.telemetryBufferDao().getAllTelemetryOrdered(sessionId)
        assertEquals(2, allTelemetries.size)
        assertEquals(10.0, allTelemetries[0].distanceM, 0.1)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew :app:testDebugUnitTest --tests com.runningsupport.companion.TelemetryBufferDaoExportTest` (desde `apps/android-companion`)
Expected: FAIL con "Unresolved reference: distanceM / getSession / getFirstValidGpsPoint"

- [ ] **Step 3: Implement database queries and entity updates**

1. Añadir `distanceM: Double = 0.0` a `TelemetryEntity`.
2. Añadir en `TelemetryBufferDao`:
   ```kotlin
   @Query("SELECT * FROM workout_sessions WHERE sessionId = :sessionId LIMIT 1")
   suspend fun getSession(sessionId: String): SessionEntity?

   @Query("SELECT * FROM workout_sessions ORDER BY startedAt DESC LIMIT 1")
   suspend fun getLatestSession(): SessionEntity?

   @Query("SELECT * FROM telemetry_buffer WHERE sessionId = :sessionId AND (latitude != 0.0 OR longitude != 0.0) ORDER BY timestamp ASC LIMIT 1")
   suspend fun getFirstValidGpsPoint(sessionId: String): TelemetryEntity?

   @Query("SELECT * FROM telemetry_buffer WHERE sessionId = :sessionId AND (latitude != 0.0 OR longitude != 0.0) ORDER BY timestamp DESC LIMIT 1")
   suspend fun getLastValidGpsPoint(sessionId: String): TelemetryEntity?

   @Query("SELECT * FROM telemetry_buffer WHERE sessionId = :sessionId ORDER BY timestamp ASC")
   suspend fun getAllTelemetryOrdered(sessionId: String): List<TelemetryEntity>

   @Query("UPDATE workout_sessions SET status = :status, endedAt = :endedAt, totalDistanceM = :totalDistanceM, elapsedSeconds = :elapsedSeconds WHERE sessionId = :sessionId")
   suspend fun updateSessionSummary(sessionId: String, status: String, endedAt: Long?, totalDistanceM: Double, elapsedSeconds: Long)
   ```
3. Incrementar `version = 2` en `AppDatabase` (con `fallbackToDestructiveMigration()`).

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew :app:testDebugUnitTest --tests com.runningsupport.companion.TelemetryBufferDaoExportTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/android-companion/app/src/main/java/com/runningsupport/companion/data/
git add apps/android-companion/app/src/test/java/com/runningsupport/companion/TelemetryBufferDaoExportTest.kt
git commit -m "feat(companion): add session export queries and distanceM column to telemetry buffer"
```

---

### Task 2: Actualizar Ingesta de Telemetría BLE y Cierre de Sesión

**Files:**
- Modify: `apps/android-companion/app/src/main/java/com/runningsupport/companion/garmin/GarminDataFieldManager.kt:340-380`
- Modify: `apps/android-companion/app/src/main/java/com/runningsupport/companion/service/RunningActivityService.kt:218-236`
- Test: `apps/android-companion/app/src/test/java/com/runningsupport/companion/TelemetryContractTest.kt`

**Interfaces:**
- Consumes: Garmin BLE Payload `metrics.totalDistanceM` y `metrics.elapsedSeconds`
- Produces: `TelemetryEntity` con `distanceM` real y `SessionEntity` actualizado en `onSessionCompleted`

- [ ] **Step 1: Write the failing test**

```kotlin
// En TelemetryContractTest.kt
@Test
fun testGarminPayloadParsesTotalDistanceM() {
    val json = JSONObject().apply {
        put("type", "TELEMETRY_SNAPSHOT")
        put("seq", 100)
        put("timestamp", 1700000000000L)
        put("metrics", JSONObject().apply {
            put("heartRateBpm", 152)
            put("speedMps", 3.4)
            put("totalDistanceM", 5230.5)
            put("elapsedSeconds", 1540)
        })
    }
    val dist = json.optJSONObject("metrics")?.optDouble("totalDistanceM", 0.0) ?: 0.0
    val elapsed = json.optJSONObject("metrics")?.optLong("elapsedSeconds", 0L) ?: 0L
    assertEquals(5230.5, dist, 0.01)
    assertEquals(1540L, elapsed)
}
```

- [ ] **Step 2: Run test to verify behavior**

Run: `./gradlew :app:testDebugUnitTest --tests com.runningsupport.companion.TelemetryContractTest`
Expected: PASS (verifica la estructura de datos contractualmente).

- [ ] **Step 3: Modify `GarminDataFieldManager` y `RunningActivityService`**

1. En `GarminDataFieldManager.kt:355-375`, extraer:
   ```kotlin
   val totalDistanceM = metrics?.optDouble("totalDistanceM", 0.0) ?: 0.0
   val elapsedSeconds = metrics?.optLong("elapsedSeconds", 0L) ?: 0L
   ```
   Pasar `distanceM = totalDistanceM` al instanciar `TelemetryEntity`.
2. Guardar el último `totalDistanceM` y `elapsedSeconds` recibidos en variables en memoria de `GarminDataFieldManager` o `RunningActivityService`.
3. En `RunningActivityService.onSessionCompleted()`, actualizar `db.telemetryBufferDao().updateSessionSummary(sId, "COMPLETED", System.currentTimeMillis(), lastDistanceM, lastElapsedSeconds)`.

- [ ] **Step 4: Run test suite to verify no regressions**

Run: `./gradlew :app:testDebugUnitTest --tests com.runningsupport.companion.*`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/android-companion/app/src/main/java/com/runningsupport/companion/garmin/GarminDataFieldManager.kt
git add apps/android-companion/app/src/main/java/com/runningsupport/companion/service/RunningActivityService.kt
git commit -m "feat(companion): persist odometer distance in telemetry entity and update session summary on complete"
```

---

### Task 3: Modelos de Datos para el Exportador HTML

**Files:**
- Create: `apps/android-companion/app/src/main/java/com/runningsupport/companion/export/SessionExportModels.kt`
- Test: `apps/android-companion/app/src/test/java/com/runningsupport/companion/export/SessionExportModelsTest.kt`

**Interfaces:**
- Produces:
  - `data class GpsCoordinate(val lat: Double, val lng: Double)`
  - `data class TimelineCheer(val senderName: String, val body: String, val status: String, val runnerReplyText: String?, val receivedAt: Long, val kmMark: Double, val elapsedSeconds: Long)`
  - `data class SessionSummaryData(val sessionId: String, val athleteName: String, val status: String, val startedAt: Long, val endedAt: Long?, val totalDistanceM: Double, val elapsedSeconds: Long, val startGps: GpsCoordinate?, val endGps: GpsCoordinate?, val cheers: List<TimelineCheer>)`

- [ ] **Step 1: Write the failing test**

```kotlin
package com.runningsupport.companion.export

import org.junit.Assert.*
import org.junit.Test

class SessionExportModelsTest {
    @Test
    fun testSessionSummaryData_PaceAndKmCalculations() {
        val summary = SessionSummaryData(
            sessionId = "carrera-1",
            athleteName = "Víctor",
            status = "COMPLETED",
            startedAt = 1000L,
            endedAt = 4600L,
            totalDistanceM = 10000.0,
            elapsedSeconds = 3600L,
            startGps = GpsCoordinate(39.4699, -0.3763),
            endGps = GpsCoordinate(39.4750, -0.3600),
            cheers = listOf(
                TimelineCheer(
                    senderName = "Elena",
                    body = "¡Vamos!",
                    status = "AGRADECIDO",
                    runnerReplyText = "Gracias",
                    receivedAt = 2500L,
                    kmMark = 5.2,
                    elapsedSeconds = 1500L
                )
            )
        )

        assertEquals(10.0, summary.totalDistanceKm, 0.01)
        assertEquals(360.0, summary.avgPaceSecPerKm, 0.01) // 3600s / 10km = 360 s/km (6:00 min/km)
        assertEquals("6:00", summary.formattedPace)
        assertEquals("01:00:00", summary.formattedDuration)
        assertEquals(1, summary.cheers.size)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew :app:testDebugUnitTest --tests com.runningsupport.companion.export.SessionExportModelsTest`
Expected: FAIL con "Unresolved reference: SessionSummaryData"

- [ ] **Step 3: Implement `SessionExportModels.kt`**

Crear data classes y properties auxiliares (`totalDistanceKm`, `avgPaceSecPerKm`, `formattedPace`, `formattedDuration`).

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew :app:testDebugUnitTest --tests com.runningsupport.companion.export.SessionExportModelsTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/android-companion/app/src/main/java/com/runningsupport/companion/export/SessionExportModels.kt
git add apps/android-companion/app/src/test/java/com/runningsupport/companion/export/SessionExportModelsTest.kt
git commit -m "feat(companion): introduce export data models for session html chronicle"
```

---

### Task 4: Implementar el Generador HTML Autónomo (`SessionHtmlReportGenerator`)

**Files:**
- Create: `apps/android-companion/app/src/main/java/com/runningsupport/companion/export/SessionHtmlReportGenerator.kt`
- Test: `apps/android-companion/app/src/test/java/com/runningsupport/companion/export/SessionHtmlReportGeneratorTest.kt`

**Interfaces:**
- Consumes: `SessionSummaryData`
- Produces: `SessionHtmlReportGenerator.generateHtml(data: SessionSummaryData): String`

- [ ] **Step 1: Write the failing tests**

```kotlin
package com.runningsupport.companion.export

import org.junit.Assert.*
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew :app:testDebugUnitTest --tests com.runningsupport.companion.export.SessionHtmlReportGeneratorTest`
Expected: FAIL con "Unresolved reference: SessionHtmlReportGenerator"

- [ ] **Step 3: Implement `SessionHtmlReportGenerator`**

Construir el generador en `SessionHtmlReportGenerator.kt` con:
- `escapeHtml(text: String): String`
- CSS embebido Aurora/Bento + `@media print`
- Encabezado con datos de sesión, coordenadas y pastillas de métricas
- Muro/Línea temporal con tarjetas estilizadas y estados de ánimos

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew :app:testDebugUnitTest --tests com.runningsupport.companion.export.SessionHtmlReportGeneratorTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/android-companion/app/src/main/java/com/runningsupport/companion/export/SessionHtmlReportGenerator.kt
git add apps/android-companion/app/src/test/java/com/runningsupport/companion/export/SessionHtmlReportGeneratorTest.kt
git commit -m "feat(companion): implement self-contained session html report generator with bento header and timeline"
```

---

### Task 5: Implementar el Gestor de Exportación y Almacenamiento (`SessionExportManager`)

**Files:**
- Create: `apps/android-companion/app/src/main/java/com/runningsupport/companion/export/SessionExportManager.kt`
- Test: `apps/android-companion/app/src/test/java/com/runningsupport/companion/export/SessionExportManagerTest.kt`

**Interfaces:**
- Consumes: `AppDatabase`, `Context`, `SessionHtmlReportGenerator`
- Produces:
  - `suspend fun buildSessionSummary(sessionId: String): SessionSummaryData?`
  - `suspend fun exportSessionHtml(sessionId: String): Result<Uri>`
  - `fun createShareIntent(fileUri: Uri): Intent`
  - `fun createViewIntent(fileUri: Uri): Intent`

- [ ] **Step 1: Write the failing test**

```kotlin
package com.runningsupport.companion.export

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.runningsupport.companion.data.AppDatabase
import com.runningsupport.companion.data.entities.CheerEntity
import com.runningsupport.companion.data.entities.SessionEntity
import com.runningsupport.companion.data.entities.TelemetryEntity
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class SessionExportManagerTest {
    private lateinit var db: AppDatabase
    private lateinit var context: Context
    private lateinit var exportManager: SessionExportManager

    @Before
    fun setup() {
        context = ApplicationProvider.getApplicationContext()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        exportManager = SessionExportManager(context, db)
    }

    @After
    fun tearDown() {
        db.close()
    }

    @Test
    fun testBuildSessionSummary_MapsCheersToTelemetryKm() = runBlocking {
        val sId = "carrera-test"
        db.telemetryBufferDao().insertSession(
            SessionEntity(
                sessionId = sId, shareableToken = "tok", spectatorPin = "4829",
                athleteName = "Víctor", status = "COMPLETED",
                startedAt = 10000L, endedAt = 70000L, totalDistanceM = 10000.0, elapsedSeconds = 3600L
            )
        )
        // Telemetría a mitad de carrera
        db.telemetryBufferDao().insertTelemetry(
            TelemetryEntity(
                sessionId = sId, seq = 1, timestamp = 10000L,
                latitude = 39.4699, longitude = -0.3763, elevation = 10.0,
                speedMps = 3.0, paceSecPerKm = 333.0, heartRate = 140, cadence = 170,
                distanceM = 100.0
            )
        )
        db.telemetryBufferDao().insertTelemetry(
            TelemetryEntity(
                sessionId = sId, seq = 20, timestamp = 35000L,
                latitude = 39.4720, longitude = -0.3700, elevation = 12.0,
                speedMps = 3.2, paceSecPerKm = 312.0, heartRate = 155, cadence = 175,
                distanceM = 5000.0
            )
        )
        // Ánimo recibido a los 36000L (cerca de km 5.0)
        db.cheerDao().insertCheer(
            CheerEntity(
                notificationId = "cheer-1", sessionId = sId, senderName = "Carlos",
                presetId = "VAMOS", body = "¡Fuerza!", status = "ENVIADO",
                receivedAt = 36000L, expiresAt = 90000L
            )
        )

        val summary = exportManager.buildSessionSummary(sId)
        assertNotNull(summary)
        assertEquals("Víctor", summary?.athleteName)
        assertEquals(1, summary?.cheers?.size)
        // El km asignado al ánimo debe ser aproximadamente 5.0
        assertEquals(5.0, summary!!.cheers[0].kmMark, 0.2)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew :app:testDebugUnitTest --tests com.runningsupport.companion.export.SessionExportManagerTest`
Expected: FAIL con "Unresolved reference: SessionExportManager"

- [ ] **Step 3: Implement `SessionExportManager`**

1. `buildSessionSummary(sessionId: String)`:
   - Consulta la sesión de Room. Si no existe, busca la más reciente.
   - Consulta `getFirstValidGpsPoint` y `getLastValidGpsPoint`.
   - Consulta todos los ánimos de la sesión (`getCheersForSession`).
   - Carga telemetrías ordenadas y para cada ánimo asocia el km más cercano comparando `receivedAt` con `timestamp` de telemetría (o interpolando `(receivedAt - startedAt) * (totalDistanceM / elapsedSeconds)` si no hay telemetría en ese instante).
2. `exportSessionHtml(sessionId: String)`:
   - Genera el HTML vía `SessionHtmlReportGenerator`.
   - En Android 10+ (`Build.VERSION_CODES.Q`), inserta en `MediaStore.Downloads` con relative path `Download/RunningSupport/`.
   - Fallback a `Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)`.
   - Retorna `Result.success(uri)`.
3. `createShareIntent(fileUri: Uri)` y `createViewIntent(fileUri: Uri)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew :app:testDebugUnitTest --tests com.runningsupport.companion.export.SessionExportManagerTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/android-companion/app/src/main/java/com/runningsupport/companion/export/SessionExportManager.kt
git add apps/android-companion/app/src/test/java/com/runningsupport/companion/export/SessionExportManagerTest.kt
git commit -m "feat(companion): add session export manager for mediastore downloads integration"
```

---

### Task 6: Integrar Tarjeta de Exportación Persistente en `GatewayConsoleScreen`

**Files:**
- Modify: `apps/android-companion/app/src/main/java/com/runningsupport/companion/ui/screens/GatewayConsoleScreen.kt`
- Modify: `apps/android-companion/app/src/main/java/com/runningsupport/companion/ui/MainActivity.kt`

**Interfaces:**
- Consumes: `SessionExportManager`, `sessionName`
- Produces: Tarjeta `SessionExportCard` persistente con botones *"Guardar Resumen HTML"* y *"Compartir"*

- [ ] **Step 1: Write component specification in `GatewayConsoleScreen.kt`**

Añadir parámetros a `GatewayConsoleScreen`:
```kotlin
onExportHtml: () -> Unit = {},
onShareExport: () -> Unit = {},
isExportAvailable: Boolean = false,
lastExportUri: Uri? = null,
sessionSummarySnippet: String? = null
```

- [ ] **Step 2: Implement `SessionExportCard` en `GatewayConsoleScreen.kt`**

Crear la tarjeta Compose:
- Tarjeta estilizada Material3 (fondo blanco, bordes redondeados 12.dp, título en mayúsculas `REGISTRO Y MEMORIA DE LA SESIÓN`).
- Mostrar el snippet informativo: ej. *"Última sesión: carrera-victor · 4 mensajes · 21.1 km"* o *"No hay sesiones guardadas"*.
- Botón principal: `📥 Guardar Resumen HTML` (ejecuta `onExportHtml`).
- Botón secundario: `Compartir` (habilitado si `lastExportUri != null`, ejecuta `onShareExport`).

- [ ] **Step 3: Conectar el flujo en `MainActivity.kt`**

En `MainActivity.kt`:
1. Instanciar `SessionExportManager(this, db)`.
2. Lanzar corrutina en `onExportHtml`:
   - Llama a `exportSessionHtml(sessionName)`.
   - Muestra `Toast.makeText(context, "Resumen guardado en Descargas/RunningSupport", Toast.LENGTH_LONG).show()`.
   - Actualiza estado con el `Uri` resultante.
3. En `onShareExport`:
   - Lanza `startActivity(Intent.createChooser(shareIntent, "Compartir resumen de carrera"))`.

- [ ] **Step 4: Verify Compilation and Run Tests**

Run: `./gradlew :app:assembleDebug :app:testDebugUnitTest` (desde `apps/android-companion`)
Expected: BUILD SUCCESSFUL y todos los tests pasando.

- [ ] **Step 5: Commit**

```bash
git add apps/android-companion/app/src/main/java/com/runningsupport/companion/ui/screens/GatewayConsoleScreen.kt
git add apps/android-companion/app/src/main/java/com/runningsupport/companion/ui/MainActivity.kt
git commit -m "feat(companion): add persistent session memory and html export card to gateway console"
```

---

### Task 7: Verificación Global E2E y Pruebas de Regresión

**Files:**
- Modify: `apps/android-companion/app/src/test/java/com/runningsupport/companion/export/SessionExportEndToEndTest.kt`

**Interfaces:**
- Consumes: Flujo completo desde simulación -> inserción de ánimos -> generación HTML -> guardado simulado

- [ ] **Step 1: Write E2E Verification Test**

```kotlin
package com.runningsupport.companion.export

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.runningsupport.companion.data.AppDatabase
import com.runningsupport.companion.data.entities.CheerEntity
import com.runningsupport.companion.data.entities.SessionEntity
import com.runningsupport.companion.data.entities.TelemetryEntity
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class SessionExportEndToEndTest {
    private lateinit var db: AppDatabase
    private lateinit var context: Context

    @Before
    fun setup() {
        context = ApplicationProvider.getApplicationContext()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java)
            .allowMainThreadQueries().build()
    }

    @After
    fun tearDown() = db.close()

    @Test
    fun testCompleteExportPipeline_GeneratesValidHtmlFile() = runBlocking {
        val sId = "maraton-completa"
        db.telemetryBufferDao().insertSession(
            SessionEntity(
                sessionId = sId, shareableToken = "tok", spectatorPin = "4829",
                athleteName = "Víctor", status = "COMPLETED",
                startedAt = 1000L, endedAt = 7200L, totalDistanceM = 21000.0, elapsedSeconds = 6200L
            )
        )

        db.telemetryBufferDao().insertTelemetry(
            TelemetryEntity(
                sessionId = sId, seq = 1, timestamp = 1000L,
                latitude = 39.46, longitude = -0.37, elevation = 12.0,
                speedMps = 3.3, paceSecPerKm = 300.0, heartRate = 145, cadence = 175, distanceM = 0.0
            )
        )
        db.telemetryBufferDao().insertTelemetry(
            TelemetryEntity(
                sessionId = sId, seq = 50, timestamp = 7200L,
                latitude = 39.48, longitude = -0.35, elevation = 14.0,
                speedMps = 3.5, paceSecPerKm = 285.0, heartRate = 165, cadence = 180, distanceM = 21000.0
            )
        )

        db.cheerDao().insertCheer(
            CheerEntity(
                notificationId = "c1", sessionId = sId, senderName = "Mama",
                presetId = "ORGULLO", body = "¡Muy orgullosa de ti!", status = "AGRADECIDO",
                runnerReplyText = "Víctor te lo agradece", receivedAt = 4000L, expiresAt = 10000L
            )
        )

        val manager = SessionExportManager(context, db)
        val summary = manager.buildSessionSummary(sId)
        assertNotNull(summary)

        val html = SessionHtmlReportGenerator.generateHtml(summary!!)
        assertTrue(html.contains("¡Muy orgullosa de ti!"))
        assertTrue(html.contains("21.00"))
        assertTrue(html.contains("Mama"))
        assertTrue(html.contains("39.46, -0.37"))
    }
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `./gradlew :app:testDebugUnitTest --tests com.runningsupport.companion.export.SessionExportEndToEndTest`
Expected: PASS

- [ ] **Step 3: Run all unit and integration tests across Android companion**

Run: `./gradlew :app:testDebugUnitTest`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/android-companion/app/src/test/java/com/runningsupport/companion/export/SessionExportEndToEndTest.kt
git commit -m "test(companion): add end-to-end verification test for session html export pipeline"
```
