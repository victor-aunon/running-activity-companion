# Tasks: Sistema de Notificaciones Web y Experiencia del Espectador

**Input**: Design documents from `/specs/003-spectator-notifications/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, `.specify/memory/constitution.md`  
**Tests**: Mandatory per Constitution Principle IV (TDD Non-Negotiable: Red-Green-Refactor).  
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`, `[US4]`, `[US5]`)
- Exact file paths included in all task descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Definición de esquemas de contrato formal y tipos compartidos para notificaciones de espectador y distancia de carrera.

- [X] T001 Define JSON Schema Draft-2020-12 for `SpectatorNotificationEvent` in `packages/shared-contracts/spectator-notifications.schema.json`
- [X] T002 [P] Extend telemetry metrics schema to include optional `totalRaceDistanceM` (number, positive) in `packages/shared-contracts/telemetry.schema.json`
- [X] T003 [P] Export domain models (`SpectatorNotification`, `NotificationType`, `NotificationCta`) and extend `RunningMetrics` with `totalRaceDistanceM?: number` in `packages/shared-contracts/src/index.ts`
- [X] T004 Build shared contracts package and verify bundle output in `packages/shared-contracts/package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura central de retransmisión y validación de esquemas previa a la implementación de historias de usuario.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 [P] Create Ajv contract tests in `apps/web-dashboard/tests/contract/spectator-notifications-contract.test.ts` validating `SpectatorNotificationEvent` fixtures against schema
- [X] T006 Implement `room.raceDistanceM` storage in `GATEWAY_REGISTER` and automatic attachment to downstream telemetry snapshots in `apps/web-dashboard/src/services/RelayServerLogic.ts`
- [X] T007 [P] Add mock fixture data for spectator notifications, race distance, and exertion states in `apps/web-dashboard/src/fixtures/stitchVisualMock.ts`

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Envío de Ánimos sin Fricción de PIN para Espectadores Autenticados (Priority: P1) 🎯 MVP

**Goal**: Permitir al espectador autenticado enviar ánimos desde el Muro de Ánimos sin tener que volver a ver ni teclear el campo de entrada de PIN de 4 dígitos.

**Independent Test**: Acceder a una sesión activa en el dashboard con credenciales válidas y verificar que `CheerWallTile` no muestra ningún campo de entrada para el PIN, despachando mensajes autorizados con `activePin` automáticamente.

### Tests for User Story 1 (TDD Mandatory) ⚠️

- [X] T008 [P] [US1] Create component unit tests in `apps/web-dashboard/tests/unit/CheerWallTile.test.ts` verifying PIN input field is completely omitted and `activePin` is used automatically on dispatch

### Implementation for User Story 1

- [X] T009 [US1] Remove PIN input field from `SpectatorCredentialsInput` in `apps/web-dashboard/src/components/bento/CheerWallTile.tsx` and adjust `senderName` input to full width
- [X] T010 [US1] Wire `CheerWallTile` with `activePin` derived from session state in `apps/web-dashboard/src/app/session/[token]/page.tsx`

**Checkpoint**: User Story 1 is fully functional and testable as an MVP increment.

---

## Phase 4: User Story 2 - Activación Anticipada de Notificaciones y Alertas de Hitos de Carrera (Priority: P2)

**Goal**: Solicitar de forma explícita los permisos del navegador en la pantalla inicial de acceso al pulsar "Conectar en Vivo", y emitir notificaciones duales (snackbar y browser notification) al completar el 25%, 50% y 75% de la distancia total con fallback configurable.

**Independent Test**: Verificar que al pulsar "Conectar en Vivo" en `/` se solicita el permiso nativo antes de navegar, y tras ingresar con permisos concedidos, simular el avance de distancia y comprobar la aparición de snackbars y avisos de escritorio al 25%, 50% y 75%.

### Tests for User Story 2 (TDD Mandatory) ⚠️

- [X] T011 [P] [US2] Create unit tests for landing access form in `apps/web-dashboard/tests/unit/access-page.test.ts` verifying `Notification.requestPermission()` invocation prior to router navigation
- [X] T012 [P] [US2] Create unit tests in `apps/web-dashboard/tests/unit/useSpectatorNotifications.test.ts` validating distance milestone triggers (25%, 50%, 75%) against effective distance formula

### Implementation for User Story 2

- [X] T013 [US2] Implement upfront `Notification.requestPermission()` invocation upon form submission in `apps/web-dashboard/src/app/page.tsx` before `router.push`
- [X] T014 [P] [US2] Implement `NotificationSnackbarContainer` component with Aurora Bento styling, auto-dismiss (6000ms), and close button in `apps/web-dashboard/src/components/ui/NotificationSnackbarContainer.tsx`
- [X] T015 [US2] Implement distance milestone tracking and dual dispatch (snackbar queue + `new Notification()`) with web env fallback (`NEXT_PUBLIC_DEFAULT_RACE_DISTANCE_M`) in `apps/web-dashboard/src/hooks/useSpectatorNotifications.ts`
- [X] T016 [US2] Integrate `NotificationSnackbarContainer` and `useSpectatorNotifications` in `apps/web-dashboard/src/app/session/[token]/page.tsx`
- [X] T017 [P] [US2] Add `targetDistanceKm` input field (default `"10.0"`) in `apps/android-companion/app/src/main/java/com/runningsupport/companion/ui/screens/GatewayConsoleScreen.kt`
- [X] T018 [US2] Transmit `totalRaceDistanceM` in `GATEWAY_REGISTER` and telemetry metrics in `apps/android-companion/app/src/main/java/com/runningsupport/companion/network/WebSocketGatewayClient.kt` and `apps/android-companion/app/src/main/java/com/runningsupport/companion/service/RunningActivityService.kt`

**Checkpoint**: User Stories 1 AND 2 work independently.

---

## Phase 5: User Story 3 - Avisos de Alto Esfuerzo Cardíaco y Alerta de Sprint con Llamada al Ánimo (Priority: P3)

**Goal**: Emitir alertas de esfuerzo continuo (BPM > 175 con cooldown de 30s y máx 3 consecutivas) y alerta de sprint (BPM > 175 y cadencia > 180 spm, aviso único si resta <2km) con botón CTA que realiza *smooth scroll* al Muro de Ánimos y preselecciona el mensaje de sprint.

**Independent Test**: Simular telemetría con BPM > 175 y comprobar cooldown de 30s y límite de 3 avisos; simular BPM > 175 y cadencia > 180 spm y comprobar alerta de sprint y desplazamiento suave al Muro de Ánimos al hacer clic en el CTA.

### Tests for User Story 3 (TDD Mandatory) ⚠️

- [X] T019 [P] [US3] Create unit tests for exertion and sprint state machines in `apps/web-dashboard/tests/unit/useSpectatorNotifications.test.ts` validating 30s cooldown, 3-consecutive cap, reset on BPM normalization, and `<2000m` single sprint trigger
- [X] T020 [P] [US3] Create component unit tests in `apps/web-dashboard/tests/unit/NotificationSnackbarContainer.test.ts` verifying sprint CTA button click dispatches smooth scroll and preselects sprint preset

### Implementation for User Story 3

- [X] T021 [US3] Implement exertion monitoring state machine (cooldown 30s, max 3 consecutive alerts, counter reset when HR < threshold) in `apps/web-dashboard/src/hooks/useSpectatorNotifications.ts`
- [X] T022 [US3] Implement sprint alert state machine (BPM > 175, cadencia > 180 spm, single alert if remaining < 2000m, standard cooldown otherwise) with CTA payload in `apps/web-dashboard/src/hooks/useSpectatorNotifications.ts`
- [X] T023 [US3] Connect sprint CTA action to smooth scroll to `#cheer-wall` and preselect sprint preset in `apps/web-dashboard/src/components/bento/CheerWallTile.tsx` and `apps/web-dashboard/src/app/session/[token]/page.tsx`

