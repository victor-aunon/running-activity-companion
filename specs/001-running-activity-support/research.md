# Technical Research & Architecture Decisions: Real-Time Running Activity Support System

**Feature**: `001-running-activity-support` | **Date**: 2026-10-21 (Updated)

## Executive Summary
This document records technical research and architectural decisions for the 3-tier distributed real-time running ecosystem:
1. **Garmin Fenix 7s (Monkey C)**: Connect IQ Data Field / Background Service integrated inside the **native Garmin Running activity**, with pre-activity toggle, top banner overlay, and quick reply button.
2. **Android 16 Companion Gateway (Kotlin)**: Foreground service with **Room Database (SQLite WAL)** maximizing on-device local storage and a minimalist headless UI showing **ZERO running metrics**.
3. **Next.js 15+ Web Dashboard (TypeScript, Tailwind, CVA)**: **Aurora & Bento Box aesthetic in pure Light Mode** (no dark mode), dynamic effort zones and athlete name via environment variables, and spectator cheer messaging ("¡Mucho ánimo!", "¡Tú puedes!", "!Sigue así!", max 50 chars) with status "Enviado" and gratitude response ("Víctor te lo agradece").

---

## Technical Decisions

### Decision 1: Web Application Framework & Architecture (Next.js Latest, Aurora + Bento Box, Light Only)
- **Decision**: Next.js 15+ (App Router, React 19) with Tailwind CSS, `class-variance-authority` (CVA), and an **Aurora & Bento Box visual style exclusively in Light Mode**.
- **Rationale**:
  - The App Router enables fast server foundations, streaming Leaflet/OSM map components via `next/dynamic` with `{ ssr: false }`, and isolating 1 Hz live metric ticks in leaf components.
  - Strict separation of concerns:
    - **Adapters / Services Layer**: `WebSocketClientAdapter` managing socket lifecycles, ping/pong heartbeats, and frame serialization.
    - **State & Custom Hooks Layer**: `useLiveTelemetry()`, `useSpectatorCheer()`, `useSessionStatus()`.
    - **Presentational UI Components**: Styled exclusively using CVA and Tailwind for Bento Box tiles (Header tile, Metric tiles, Map tile, Cheer Wall tile).
  - **Effort Zones Dynamic Resolution**:
    - Environment variables (`NEXT_PUBLIC_ZONE_1_MAX`, `NEXT_PUBLIC_ZONE_2_MAX`, `NEXT_PUBLIC_ZONE_3_MAX`, `NEXT_PUBLIC_ZONE_4_MAX`, `NEXT_PUBLIC_ZONE_5_MAX`) define the heart rate boundaries at runtime without code alterations.
  - **Athlete Name Resolution**:
    - `NEXT_PUBLIC_ATHLETE_NAME` (default "Víctor") injects the runner's name into the UI header and gratitude replies ("Víctor te lo agradece").
- **Alternatives Considered**:
  - *Dark mode toggle*: Rejected per explicit user instruction. The UI is strictly Light Mode with Aurora luminous accents.

---

### Decision 2: Android 16 Companion Gateway & Local-First Storage
- **Decision**: Kotlin + Jetpack Compose with Android Foreground Service (`RunningActivityService`) and **Room Database (SQLite WAL)**.
- **UI Specification**:
  - **Strictly Headless/Minimalist**: Explicitly **NO running metrics** displayed on the phone (no pace, no heart rate, no distance).
  - The interface only contains operational controls:
    1. Service ON/OFF switch.
    2. Garmin Fenix 7s connection state & watch battery.
    3. WebSockets streaming state & pending local buffer count.
    4. 4-Digit Spectator PIN (`3 9 1 4`) and "Share Live Link" action.
- **Local-First Storage**:
  - 100% of telemetry snapshots and notification history are stored in Room SQLite tables before network transmission, providing zero data loss during offline cellular holes.

---

### Decision 3: Wearable Tier (Garmin Fenix 7s - Native Run Integration)
- **Decision**: Connect IQ **Data Field** with Background Service (`Toybox.WatchUi.DataField` & `Toybox.Background`), NOT a standalone watch application.
- **Integration**:
  - Placed inside Garmin's native **"Carrera"** (Run) activity. The runner sees their standard Garmin screens, Garmin native GPS pacing, and native sensor data.
  - **Pre-Activity Toggle**: Inside the Data Field settings or on-device menu, the athlete can toggle `Tracking Service: [ Enabled | Disabled ]`. If disabled, it remains dormant with 0% radio overhead.
