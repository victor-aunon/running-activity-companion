---
description: "Task list for feature implementation: Real-Time Running Activity Support System"
---

# Tasks: Real-Time Running Activity Support System

**Input**: Design documents from `/specs/001-running-activity-support/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, designs/, constitution.md
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.
**Quality & Design Gates**: Integrated with Vite+ (Airbnb linter, Oxlint, strict types, architecture boundaries) and Playwright Stitch visual fidelity verification.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo Root**: `packages/shared-contracts/`, `apps/web-dashboard/`, `apps/android-companion/`, `apps/garmin-fenix7s/`
- **Web App**: `apps/web-dashboard/src/`, `apps/web-dashboard/tests/`
- **Android Gateway**: `apps/android-companion/app/src/main/java/com/runningsupport/companion/`, `apps/android-companion/app/src/test/java/`
- **Garmin Fenix 7s Data Field**: `apps/garmin-fenix7s/source/`, `apps/garmin-fenix7s/resources/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo scaffolding, dependency configuration, and quality gate toolchain setup across all three platform tiers.

- [ ] T001 Initialize monorepo workspace configuration with npm/pnpm workspaces defining `apps/*` and `packages/*` in package.json
- [ ] T002 [P] Setup shared contract schema package and build scripts in packages/shared-contracts/package.json
- [ ] T003 [P] Mirror interface contracts into shared contracts package from specifications in packages/shared-contracts/telemetry.schema.json and packages/shared-contracts/notification.schema.json
- [ ] T004 [P] Configure Vite+ (vp) deterministic quality gate with Airbnb linter, Oxlint, strict TypeScript typeCheck, cyclomatic complexity limit (max 10), line limit (max 50), and Clean Architecture layer boundary import restrictions in apps/web-dashboard/vite.config.ts
- [ ] T005 [P] Configure Playwright visual regression test harness for Stitch design fidelity against specs/001-running-activity-support/designs/routes-manifest.json in apps/web-dashboard/playwright.design.config.ts
- [ ] T006 [P] Initialize Next.js 15+ web dashboard project configuration, dependencies (`next`, `react`, `react-dom`, `tailwindcss`, `class-variance-authority`, `clsx`, `tailwind-merge`, `leaflet`, `lucide-react`, `ws`), and scripts in apps/web-dashboard/package.json
- [ ] T007 [P] Configure Next.js TypeScript compiler options with strict type checking and `@/*` path alias in apps/web-dashboard/tsconfig.json
- [ ] T008 [P] Configure environment variable declarations and defaults (`NEXT_PUBLIC_ATHLETE_NAME=Víctor`, `NEXT_PUBLIC_ZONE_1_MAX=130` to `NEXT_PUBLIC_ZONE_5_MAX=195`, `NEXT_PUBLIC_WS_URL=ws://localhost:3000/api/ws/session`, `PORT=3000`) in apps/web-dashboard/.env.example
- [ ] T009 [P] Initialize Android 16 companion gateway project build configuration, Kotlin 2.x, Jetpack Compose, Room DB, and AndroidX libraries in apps/android-companion/build.gradle.kts
- [ ] T010 [P] Initialize Garmin Fenix 7s Connect IQ Data Field manifest, permissions (`Communications`, `Sensor`, `Position`), and jungle build configuration in apps/garmin-fenix7s/manifest.xml and apps/garmin-fenix7s/monkey.jungle

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure, shared protocol types, atomic UI primitives, database schema, and socket adapters that MUST be complete before ANY user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T011 [P] Generate TypeScript interfaces and type guards from telemetry and notification schemas in packages/shared-contracts/src/index.ts
- [ ] T012 [P] Integrate Aurora & Bento Box design tokens, luminous glow gradients (`rgba(249, 115, 22, 0.14)`), and pure Light Mode color variables from specs/001-running-activity-support/designs/tokens.json into apps/web-dashboard/src/app/globals.css
- [ ] T013 [P] Implement CVA StatusBadge atomic component with status variants (`live`, `enviado`, `agradecido`, `expirado`) in apps/web-dashboard/src/components/ui/badge.tsx
- [ ] T014 [P] Implement CVA ActionButton atomic component with touch-friendly minimum 44x44px target and athletic gradient variants in apps/web-dashboard/src/components/ui/button.tsx
- [ ] T015 [P] Implement resilient WebSocket client adapter with ping/pong heartbeats (15s interval) and exponential backoff in apps/web-dashboard/src/services/WebSocketClient.ts
- [ ] T016 [P] Implement WebSocket relay server with room-based session routing (`/api/ws/session?token=...&role=...`) in apps/web-dashboard/src/app/api/ws/session/route.ts
- [ ] T017 [P] Implement Android Room Database (`AppDatabase`) with SQLite WAL mode and schema versioning in apps/android-companion/app/src/main/java/com/runningsupport/companion/data/AppDatabase.kt
- [ ] T018 [P] Implement Android WebSocket gateway client (`WebSocketGatewayClient`) with automatic reconnect for uplink streaming in apps/android-companion/app/src/main/java/com/runningsupport/companion/network/WebSocketGatewayClient.kt
- [ ] T019 [P] Implement Garmin Connect IQ BLE transmitter wrapper (`BleTransmitter`) with Toybox Communications in apps/garmin-fenix7s/source/BleTransmitter.mc

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Real-Time Activity Tracking & Live Metric Streaming in Native Run (Priority: P1) 🎯 MVP

