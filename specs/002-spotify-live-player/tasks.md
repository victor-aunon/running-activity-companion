# Tasks: Reproductor de Spotify en Tiempo Real para Espectadores

**Input**: Design documents from `/specs/002-spotify-live-player/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, `.specify/memory/constitution.md`  
**Tests**: Mandatory per Constitution Principle IV (TDD Non-Negotiable: Red-Green-Refactor).  
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`)
- Exact file paths included in all task descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and contract schema definition for Spotify Now Playing integration.

- [x] T001 Define JSON Schema Draft-07 for `NowPlayingUpdatePacket` in `packages/shared-contracts/now-playing.schema.json`
- [x] T002 [P] Export domain models (`RunnerTrackInfo`, `RunnerPlaybackStatus`, `NowPlayingUpdatePacket`) and type guard `isNowPlayingUpdatePacket` in `packages/shared-contracts/src/index.ts`
- [x] T003 [P] Build shared contracts package and verify bundle output in `packages/shared-contracts/package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core relay infrastructure and validation suites that MUST be complete before user stories can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 [P] Create Ajv-based contract test in `apps/web-dashboard/tests/contract/now-playing-contract.test.ts` validating valid and invalid `NowPlayingUpdatePacket` fixtures against `packages/shared-contracts/now-playing.schema.json`
- [x] T005 Implement in-memory state retention and broadcast routing for `NOW_PLAYING_UPDATE` messages in `apps/web-dashboard/src/services/RelayServerLogic.ts`
- [x] T006 [P] Extend WebSocket client message handler to parse and emit `NOW_PLAYING_UPDATE` packets in `apps/web-dashboard/src/services/WebSocketClient.ts`
- [x] T007 [P] Add mock fixture data for active and idle Spotify playback states in `apps/web-dashboard/src/fixtures/stitchVisualMock.ts`

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Visualización en Tiempo Real de la Música del Corredor (Priority: P1) 🎯 MVP

**Goal**: Permitir al espectador en el dashboard web visualizar en tiempo real la pista de Spotify que el corredor está escuchando en su teléfono Android (título, artista, carátula y progreso temporal sincronizado) en un mosaico Bento Box posicionado justo encima del muro de ánimo.

**Independent Test**: Simular el envío de un paquete `NowPlayingUpdatePacket` con estado `PLAYING` y metadatos completos y verificar que `SpotifyPlayerTile` renderiza carátula (56x56 px), título (`font-semibold text-slate-800`), artista (`text-sm text-slate-500`) y barra de progreso temporal avanzando en la webapp sin recargar.

### Tests for User Story 1 (TDD Mandatory) ⚠️

- [x] T008 [P] [US1] Create unit tests for `useNowPlaying` hook in `apps/web-dashboard/tests/unit/useNowPlaying.test.ts` validating packet reception, progress interpolation formula (`currentPositionMs = Math.min(durationMs, positionMs + (now - capturedAt))`), and dynamic track updates
- [x] T009 [P] [US1] Create component unit tests for active track display in `apps/web-dashboard/tests/unit/SpotifyPlayerTile.test.ts` verifying rendering of title, artist, album art image, and progress indicator

### Implementation for User Story 1

- [x] T010 [US1] Implement `useNowPlaying` hook with 60fps client-side timer interpolation in `apps/web-dashboard/src/hooks/useNowPlaying.ts`
- [x] T011 [US1] Implement `SpotifyPlayerTile` active track layout with Aurora Light styling in `apps/web-dashboard/src/components/bento/SpotifyPlayerTile.tsx`
- [x] T012 [US1] Integrate `SpotifyPlayerTile` into `MapAndCheerColumns` in `apps/web-dashboard/src/app/session/[token]/page.tsx` directly above `CheerWallTile` in the lateral Bento column (`lg:col-span-5 xl:col-span-4`)
- [x] T013 [P] [US1] Implement Android `SpotifyMediaSessionService` using `MediaSessionManager` / `NotificationListenerService` in `apps/android-companion/app/src/main/java/com/runningsupport/companion/service/SpotifyMediaSessionService.kt` to extract `RunnerTrackInfo` and `RunnerPlaybackStatus`
- [x] T014 [US1] Wire Android companion to transmit `NowPlayingUpdatePacket` over WebSocket connection upon playback changes in `apps/android-companion/app/src/main/java/com/runningsupport/companion/network/WebSocketManager.kt`

**Checkpoint**: User Story 1 is fully functional and testable as an MVP increment.

---

## Phase 4: User Story 2 - Notificación de Estado Inactivo / Sin Música (Priority: P2)

**Goal**: Mostrar de forma inequívoca el mensaje *"No se está reproduciendo nada en el teléfono del corredor"* cuando el corredor pause la música, detenga la app o no haya iniciado Spotify en su teléfono.

**Independent Test**: Transmitir un paquete con `state: "NONE"` o `state: "STOPPED"` (con `track: null`) y comprobar que el reproductor en la webapp conmuta a la tarjeta de estado inactivo con el texto exacto sin mostrar controles deshabilitados rotos.

### Tests for User Story 2 (TDD Mandatory) ⚠️

- [x] T015 [P] [US2] Create unit tests for idle and paused states in `apps/web-dashboard/tests/unit/SpotifyPlayerTile.test.ts` verifying exact text `"No se está reproduciendo nada en el teléfono del corredor"` for `state === 'NONE'` / `'STOPPED'` y badge `"Pausado"` para `state === 'PAUSED'`
- [x] T016 [P] [US2] Create unit test in `apps/web-dashboard/tests/unit/useNowPlaying.test.ts` verifying automatic transition to idle state after 60 seconds in paused state without new events

### Implementation for User Story 2

- [x] T017 [US2] Implement idle state UI card in `apps/web-dashboard/src/components/bento/SpotifyPlayerTile.tsx` with light Aurora Bento styling (`bg-white/80`, `border-slate-200/60`, `rounded-2xl`, muted music icon) and exact text display
- [x] T018 [US2] Handle idle and paused transition logic in `apps/web-dashboard/src/hooks/useNowPlaying.ts`
- [x] T019 [US2] Implement idle state detection in Android companion when Spotify session terminates or is paused in `apps/android-companion/app/src/main/java/com/runningsupport/companion/service/SpotifyMediaSessionService.kt`

**Checkpoint**: User Stories 1 AND 2 work independently and transition smoothly between each other.

---

## Phase 5: User Story 3 - Opción para Escuchar la Misma Música en Tiempo Real (Priority: P3)

**Goal**: Permitir al espectador escuchar la misma música en tiempo real en su navegador mediante el widget oficial embebido de Spotify y proveer un botón directo para abrir la pista en la app nativa o web de Spotify.

**Independent Test**: Verificar que `SpotifyPlayerTile` incluye el iframe oficial de Spotify Embed (`https://open.spotify.com/embed/track/{trackId}`) a 80px de altura y un botón accesible "Abrir en Spotify" que abre `spotifyUrl` en una pestaña nueva sin emitir comandos hacia el móvil del corredor.