**Checkpoint**: User Stories 1, 2, and 3 are complete and integrated.

---

## Phase 6: User Story 4 - Supresión de Alertas Pasadas para Espectadores que se Unen Tardíamente (Priority: P4)

**Goal**: Silenciar automáticamente las alertas de hitos de distancia (25%, 50%, 75%) que el corredor ya haya superado antes de que el espectador abra la sesión, emitiendo únicamente alertas de esfuerzo o sprint activas en tiempo real.

**Independent Test**: Conectar un nuevo espectador a una sesión donde la distancia acumulada ya es del 60% de la carrera y verificar que se suprimen las alertas del 25% y 50%, pero una alerta activa de esfuerzo o sprint sí se muestra de inmediato.

### Tests for User Story 4 (TDD Mandatory) ⚠️

- [X] T024 [P] [US4] Create unit tests in `apps/web-dashboard/tests/unit/useSpectatorNotifications.test.ts` validating late joiner suppression on initial telemetry snapshot and immediate evaluation of active exertion/sprint

### Implementation for User Story 4

- [X] T025 [US4] Implement initial distance snapshot evaluation in `apps/web-dashboard/src/hooks/useSpectatorNotifications.ts` marking prior milestones as already reported without triggering snackbars or browser notifications

**Checkpoint**: User Stories 1 through 4 work seamlessly together.