**Goal**: Live running telemetry (heart rate, pace, cadence, distance, elapsed time) and GPS coordinates streamed at 1 Hz from Garmin native Run activity via Android gateway to Next.js Aurora Bento Box dashboard in Light Mode with dynamic effort zones and Leaflet route map.

**Independent Test**: Launch CLI virtual runner with `--token=test-session`, open `http://localhost:3000/session/test-session`, verify 1 Hz telemetry metrics update with sub-second latency, heart rate zone badge reflects env thresholds, and Leaflet route tracks runner's GPS path.

### Tests for User Story 1 (TDD - Test First) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T020 [P] [US1] Unit test for effort zone resolver verifying boundaries against env vars (`NEXT_PUBLIC_ZONE_1_MAX` to `NEXT_PUBLIC_ZONE_5_MAX`) in apps/web-dashboard/tests/unit/useEffortZones.test.ts
- [ ] T021 [P] [US1] Contract test for 1 Hz telemetry packet serialization and schema validation in apps/web-dashboard/tests/contract/telemetry-contract.test.ts
- [ ] T022 [P] [US1] Unit test for Android Room TelemetryBufferDao verifying insert, query, and sync in apps/android-companion/app/src/test/java/com/runningsupport/companion/TelemetryBufferDaoTest.kt

### Implementation for User Story 1

