# Implementation Plan: Reproductor de Spotify en Tiempo Real para Espectadores

**Branch**: `002-spotify-live-player` | **Date**: 2026-10-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-spotify-live-player/spec.md` for live Spotify player tile in web dashboard placed directly above the cheer wall, reflecting the runner's Android phone playback, clear idle notification when stopped, and real-time listening option for spectators via Spotify Embed.

---

## Summary

Esta funcionalidad integra la monitorización y reproducción musical en vivo en el ecosistema:
1. **Android Companion Gateway (Kotlin / Android 16)**: Detecta eventos de reproducción de Spotify en segundo plano mediante `MediaSessionManager` / `NotificationListenerService` y `BroadcastReceiver`, emitiendo paquetes `NowPlayingUpdatePacket` de forma reactiva sin impacto en la batería ni en la telemetría de carrera.
2. **Protocolo y Relay Server (`shared-contracts` & WebSocket)**: Introduce el mensaje formal `NOW_PLAYING_UPDATE` validado por esquema JSON Schema, retransmitido a través del servidor WebSocket existente a todos los espectadores de la sesión con retención de último estado en memoria.
3. **Dashboard Web Espectador (Next.js 15+ / React / Tailwind)**: Incorpora el componente `SpotifyPlayerTile` en la columna lateral de la cuadrícula Bento Box, ubicado exactamente encima de `CheerWallTile` ("Muro de Ánimo"). En estado activo muestra carátula, título, artista, progreso sincronizado en el cliente, el widget oficial de Spotify Embed para escuchar en tiempo real y el botón "Abrir en Spotify". En estado inactivo o en pausa muestra claramente: *"No se está reproduciendo nada en el teléfono del corredor"*.

---

## Technical Context

**Language/Version**:
- Web: TypeScript 5.x, Next.js 15+ (App Router, React 19).
- Android: Kotlin 2.x, Android 16 (API 36, Min SDK 28).
- Shared Contracts: TypeScript 5.x, JSON Schema Draft-07.

**Primary Dependencies**:
- Web: `next`, `react`, `react-dom`, `tailwindcss` (v4), `clsx`, `tailwind-merge`, `lucide-react`, `ws`.
- Android: `MediaSessionManager`, `NotificationListenerService`, Kotlin Coroutines & Flow.
- Shared: `@running-support/shared-contracts`.

**Storage**:
- Web: Estado en memoria reactivo en hook `useNowPlaying` (Zustand / React Context / WebSocket listener).
- Android: Caché volátil del último estado de Spotify emitido para deduplicación.

**Testing**:
- Web: Vitest / Jest para pruebas unitarias de `useNowPlaying`, Playwright para pruebas visuales Bento Box, Ajv para pruebas de contrato de esquema JSON.
- Android: JUnit 5, Mockito / MockK para listeners de `MediaSession`.

**Target Platform**:
- Web: Navegadores modernos de escritorio, tableta y móvil en modo claro (Aurora Bento Box).
- Android: Dispositivos físicos Android 16 con Spotify instalado.

**Performance Goals**:
- Latencia de propagación de cambio de canción < 2.5 segundos.
- Avance de barra de progreso fluido a 60 fps en el cliente mediante interpolación temporal.
- Cero consumo de ciclos de reloj Garmin Fenix 7s (la música no pasa por el reloj).

**Constraints**:
- La interacción del espectador en la webapp es estrictamente unidireccional y de escucha local (nunca envía comandos de control de reproducción al teléfono del corredor).
- Presupuesto de batería del companion: < 1.5% adicional por hora de actividad.
- Conformidad visual con el sistema Bento Box Aurora en modo claro y WCAG AA.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Status | Compliance Verification |
| :--- | :---: | :--- |
| **I. Multi-Tier Distributed Separation (Clean Architecture)** | **PASS** | El reloj Garmin Fenix 7s queda completamente aislado de este flujo; la captura en Android desacopla el reproductor local del transporte WebSocket; el cliente web aísla el widget de los hooks de telemetría. |
| **II. Contract-First & Schema Validation** | **PASS** | Mensaje de protocolo `NOW_PLAYING_UPDATE` especificado con JSON Schema formal en `contracts/now-playing.schema.json` y tipado en `@running-support/shared-contracts`. |
| **III. Real-Time Resilience & Offline-First Buffer** | **PASS** | El relay almacena el último estado en memoria para nuevos espectadores; las desconexiones temporales en el móvil no rompen el dashboard y conmutan limpiamente a estado inactivo. |
| **IV. Test-First & Multi-Tier Verification (TDD)** | **PASS** | Pruebas de contrato y tests unitarios de `useNowPlaying` y `SpotifyPlayerTile` definidos y planificados previo a la implementación. |
| **V. Resource Budgets, Battery Efficiency & Observability** | **PASS** | Captura 100% reactiva por eventos en Android sin polling, protegiendo wakelocks y batería; interpolación de tiempo en cliente web para no saturar el canal de red. |

---

## Project Structure

```text
running-activity-support/
├── packages/
│   └── shared-contracts/
│       ├── now-playing.schema.json             # Nuevo esquema JSON Draft-07 de Now Playing
│       └── src/
│           └── index.ts                        # Exportaciones de RunnerTrackInfo, RunnerPlaybackStatus y guards
├── apps/
│   ├── web-dashboard/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   └── bento/
│   │   │   │       └── SpotifyPlayerTile.tsx   # Nuevo componente Bento para Spotify
│   │   │   ├── hooks/
│   │   │   │       └── useNowPlaying.ts        # Nuevo hook con interpolación y sincronización WebSocket
│   │   │   ├── services/
│   │   │   │       └── RelayServerLogic.ts     # Soporte para retención y retransmisión de NOW_PLAYING_UPDATE
│   │   │   ├── app/
│   │   │   │   └── session/[token]/page.tsx    # Inserción de SpotifyPlayerTile justo encima de CheerWallTile
│   │   │   └── fixtures/
│   │   │       └── stitchVisualMock.ts         # Datos de prueba para previsualización de Now Playing
│   │   └── tests/
│   │       ├── contract/
│   │       │   └── now-playing-contract.test.ts # Verificación de contrato con Ajv
│   │       └── unit/
│   │           ├── useNowPlaying.test.ts       # Pruebas de interpolación y transiciones de estado
│   │           └── SpotifyPlayerTile.test.ts   # Pruebas de renderizado de estados activo e inactivo
│   └── android-companion/
│       └── app/src/main/java/com/runningsupport/companion/
│           ├── service/
│           │   └── SpotifyMediaSessionService.kt # Listener de eventos multimedia de Android
│           └── network/
│               └── WebSocketManager.kt          # Emisión de paquetes NOW_PLAYING_UPDATE
└── specs/
    └── 002-spotify-live-player/
        ├── spec.md
        ├── plan.md
        ├── research.md
        ├── data-model.md
        ├── quickstart.md
        └── contracts/
            ├── now-playing.schema.json
            └── spotify-widget-contract.md
```

**Structure Decision**: Se mantiene la arquitectura monorepo de paquetes compartidos (`@running-support/shared-contracts`) consumidos por el dashboard web (`apps/web-dashboard`) y el gateway móvil (`apps/android-companion`), garantizando la validación de contratos en tiempo de compilación y ejecución.

---

## Complexity Tracking

*No se detectan violaciones de complejidad respecto a la Constitución. La funcionalidad se apoya en los patrones ya ratificados en el sistema.*
