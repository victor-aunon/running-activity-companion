# Implementation Plan: Real-Time Running Activity Support System

**Branch**: `001-running-activity-support` | **Date**: 2026-10-21 (Updated) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-running-activity-support/spec.md` with user redefinitions: Next.js latest in pure Light Mode with Aurora & Bento Box design, dynamic effort zones & athlete name via environment variables, spectator cheer system with gratitude replies, Android local-first storage with headless console (zero metrics), and Garmin Connect IQ Data Field running inside the native running activity with pre-run activation switch.

---

## Summary

The system is a distributed 3-tier real-time running ecosystem:
1. **Garmin Fenix 7s (Monkey C)**: Built as a Connect IQ **Data Field** that hooks into the watch's **native Running activity** (not a separate app), allowing the athlete to use their standard screens. It features a pre-run activation switch, 1 Hz background sensor streaming via BLE, and a non-obstructive top banner notification with a quick reply button.
2. **Android 16 Companion Gateway (Kotlin + Compose)**: Headless background gateway that displays **ZERO running metrics**. It persists 100% of data locally in Room (SQLite WAL) and streams telemetry and spectator cheers over WebSockets.
3. **Next.js 15+ Web Dashboard (TypeScript, Tailwind, CVA)**: Designed with an **Aurora & Bento Box aesthetic in pure Light Mode** (no dark mode). It dynamically resolves effort zones and athlete name ("Víctor") from environment variables, renders live GPS Leaflet maps without API keys, and hosts the spectator cheer wall ("¡Mucho ánimo!", "¡Tú puedes!", "!Sigue así!") tracking statuses from "Enviado" to "Víctor te lo agradece".

---

## Technical Context

**Language/Version**:
- Web: TypeScript 5.x, Next.js 15+ (App Router, React 19).
- Android: Kotlin 2.x, Android 16 (API 36, Min SDK 28).
- Wearable: Monkey C, Garmin Connect IQ SDK 7.x (targeting Fenix 7s native Run activity).

**Primary Dependencies**:
- Web: `next`, `react`, `react-dom`, `tailwindcss` (v4), `class-variance-authority`, `clsx`, `tailwind-merge`, `leaflet`, `@types/leaflet`, `lucide-react`, `ws`.
- Android: AndroidX Core, Jetpack Compose, Android Room Database (SQLite WAL), Kotlin Coroutines & Flow, Garmin Connect IQ Mobile SDK.
- Wearable: Connect IQ Toybox (`WatchUi.DataField`, `Sensor`, `Position`, `Communications`, `Background`).

**Environment Variables Configuration**:
```env
# Athlete & Spectator Configuration
NEXT_PUBLIC_ATHLETE_NAME=Víctor

# Dynamic Heart Rate Effort Zones (BPM)
NEXT_PUBLIC_ZONE_1_MAX=130
NEXT_PUBLIC_ZONE_2_MAX=145
NEXT_PUBLIC_ZONE_3_MAX=160
NEXT_PUBLIC_ZONE_4_MAX=175
NEXT_PUBLIC_ZONE_5_MAX=195

