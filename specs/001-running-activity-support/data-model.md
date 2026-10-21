# Data Model & Storage Schema: Real-Time Running Activity Support System

**Feature**: `001-running-activity-support` | **Date**: 2026-10-21 (Updated)

## 1. Domain Entities & Type Definitions

### 1.1 WorkoutSession
Represents an individual athletic running activity initiated within Garmin's native Running app.

| Field | Type | Description | Validation / Constraints |
|-------|------|-------------|--------------------------|
| `sessionId` | `String (UUIDv4)` | Unique session identifier | Immutable, Non-empty |
| `athleteName` | `String` | Athlete display name | Configured via `NEXT_PUBLIC_ATHLETE_NAME` (default: "Víctor") |
| `startTimeEpochMs` | `Int64` | Timestamp of session start | Positive Unix milliseconds |
| `endTimeEpochMs` | `Int64?` | Timestamp of session finish | Optional, >= `startTimeEpochMs` |
| `status` | `Enum (SessionStatus)` | Current state of the activity | `INITIALIZING`, `ACTIVE`, `PAUSED`, `COMPLETED`, `INTERRUPTED` |
| `shareableToken` | `String (UUIDv4)` | Public URL viewer token | URL-safe, immutable for session |
| `spectatorPin` | `String` | 4-digit code for spectator cheer authorization | Regex `^\d{4}$` |
| `totalDistanceMeters` | `Double` | Cumulative distance traveled | >= 0.0 |
| `elapsedDurationSeconds` | `Int64` | Total active moving time | >= 0 |
| `currentPaceSecPerKm` | `Double` | Current instantaneous pace | >= 0.0 |
| `avgPaceSecPerKm` | `Double` | Average overall session pace | >= 0.0 |
| `avgHeartRateBpm` | `Int` | Average heart rate | 0 - 250 bpm |
| `maxHeartRateBpm` | `Int` | Peak heart rate recorded | 0 - 250 bpm |

---

### 1.2 TelemetrySnapshot
Discrete real-time telemetry frame captured at 1 Hz from Garmin sensors during native run.

| Field | Type | Unit | Description | Validation |
|-------|------|------|-------------|------------|
| `sessionId` | `String (UUIDv4)` | - | Parent session ID | Matches active session |
| `seq` | `Int64` | - | Monotonically increasing sequence number | Sequential per session |
| `timestampEpochMs` | `Int64` | ms | Timestamp of measurement | Unix epoch milliseconds |
| `latitude` | `Double` | deg | GPS WGS84 Latitude | -90.0 to 90.0 |
| `longitude` | `Double` | deg | GPS WGS84 Longitude | -180.0 to 180.0 |
| `elevation` | `Float` | m | GPS / barometric altitude | -500 to 9000 m |
| `speedMps` | `Float` | m/s | Instantaneous speed | >= 0.0 m/s |
| `paceSecPerKm` | `Double` | s/km | Derived running pace | Calculated from speed |
| `heartRate` | `Int` | bpm | Heart rate from optical/chest sensor | 30 to 240 bpm |
| `cadence` | `Int` | spm | Steps per minute (running cadence) | 0 to 260 spm |
| `stepCount` | `Int64` | steps | Cumulative workout step count | Non-decreasing |

---

### 1.3 SpectatorCheerMessage
Cheer message dispatched from the Web dashboard down to the runner's wrist.

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `notificationId` | `String (UUIDv4)` | Unique notification trace ID | Immutable |
| `sessionId` | `String (UUIDv4)` | Target workout session | Matches active session |
| `senderName` | `String` | Name of spectator (e.g., "Laura", "Mamá") | Max 20 chars |
| `presetId` | `Enum (CheerPreset)` | Identifier of preset or custom text | `MUCHO_ANIMO`, `TU_PUEDES`, `SIGUE_ASI`, `CUSTOM` |
| `body` | `String` | Message content displayed on watch | Max 50 characters, UTF-8 |
| `createdAtEpochMs` | `Int64` | Creation timestamp | Unix epoch ms |
| `ttlSeconds` | `Int` | Time-to-live before expiration | Default: 60s (10s to 300s) |
| `status` | `Enum (CheerStatus)` | Lifecycle state | `ENVIADO`, `EN_RELOJ`, `AGRADECIDO`, `EXPIRADO` |
| `runnerReplyText` | `String?` | Displayed on web when runner replies | "${ATHLETE_NAME} te lo agradece" (e.g. "Víctor te lo agradece") |
| `repliedAtEpochMs` | `Int64?` | Timestamp of runner reply | Optional |