- [ ] T023 [P] [US1] Create TelemetrySnapshot entity model with constraints: `seq` (minimum 0), `timestamp` (Unix epoch ms), `latitude` (-90.0 to 90.0), `longitude` (-180.0 to 180.0), `elevationM` (number), `heartRate` (0 to 250 bpm), `speedMps` (>= 0.0), `paceSecPerKm` (>= 0.0), `cadence` (0 to 300 spm), `totalDistanceM` (>= 0.0), `elapsedSeconds` (>= 0) in apps/web-dashboard/src/types/telemetry.ts
- [ ] T024 [P] [US1] Create Android Room TelemetryEntity and SessionEntity with SQLite schema and indexes in apps/android-companion/app/src/main/java/com/runningsupport/companion/data/entities/TelemetryEntity.kt
- [ ] T025 [P] [US1] Implement TelemetryBufferDao with queries for unsynced packets in apps/android-companion/app/src/main/java/com/runningsupport/companion/data/daos/TelemetryBufferDao.kt
- [ ] T026 [P] [US1] Implement `useEffortZones` hook resolving heart rate into Zone 1 to Zone 5 with athletic color classes based on `NEXT_PUBLIC_ZONE_1_MAX` to `NEXT_PUBLIC_ZONE_5_MAX` in apps/web-dashboard/src/hooks/useEffortZones.ts
- [ ] T027 [P] [US1] Implement `useLiveTelemetry` hook consuming 1 Hz snapshots via WebSocketClient in apps/web-dashboard/src/hooks/useLiveTelemetry.ts
- [ ] T028 [P] [US1] Implement Bento Box HeaderTile displaying athlete name from `NEXT_PUBLIC_ATHLETE_NAME` (default "Víctor"), live locality derived from GPS coords, elapsed time, and battery indicators in apps/web-dashboard/src/components/bento/HeaderTile.tsx
- [ ] T029 [P] [US1] Implement Bento Box MetricTile with CVA variants for monospace KPI rendering (pace in min/km, heart rate with zone pill, cadence in spm, distance in km) in apps/web-dashboard/src/components/bento/MetricTile.tsx
- [ ] T030 [P] [US1] Implement Bento Box MapTile using Leaflet with OpenStreetMap tiles (no API key required), live GPS marker with Aurora glow, and polyline route tracing in apps/web-dashboard/src/components/bento/MapTile.tsx
- [ ] T031 [P] [US1] Implement BentoGrid responsive container (1 col mobile, 2 col tablet, 4 col desktop) in apps/web-dashboard/src/components/bento/BentoGrid.tsx
- [ ] T032 [US1] Implement Live Dashboard page container assembling Bento tiles inside Aurora mesh backdrop in apps/web-dashboard/src/app/session/[token]/page.tsx
- [ ] T033 [P] [US1] Implement Garmin Connect IQ Data Field (`RunningSupportDataField`) sampling 1 Hz metrics from native Run sensors in apps/garmin-fenix7s/source/RunningSupportDataField.mc
- [ ] T034 [P] [US1] Implement Android GarminDataFieldManager receiving BLE packets from Connect IQ and inserting into Room buffer in apps/android-companion/app/src/main/java/com/runningsupport/companion/garmin/GarminDataFieldManager.kt
- [ ] T035 [P] [US1] Implement CLI Virtual Runner script (`simulate-runner.ts`) generating 1 Hz synthetic GPS and biometric packets along a GPX track in apps/web-dashboard/scripts/simulate-runner.ts
- [ ] T036 [US1] Validate Stitch visual fidelity against specs/001-running-activity-support/designs/screen-live-dashboard.png using Playwright in apps/web-dashboard/tests/design/live-dashboard-visual.spec.ts

**Checkpoint**: At this point, User Story 1 is fully functional and testable independently as the standalone MVP.

---

## Phase 4: User Story 2 - Spectator Cheer Messages & Runner Gratitude Response (Priority: P2)

**Goal**: Spectators send cheer messages ("¡Mucho ánimo!", "¡Tú puedes!", "!Sigue así!", or custom text <= 50 chars) with 4-digit PIN, see status "Enviado", watch displays non-obstructive top banner overlay with haptics in native run, and runner pressing Select replies with "${ATHLETE_NAME} te lo agradece" back to web.

**Independent Test**: From web dashboard, enter 4-digit PIN `4829`, click "¡Mucho ánimo!", verify badge turns to "Enviado", simulated watch banner receives message, runner trigger replies, and web dashboard updates cheer status to "Víctor te lo agradece".

### Tests for User Story 2 (TDD - Test First) ⚠️

- [ ] T037 [P] [US2] Contract test for cheer dispatch and gratitude status update payloads in apps/web-dashboard/tests/contract/notification-contract.test.ts
- [ ] T038 [P] [US2] Unit test for `useSpectatorCheer` hook managing cheer lifecycle and PIN validation in apps/web-dashboard/tests/unit/useSpectatorCheer.test.ts
- [ ] T039 [P] [US2] Unit test for Android CheerDao and notification queue lifecycle in apps/android-companion/app/src/test/java/com/runningsupport/companion/CheerDaoTest.kt

### Implementation for User Story 2