---

## Phase 7: User Story 5 - Controles Interactivos en el Test-Runner para Validación Manual de Alertas (Priority: P5)

**Goal**: Permitir al desarrollador y evaluador pulsar teclas en la terminal (`[k]` para +1 km, `[h]` para conmutar override a 190 bpm y `[c]` para conmutar override a 210 spm) en `simulate-runner.ts` para verificar instantáneamente todas las alertas.

**Independent Test**: Ejecutar `simulate-runner.ts`, pulsar `[k]` y comprobar que la telemetría suma 1.000 m; pulsar `[h]` y comprobar pulso fijado a 190 bpm (y alternancia al repulsar); pulsar `[c]` y comprobar cadencia a 210 spm (y alternancia al repulsar).

### Implementation for User Story 5

- [X] T026 [P] [US5] Implement raw mode TTY key handlers for `[k]` (+1 km distance offset), `[h]` (toggle 190 bpm override), and `[c]` (toggle 210 spm override) with console logging in `apps/web-dashboard/scripts/simulate-runner.ts`
- [X] T027 [US5] Update `buildTelemetryPacket` in `apps/web-dashboard/scripts/simulate-runner.ts` to apply active distance offset and overrides for heart rate and cadence

**Checkpoint**: All five user stories are complete and validated.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Verificación de extremo a extremo, pruebas de no regresión y cumplimiento de guías de calidad.

- [X] T028 [P] Update contract documentation and references in `specs/003-spectator-notifications/contracts/notifications-protocol.md`
- [X] T029 Execute full test suite verifying contract, unit, and integration tests with `pnpm test`
- [X] T030 Validate all manual validation scenarios per `specs/003-spectator-notifications/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories.
- **User Stories (Phase 3+)**:
  - **User Story 1 (P1)**: Can start after Phase 2 (Foundational).
  - **User Story 2 (P2)**: Can start after Phase 2.
  - **User Story 3 (P3)**: Depends on Phase 4 (US2) for notification container and snackbar infrastructure.
  - **User Story 4 (P4)**: Depends on Phase 4 (US2) for notification hook milestone structure.
  - **User Story 5 (P5)**: Independent script tool; can start after Phase 2.
- **Polish (Phase 8)**: Depends on completion of desired user stories.

### Parallel Opportunities

- Phase 1: `T002` and `T003` can run in parallel with `T001`.
- Phase 2: `T005` and `T007` can run in parallel with `T006`.
- Phase 3: Test task `T008` can run in parallel before implementation `T009`.
- Phase 4: `T011`, `T012`, `T014`, and `T017` can be developed in parallel.
- Phase 5: `T019` and `T020` can run in parallel before implementation.
- Phase 7: `T026` can be implemented in parallel with web frontend tasks.

---

## Parallel Example: User Story 2

```bash
# Launch test tasks and independent components for US2 together:
Task: "T011 [P] [US2] Create unit tests for landing access form in apps/web-dashboard/tests/unit/access-page.test.ts"
Task: "T012 [P] [US2] Create unit tests in apps/web-dashboard/tests/unit/useSpectatorNotifications.test.ts"
Task: "T014 [P] [US2] Implement NotificationSnackbarContainer component in apps/web-dashboard/src/components/ui/NotificationSnackbarContainer.tsx"
Task: "T017 [P] [US2] Add targetDistanceKm input field in apps/android-companion/app/src/main/java/com/runningsupport/companion/ui/screens/GatewayConsoleScreen.kt"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phase 1: Setup (`T001` - `T004`).
2. Complete Phase 2: Foundational (`T005` - `T007`).
3. Complete Phase 3: User Story 1 (`T008` - `T010`).
4. **STOP and VALIDATE**: Verify cheer submission in webapp without PIN input field.

### Incremental Delivery
1. Add User Story 2: Prompt on access page + distance milestones (25%, 50%, 75%) + Android distance setting.
2. Add User Story 3: Exertion & sprint alerts with CTA smooth scroll.
3. Add User Story 4: Late joiner suppression.
4. Add User Story 5: Interactive test runner controls (`[k]`, `[h]`, `[c]`).
5. Run full test suite and quickstart validation (Phase 8).