#### Lifecycle of a Cheer Message
```
[User clicks Send]
       │
       ▼
  ["Enviado"] ────────────────────────── (TTL Expires) ───► ["Expirado"]
       │
       ▼
  ["En reloj"] (Banner shown in native run)
       │
       └── (Runner presses Select button) ──► ["Víctor te lo agradece"]
```

---

## 2. Android 16 Local Storage (Room Database Schema)

Maximized local persistence in SQLite (WAL mode):
```sql
CREATE TABLE workout_sessions (
    session_id TEXT PRIMARY KEY NOT NULL,
    athlete_name TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    status TEXT NOT NULL,
    shareable_token TEXT NOT NULL,
    spectator_pin TEXT NOT NULL,
    total_distance REAL NOT NULL DEFAULT 0.0,
    elapsed_seconds INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE TABLE telemetry_buffer (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    session_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    elevation REAL NOT NULL,
    speed_mps REAL NOT NULL,
    heart_rate INTEGER NOT NULL,
    cadence INTEGER NOT NULL,
    step_count INTEGER NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(session_id) REFERENCES workout_sessions(session_id) ON DELETE CASCADE
);
CREATE INDEX idx_telemetry_unsynced ON telemetry_buffer(session_id, synced, seq);

CREATE TABLE cheer_history (
    notification_id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    preset_id TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    ttl_seconds INTEGER NOT NULL,
    status TEXT NOT NULL,
    runner_replied INTEGER NOT NULL DEFAULT 0,
    replied_at INTEGER,
    FOREIGN KEY(session_id) REFERENCES workout_sessions(session_id) ON DELETE CASCADE
);
```

---

## 3. Web Dashboard (Next.js) Ephemeral State & Effort Zone Resolution

```typescript
export interface EffortZoneConfig {
  zone1Max: number; // e.g. from NEXT_PUBLIC_ZONE_1_MAX || 130
  zone2Max: number; // e.g. from NEXT_PUBLIC_ZONE_2_MAX || 145
  zone3Max: number; // e.g. from NEXT_PUBLIC_ZONE_3_MAX || 160
  zone4Max: number; // e.g. from NEXT_PUBLIC_ZONE_4_MAX || 175
  zone5Max: number; // e.g. from NEXT_PUBLIC_ZONE_5_MAX || 195
}

export function resolveHeartRateZone(hr: number, config: EffortZoneConfig): {
  zone: 1 | 2 | 3 | 4 | 5;
  name: string;
  colorClass: string;
} {
  if (hr <= config.zone1Max) return { zone: 1, name: "Zona 1 (Recuperación)", colorClass: "text-sky-600 bg-sky-50 border-sky-200" };
  if (hr <= config.zone2Max) return { zone: 2, name: "Zona 2 (Aeróbico)", colorClass: "text-emerald-600 bg-emerald-50 border-emerald-200" };
  if (hr <= config.zone3Max) return { zone: 3, name: "Zona 3 (Tempo)", colorClass: "text-amber-600 bg-amber-50 border-amber-200" };
  if (hr <= config.zone4Max) return { zone: 4, name: "Zona 4 (Umbral)", colorClass: "text-orange-600 bg-orange-50 border-orange-200" };
  return { zone: 5, name: "Zona 5 (Anaeróbico)", colorClass: "text-red-600 bg-red-50 border-red-200" };
}
```