- [ ] T040 [P] [US2] Create SpectatorCheerMessage entity model with constraints: `notificationId` (UUIDv4), `sessionId` (UUIDv4), `spectatorPin` (Regex `^\d{4}$`), `senderName` (max 20 chars), `presetId` (`enum: ["MUCHO_ANIMO", "TU_PUEDES", "SIGUE_ASI", "CUSTOM"]`), `body` (1 to 50 characters, UTF-8), `ttlSeconds` (10 to 300, default: 60), `status` (`enum: ["ENVIADO", "EN_RELOJ", "AGRADECIDO", "EXPIRADO"]`), `runnerReplyText` (string) in apps/web-dashboard/src/types/cheer.ts
- [ ] T041 [P] [US2] Create Android Room CheerEntity and CheerDao for persisting incoming and outgoing cheer states in apps/android-companion/app/src/main/java/com/runningsupport/companion/data/entities/CheerEntity.kt and apps/android-companion/app/src/main/java/com/runningsupport/companion/data/daos/CheerDao.kt
- [ ] T042 [P] [US2] Implement `useSpectatorCheer` hook handling PIN prompt, preset dispatch, custom text counter (max 50 chars), and live cheer feed in apps/web-dashboard/src/hooks/useSpectatorCheer.ts
- [ ] T043 [P] [US2] Implement Bento Box CheerWallTile with vibrant preset action buttons ("¡Mucho ánimo!" in amber, "¡Tú puedes!" in emerald, "!Sigue así!" in indigo), custom input, and cheer feed with live status badges in apps/web-dashboard/src/components/bento/CheerWallTile.tsx
- [ ] T044 [US2] Integrate CheerWallTile into BentoGrid layout on the dashboard page in apps/web-dashboard/src/app/session/[token]/page.tsx
- [ ] T045 [P] [US2] Implement Garmin top banner overlay (`NotificationBannerOverlay`) occupying top 30% of display with 2 haptic vibration pulses and 7-second auto-dismiss in apps/garmin-fenix7s/source/NotificationBannerOverlay.mc
- [ ] T046 [P] [US2] Implement Garmin action button delegate (`DataFieldMenuDelegate`) capturing Select keypress to dispatch gratitude acknowledgment via BLE in apps/garmin-fenix7s/source/DataFieldMenuDelegate.mc
- [ ] T047 [US2] Implement Android notification forwarding in RunningActivityService relaying incoming Web cheers to Garmin Data Field and outgoing replies to WebSocket gateway in apps/android-companion/app/src/main/java/com/runningsupport/companion/service/RunningActivityService.kt
- [ ] T048 [US2] Update CLI Virtual Runner to receive `DISPATCH_CHEER` events and support terminal keypress `[r]` to send gratitude reply `CHEER_STATUS_UPDATE` in apps/web-dashboard/scripts/simulate-runner.ts

**Checkpoint**: At this point, User Stories 1 AND 2 both work independently and integrate seamlessly.

---

## Phase 5: User Story 3 - Pre-Activity Activation & Offline Local Storage (Priority: P3)

**Goal**: Runner enables/disables tracking service prior to workout in Garmin Data Field on-device settings (`Servicio En Vivo: [ ACTIVADO | DESACTIVADO ]`). Android companion operates offline-first with Room DB buffering 100% of telemetry when offline, draining automatically on reconnection. Minimalist headless Android console displaying ZERO running metrics, only connection state, buffer count, and spectator PIN.

**Independent Test**: In Android gateway, toggle mock simulation mode, activate Airplane mode to simulate connection drop, verify buffer count increments in Room DB; deactivate Airplane mode, verify all queued records drain to web with zero data loss. In Garmin settings, toggle service OFF and verify zero BLE broadcast.

### Tests for User Story 3 (TDD - Test First) ⚠️

- [ ] T049 [P] [US3] Unit test for Garmin Data Field pre-run toggle logic ensuring zero BLE transmissions when disabled in apps/garmin-fenix7s/test/RunningSupportDataFieldTest.mc
- [ ] T050 [P] [US3] Unit test for Android buffer synchronization logic under network interruption in apps/android-companion/app/src/test/java/com/runningsupport/companion/WebSocketGatewayClientTest.kt

### Implementation for User Story 3