# WebSocket Connectivity
NEXT_PUBLIC_WS_URL=ws://localhost:3000/api/ws/session
PORT=3000
```

**Storage**:
- Android: Local-first persistence in Room Database (`workout_sessions`, `telemetry_buffer`, `cheer_history`). Telemetry buffer capped at 50,000 points (~13.8 hours at 1 Hz, max 50 MB) with FIFO eviction during severe outages, plus automatic retention pruning to keep only the last 5 completed workout sessions.
- Web: Ephemeral in-memory browser session state (Zustand / React Context); zero cloud database persistence for v1.

**Resilience & Protocol Specifications**:
- **Garmin BLE Budget & Dormancy**: `Toybox.Communications.transmit()` payloads are serialized into compact numeric dictionaries constrained to a 256-byte MTU limit. In disabled pre-activity state, the Data Field enforces total radio silence (0 BLE packets, 0 wakelocks). During mid-run BLE disconnects, a 10-packet ring buffer protects Connect IQ heap limits while retrying every 5 seconds.
- **Effort Zone Monotonic Fallback**: If `NEXT_PUBLIC_ZONE_*_MAX` variables are missing, non-numeric, or non-monotonic, the system automatically falls back to default thresholds [130, 145, 160, 175, 195].
- **Security & PIN Rate Limiting**: 5 consecutive failed PIN attempts lock submissions for 60 seconds.
- **Cheer Completion Lifecycle**: Any unreached in-flight cheer transitions to `EXPIRADO` ("Actividad finalizada") upon workout completion.

**Target Platform**:
- Web: Fully responsive across evergreen mobile (375px+), tablet (768px+), and desktop (1280px+) browsers in Light Mode.
- Mobile: Android 16 physical device.
- Wearable: Garmin Fenix 7s native Running activity data screens.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Status | Compliance Verification |
|------------------|--------|-------------------------|
| **I. Multi-Tier Distributed Separation (Clean Architecture)** | **PASS** | Domain telemetry & cheer entities decoupled from BLE and WebSockets; Data Field acts as pure sensor port. |
| **II. Contract-First & Schema Validation** | **PASS** | Formal JSON schemas in `contracts/telemetry.schema.json` and `contracts/notification.schema.json`. |
| **III. Real-Time Resilience & Offline-First Buffer** | **PASS** | Android Room DB stores all points locally with idempotent synchronization; cheer TTL prevents stale alerts. |
| **IV. Test-First & Multi-Tier Verification (TDD)** | **PASS** | Unit tests for zone resolver, Data Field lifecycle, and WebSocket contracts designed in `quickstart.md`. |
| **V. Resource Budgets & Observability** | **PASS** | Pre-activity toggle ensures zero battery drain when dormant; Data Field respects Fenix 7s memory limit. |

---

## Project Structure

```text
running-activity-support/
├── apps/
│   ├── web-dashboard/                     # Next.js 15+ App Router, Tailwind CSS, CVA (Aurora Bento Light)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx             # Root layout with Aurora mesh backdrop
│   │   │   │   ├── page.tsx               # Session lookup / spectator landing
│   │   │   │   ├── session/
│   │   │   │   │   └── [token]/
│   │   │   │   │       └── page.tsx       # Bento Box Dashboard container
│   │   │   │   └── api/
│   │   │   │       └── ws/
│   │   │   │           └── session/
│   │   │   │               └── route.ts   # WebSocket relay & spectator room server
│   │   │   ├── components/
│   │   │   │   ├── bento/                 # Bento Box modular tiles
│   │   │   │   │   ├── BentoGrid.tsx      # Main Bento grid layout
│   │   │   │   │   ├── HeaderTile.tsx     # Athlete identity, status & battery
│   │   │   │   │   ├── MetricTile.tsx     # Monospace KPI tile with CVA variants
│   │   │   │   │   ├── MapTile.tsx        # Leaflet dynamic route tile
│   │   │   │   │   └── CheerWallTile.tsx  # Spectator cheer buttons & live feed
│   │   │   │   ├── ui/                    # CVA presentational atomic components
│   │   │   │   │   ├── badge.tsx          # StatusBadge (live, sent, thanked)
│   │   │   │   │   └── button.tsx         # ActionButton (presets, custom send)
│   │   │   ├── hooks/
│   │   │   │   ├── useLiveTelemetry.ts    # 1 Hz telemetry stream hook
│   │   │   │   ├── useSpectatorCheer.ts   # Cheer dispatch & gratitude response hook
│   │   │   │   └── useEffortZones.ts      # Reads NEXT_PUBLIC_ZONE_*_MAX env vars
│   │   │   ├── services/
│   │   │   │   └── WebSocketClient.ts     # Resilient socket connection adapter
│   │   │   └── types/
│   │   │       └── telemetry.ts           # Shared contract types
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── android-companion/                 # Android 16 Kotlin + Jetpack Compose
│   │   └── app/src/main/java/com/runningsupport/companion/
│   │       ├── data/                      # Room local-first storage
│   │       │   ├── AppDatabase.kt
│   │       │   ├── entities/
│   │       │   │   ├── TelemetryEntity.kt
│   │       │   │   └── SessionEntity.kt
│   │       │   └── daos/
│   │       │       └── TelemetryBufferDao.kt
│   │       ├── service/                   # Foreground service
│   │       │   └── RunningActivityService.kt # Uninterrupted BLE & WebSocket relay
│   │       ├── garmin/                    # Connect IQ listener
│   │       │   └── GarminDataFieldManager.kt # Receives 1 Hz packets from native Run
│   │       ├── network/                   # Cloud socket
│   │       │   └── WebSocketGatewayClient.kt # Drains local Room buffer to web
│   │       └── ui/                        # Headless Gateway UI (ZERO metrics)
│   │           ├── MainActivity.kt
│   │           └── screens/
│   │               └── GatewayConsoleScreen.kt # Service toggle, BLE/Cloud status, PIN
│   │
│   └── garmin-fenix7s/                    # Garmin Connect IQ Data Field (Monkey C)
│       ├── source/
│       │   ├── RunningSupportDataField.mc # Hooks into native Garmin Running activity
│       │   ├── NotificationBannerOverlay.mc # Non-obstructive top banner overlay
│       │   ├── DataFieldMenuDelegate.mc   # Pre-activity toggle (Enabled / Disabled)
│       │   └── BleTransmitter.mc          # Connect IQ Communications wrapper
│       ├── resources/
│       │   └── settings/
│       │       └── settings.xml           # Pre-run activation switch definition
│       └── manifest.xml
│
├── packages/
│   └── shared-contracts/                  # Single source of truth schemas
│       ├── telemetry.schema.json
│       ├── notification.schema.json
│       └── index.ts
│
└── specs/001-running-activity-support/
    ├── spec.md                            # Clarified specification
    ├── plan.md                            # This implementation plan
    ├── research.md                        # Architecture decisions & API key guide
    ├── data-model.md                      # Entities & storage schemas
    ├── quickstart.md                      # Validation guide
    ├── checklists/requirements.md         # Requirements checklist
    ├── designs/                           # Visual specifications
    │   ├── tokens.json                    # Aurora & Bento Light Mode tokens
    │   └── DESIGN.md                      # UI and screen architecture
    └── contracts/                         # Interface contracts
        ├── telemetry.schema.json
        ├── notification.schema.json
        └── websocket-protocol.md
```

---

## Complexity Tracking

| Component | Justification | Alternatives Rejected |
|-----------|---------------|----------------------|
| **Connect IQ Data Field (not full app)** | Preserves the athlete's native Garmin Running experience (GPS, laps, native sensors) without forcing them into an alternative running screen. | Standalone watch app was rejected per explicit user requirement. |
| **Aurora & Bento Light Architecture** | Provides modern, luminous visual hierarchy with high readability for spectators without dark mode toggle complexity. | Dark mode option was explicitly excluded by user mandate. |
| **Environment Variable Effort Zones** | Allows instantaneous customization of heart rate zones and athlete name without code modification or database overhead. | Hardcoded thresholds or DB config table rejected for flexibility and zero DB overhead. |