- **Notification Presentation & Interaction**:
  - Incoming spectator cheer appears as a temporary top banner overlay (occupying top 30% of display) with 2 vibration pulses, without blocking the runner's bottom metrics.
  - Auto-dismisses in 7 seconds or dismisses with `Back/Lap`.
  - Pressing `Start/Select` sends an immediate gratitude acknowledgment back to the companion app, prompting the web to show "Víctor te lo agradece".

---

### Decision 4: Spectator Cheer Messaging Protocol
- **Presets**:
  1. `"¡Mucho ánimo!"`
  2. `"¡Tú puedes!"`
  3. `"!Sigue así!"`
  4. Custom text up to 50 characters.
- **Feedback Loop**:
  - Web spectator clicks send → Immediate badge status: **"Enviado"** (Blue).
  - Delivered to Garmin watch banner during native run.
  - Runner presses reply button → Web updates to: **"${NEXT_PUBLIC_ATHLETE_NAME} te lo agradece"** (Violet).

---

### Decision 5: API Keys & External Credentials Guide (Zero Cost / Zero Required Keys)

| Component | Key Required? | Cost | Notes |
|-----------|---------------|------|-------|
| **Interactive Map (Web)** | **NO** | Free | Uses standard OpenStreetMap raster tiles via Leaflet. |
| **Garmin Connect IQ Signing** | **NO API Key** (Local RSA Key) | Free | Generated locally via OpenSSL: `openssl genrsa -out developer_key.pem 4096 && openssl pkcs8 -topk8 -inform PEM -outform DER -in developer_key.pem -out developer_key.der -nocrypt`. |
| **Android 16 Local Storage & BLE** | **NO** | Free | Local SQLite/Room DB and standard Android BLE stack. |
| **Real-Time WebSockets** | **NO** | Free | Self-hosted on Next.js / Node.js instance. |
| **Google Stitch MCP** | **OAuth2 Token** (Optional for live tool) | Free | Requires `gcloud auth application-default login` for live MCP generation; design tokens and layout specifications are directly maintained in `designs/tokens.json` and `designs/DESIGN.md`. |

---

### Decision 6: Testing & Simulation Strategy Without Physical Hardware
- **Decision**: Multi-tier simulation architecture allowing autonomous testing of Web, Android, and Garmin tiers independently without requiring physical watch hardware.
- **Tiers of Simulation**:
  1. **CLI Virtual Runner (`apps/web-dashboard/scripts/simulate-runner.ts`)**:
     - Standalone Node/TypeScript script connecting directly via WebSockets to the web app.
     - Simulates GPS movement along a real track (GPX/GeoJSON waypoints), generating 1 Hz heart rate, cadence, pace, and elevation metrics.
     - Listens for incoming spectator cheers and allows interactive button replies via terminal keyboard (e.g. pressing `[space]` or `[r]` sends the gratitude response "Víctor te lo agradece").
     - Enables 100% of Web UI, Bento Box animations, Leaflet route rendering, and cheer wall features to be developed and tested in isolation.
  2. **Android In-App Telemetry Mock (`MockTelemetryDataSource`)**:
     - Clean Architecture interface `TelemetryDataSource` with two implementations:
       - `GarminBleTelemetryDataSource`: Reads from Connect IQ Mobile SDK via BLE.
       - `MockTelemetryDataSource`: Generates realistic 1 Hz running telemetry directly inside Android.
     - Toggleable in Android development settings: permits verifying Android Room local storage, offline buffering, cellular drop recovery, and notification forwarding to the web without turning on a watch.
  3. **Official Garmin Connect IQ Simulator**:
     - Connect IQ SDK provides a desktop simulator emulating the exact Fenix 7s display (260x260 MIP) and button events.
     - Supports GPS/FIT playback simulation (`Simulation -> Activity Data`) to inject running metrics and test the Data Field top banner rendering and button delegates with mouse clicks.