- [ ] T051 [P] [US3] Implement Garmin Connect IQ on-device settings XML and property definition for pre-run activation toggle (`Servicio En Vivo`) in apps/garmin-fenix7s/resources/settings/settings.xml and apps/garmin-fenix7s/resources/settings/properties.xml
- [ ] T052 [P] [US3] Implement pre-activity toggle check in `RunningSupportDataField` preventing sensor capture and BLE broadcast when dormant in apps/garmin-fenix7s/source/RunningSupportDataField.mc
- [ ] T053 [P] [US3] Implement Android MockTelemetryDataSource generating 1 Hz test telemetry without physical watch in apps/android-companion/app/src/main/java/com/runningsupport/companion/garmin/MockTelemetryDataSource.kt
- [ ] T054 [P] [US3] Implement Android Room buffer draining engine in WebSocketGatewayClient with batching and retry backoff in apps/android-companion/app/src/main/java/com/runningsupport/companion/network/WebSocketGatewayClient.kt
- [ ] T055 [P] [US3] Implement Android Jetpack Compose Headless Console screen (`GatewayConsoleScreen`) showing ONLY service switch, Garmin BLE status, pending buffer count, 4-digit PIN, and ZERO running metrics in apps/android-companion/app/src/main/java/com/runningsupport/companion/ui/screens/GatewayConsoleScreen.kt
- [ ] T056 [US3] Implement Android MainActivity hosting GatewayConsoleScreen with foreground service permissions and wakelock handling in apps/android-companion/app/src/main/java/com/runningsupport/companion/ui/MainActivity.kt

**Checkpoint**: All three user stories are now independently functional and fully resilient to offline network conditions.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories, responsive hardening, quality gates, and final end-to-end verification.

- [ ] T057 [P] Implement spectator landing / session lookup page with PIN entry and token validation in apps/web-dashboard/src/app/page.tsx
- [ ] T058 [P] Implement responsive layout optimizations across mobile (390px-430px), tablet (768px-1024px), and desktop (1280px-1440px+) viewports in apps/web-dashboard/src/app/session/[token]/page.tsx
- [ ] T059 [P] Implement session completion summary banner with final metrics and export option in apps/web-dashboard/src/components/bento/SessionSummaryModal.tsx
- [ ] T060 Run Vite+ deterministic quality gate check (`vp check` or `.specify/scripts/bash/check-quality-gate.sh`) across all web dashboard source files
- [ ] T061 Run Playwright Stitch visual fidelity audit (`.specify/scripts/bash/verify-stitch-design.sh`) against specs/001-running-activity-support/designs/routes-manifest.json
- [ ] T062 Execute end-to-end quickstart validation scenario with CLI virtual runner per specs/001-running-activity-support/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories.
- **User Stories (Phase 3+)**: All depend on Foundational phase completion.
  - User stories can then proceed in parallel (if staffed) or sequentially in priority order (P1 → P2 → P3).
- **Polish (Phase 6)**: Depends on all user stories being complete.

```
Phase 1: Setup
     │
     ▼
Phase 2: Foundational (Prerequisites)
     │
     ├──────────────────────┬──────────────────────┐
     ▼                      ▼                      ▼
Phase 3: US1 (P1 MVP)   Phase 4: US2 (P2)      Phase 5: US3 (P3)
     │                      │                      │
     └──────────────────────┴──────────────────────┘
                            │
                            ▼
                     Phase 6: Polish
```

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2). No dependencies on other stories. Delivers standalone MVP.
- **User Story 2 (P2)**: Can start after Foundational (Phase 2). Integrates with US1 dashboard page (`page.tsx`) by embedding the CheerWallTile, but cheer protocol models and hooks are independently testable.
- **User Story 3 (P3)**: Can start after Foundational (Phase 2). Integrates with US1 Data Field (`RunningSupportDataField.mc`) and Android gateway (`RunningActivityService.kt`), but buffer logic and headless UI are independently testable.

### Within Each User Story

- Tests MUST be written and fail before implementation (TDD non-negotiable per Constitution IV).
- Models before services.
- Services and hooks before UI components.
- Atomic components before page containers.
- Story complete and validated before moving to next priority.

---

## Parallel Opportunities & Execution Examples

### Parallel Opportunities within Phases