### Tests for User Story 3 (TDD Mandatory) ⚠️

- [x] T020 [P] [US3] Create unit tests in `apps/web-dashboard/tests/unit/SpotifyPlayerTile.test.ts` verifying Spotify Embed iframe attributes (`src="https://open.spotify.com/embed/track/..."`, `height="80"`), deep-link button (`target="_blank"` a `spotifyUrl`), y aislamiento estricto de controles locales sin mensajes salientes hacia el corredor

### Implementation for User Story 3

- [x] T021 [US3] Integrate the official Spotify Embed iframe (`compact bar mode`, height 80px) in `apps/web-dashboard/src/components/bento/SpotifyPlayerTile.tsx` with graceful skeleton loading
- [x] T022 [US3] Add accessible "Abrir en Spotify" deep-link action button in `apps/web-dashboard/src/components/bento/SpotifyPlayerTile.tsx`
- [x] T023 [US3] Ensure spectator playback controls are strictly local and passive (zero outbound WebSocket commands to runner's device) in `apps/web-dashboard/src/components/bento/SpotifyPlayerTile.tsx`

**Checkpoint**: All three user stories are complete, independently functional, and integrated.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Pruebas integradas de extremo a extremo, accesibilidad, responsividad y validación de quickstart.

- [x] T024 [P] Create CLI test runner simulator script in `apps/web-dashboard/scripts/simulate-now-playing.ts` to emit dynamic Spotify playback events over WebSocket
- [x] T025 [P] Audit responsive Bento layout across mobile (375px), tablet (768px) y desktop (1440px) en `apps/web-dashboard/src/app/session/[token]/page.tsx` verificando que no se produce layout shift ni desborde vertical
- [x] T026 Execute monorepo test suite verifying contract tests, unit tests, and regression tests with `pnpm test`
- [x] T027 Validate end-to-end scenarios per `specs/002-spotify-live-player/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories.
- **User Stories (Phase 3+)**: All depend on Phase 2 completion:
  - **User Story 1 (P1 - MVP)**: Can start after Phase 2.
  - **User Story 2 (P2)**: Can start after Phase 2; integrates with US1 tile states.
  - **User Story 3 (P3)**: Can start after Phase 2; embeds into US1 active tile.
- **Polish (Phase 6)**: Depends on completion of all user stories.

### User Story Dependencies

```
[Phase 1: Setup]
       │
       ▼
[Phase 2: Foundational (Relay + Schemas)]
       │
       ├───────────────────────────────┐
       ▼                               ▼
[Phase 3: US1 - Live Track (MVP)]  [Phase 4: US2 - Idle State]
       │                               ▲
       ▼                               │
[Phase 5: US3 - Spotify Embed & Play] ─┘
       │
       ▼
[Phase 6: Polish & Quickstart]
```

---

## Parallel Opportunities

- **Phase 1**: `T002` and `T003` can run in parallel with `T001`.
- **Phase 2**: `T004`, `T006`, and `T007` can run in parallel while `T005` is implemented.
- **Phase 3**: Tests `T008` and `T009` can be written in parallel. Android task `T013` can proceed in parallel with web hook `T010`.
- **Phase 4**: Tests `T015` and `T016` can run in parallel.
- **Phase 5**: Test `T020` can run before implementation.
- **Phase 6**: `T024` and `T025` can run in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete **Phase 1: Setup** (T001-T003).
2. Complete **Phase 2: Foundational** (T004-T007).
3. Complete **Phase 3: User Story 1** (T008-T014).
4. **STOP and VALIDATE**: Run Scenario 1 and Scenario 2 from `quickstart.md`. The spectator can now see the runner's music live.

### Incremental Delivery
1. Phase 1 + 2: Core protocol & relay ready.
2. User Story 1: Live track rendered on Bento Box (MVP).
3. User Story 2: Clear idle message when music stops.
4. User Story 3: Embedded player to listen along in real time.
5. Phase 6: Full validation and test pass.