- **Phase 1 (Setup)**: Tasks T002, T003, T004, T005, T006, T007, T008, T009, T010 can all run in parallel across web, mobile, and wearable configs.
- **Phase 2 (Foundational)**: Tasks T011, T012, T013, T014, T015, T016, T017, T018, T019 can all run in parallel across frontend, backend socket, Android Room, and Garmin BLE.
- **Phase 3 (US1)**:
  - Tests T020, T021, T022 can run in parallel.
  - Models & UI components T023, T024, T025, T026, T027, T028, T029, T030, T031, T033, T034, T035 can run in parallel.
- **Phase 4 (US2)**:
  - Tests T037, T038, T039 can run in parallel.
  - Implementation tasks T040, T041, T042, T043, T045, T046 can run in parallel.
- **Phase 5 (US3)**:
  - Tests T049, T050 can run in parallel.
  - Implementation tasks T051, T052, T053, T054, T055 can run in parallel.

### Parallel Execution Example: User Story 1 (P1)

```bash
# Launch unit and contract tests in parallel:
Task T020: "Unit test for effort zone resolver in apps/web-dashboard/tests/unit/useEffortZones.test.ts"
Task T021: "Contract test for 1 Hz telemetry packet in apps/web-dashboard/tests/contract/telemetry-contract.test.ts"
Task T022: "Unit test for Android Room TelemetryBufferDao in apps/android-companion/app/src/test/java/com/runningsupport/companion/TelemetryBufferDaoTest.kt"

# Launch Bento Box UI components in parallel:
Task T028: "Implement Bento Box HeaderTile in apps/web-dashboard/src/components/bento/HeaderTile.tsx"
Task T029: "Implement Bento Box MetricTile in apps/web-dashboard/src/components/bento/MetricTile.tsx"
Task T030: "Implement Bento Box MapTile in apps/web-dashboard/src/components/bento/MapTile.tsx"
Task T031: "Implement BentoGrid container in apps/web-dashboard/src/components/bento/BentoGrid.tsx"
```

### Parallel Execution Example: User Story 2 (P2)

```bash
# Launch watch banner and web cheer tile in parallel:
Task T043: "Implement Bento Box CheerWallTile in apps/web-dashboard/src/components/bento/CheerWallTile.tsx"
Task T045: "Implement Garmin top banner overlay in apps/garmin-fenix7s/source/NotificationBannerOverlay.mc"
Task T046: "Implement Garmin action button delegate in apps/garmin-fenix7s/source/DataFieldMenuDelegate.mc"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (Monorepo, Next.js, Android, Garmin configs).
2. Complete Phase 2: Foundational (Schemas, types, WebSocket server/client, Room DB).
3. Complete Phase 3: User Story 1 (1 Hz telemetry streaming, Bento tiles, Leaflet map, CLI virtual runner).
4. **STOP and VALIDATE**: Test User Story 1 independently with `npm run simulate:runner` and Playwright visual audit.
5. Deploy/demo the live running telemetry MVP!

### Incremental Delivery

1. Complete Setup + Foundational → Foundation verified.
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!).
3. Add User Story 2 → Test spectator cheers and watch banner reply independently.
4. Add User Story 3 → Test offline Room buffering and pre-activity activation switch.
5. Polish & Verification → Run `vp check` quality gate and Stitch visual regression suite.

### Parallel Team Strategy

With multiple developers:
1. Team completes Setup + Foundational together.
2. Once Foundational is done:
   - Developer A (Web Frontend): User Story 1 Web Dashboard + User Story 2 Cheer Wall.
   - Developer B (Android): User Story 1 Gateway Relay + User Story 3 Offline Buffer & Headless UI.
   - Developer C (Garmin): User Story 1 Data Field + User Story 2 Top Banner Overlay + User Story 3 Pre-run Toggle.
3. Stories integrate via shared contract schemas with zero cross-tier blocking.

---

## Notes

- `[P]` tasks = different files, no dependencies on incomplete tasks.
- `[Story]` label maps task to specific user story for traceability (`[US1]`, `[US2]`, `[US3]`).
- TDD is strictly enforced: test tasks must be written and fail before implementation.
- All tasks strictly adhere to the `- [ ] [TaskID] [P?] [Story?] Description with file path` format.
- Quoted data model constraints ensure zero implementation-time ambiguity.
