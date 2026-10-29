# Implementation Plan: Sistema de Notificaciones Web y Experiencia del Espectador

**Branch**: `003-spectator-notifications` | **Date**: 2026-10-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-spectator-notifications/spec.md` para alertas web en vivo para espectadores (hitos de distancia 25/50/75%, esfuerzo cardíaco, sprint con llamada a la acción), eliminación del PIN en el Muro de Ánimos, activación anticipada de permisos de notificación en la pantalla de acceso y modo interactivo en el test-runner.

---

## Summary

Esta funcionalidad optimiza la experiencia del espectador y establece un sistema de notificaciones proactivo y reactivo:
1. **Frontend Web (`apps/web-dashboard`)**:
   - **Muro de Ánimos sin fricción**: Se elimina el campo de entrada de PIN en `CheerWallTile`, utilizando de forma transparente las credenciales de la sesión autenticada (`activePin`).
   - **Solicitud anticipada de permisos**: Al enviar el formulario de acceso en `/` ("Conectar en Vivo"), se dispara la petición nativa de la Web Notifications API para resolver el permiso antes de entrar al dashboard, garantizando una visualización sin interrupciones posteriores.
   - **Motor de Notificaciones Reactivo (`useSpectatorNotifications`)**: Orquesta la detección de hitos de distancia (25%, 50%, 75%), alertas de esfuerzo continuo (BPM > 175, cooldown de 30s, máx 3 consecutivas) y alerta de sprint (BPM > 175 y cadencia > 180 spm, aviso único si resta <2km, CTA con *smooth scroll* al Muro de Ánimos).
   - **Filtro para espectadores tardíos**: Inicializa el estado silenciando los hitos de distancia previos al momento de conexión, manteniendo activas únicamente las alertas fisiológicas en tiempo real.
   - **Componente Snackbar Aurora Bento**: Renderiza las alertas emergentes con temporizador de auto-cierre, botón de cierre manual y botón de acción directa hacia el muro de ánimo.
2. **Protocolo y Servidor Relay (`shared-contracts` & `RelayServerLogic`)**:
   - Extensión del mensaje `GATEWAY_REGISTER` y del objeto `metrics` para incluir `totalRaceDistanceM`.
   - Soporte en la webapp para variable de entorno de respaldo (`NEXT_PUBLIC_DEFAULT_RACE_DISTANCE_M`).
3. **Pasarela Android Companion (`apps/android-companion`)**:
   - Incorporación del campo `targetDistanceKm` en la interfaz de consola de pasarela para transmitir la distancia al registrar la sesión.
4. **Test-Runner Interactivo (`simulate-runner.ts`)**:
   - Atajos de teclado en modo Raw TTY: `[k]` para avanzar 1 km, `[h]` para conmutar override a 190 bpm y `[c]` para conmutar override a 210 spm.

---

## Technical Context

**Language/Version**:
- Web: TypeScript 5.x, Next.js 15+ (App Router, React 19).
- Android: Kotlin 2.x, Android 16 (API 36).
- Shared Contracts: TypeScript 5.x, JSON Schema Draft-07.

**Primary Dependencies**:
- Web: `next`, `react`, `react-dom`, `tailwindcss` (v4), `clsx`, `tailwind-merge`, `lucide-react`, `ws`.
- Shared: `@running-support/shared-contracts`.

**Storage**:
- Web: Estado en memoria reactivo gestionado por React hooks (`useSpectatorNotifications`).
- Navegador: API nativa `window.Notification` para notificaciones del sistema operativo.

**Testing**:
- Web: Node Test Runner / Vitest para pruebas unitarias de `useSpectatorNotifications` y `CheerWallTile`, Ajv para validación de contratos de notificación.

**Target Platform**:
- Web: Navegadores de escritorio y móviles compatibles con Notification API y modo responsivo Bento Aurora.
- Terminal: Consolas interactivas compatibles con modo Raw TTY para `simulate-runner.ts`.

**Performance Goals**:
- Despliegue de snackbars y avisos de navegador en menos de 1 segundo tras cruzar el umbral de telemetría.
- Navegación suave (*smooth scroll*) del CTA de sprint en menos de 500 ms.
- Respuesta a teclas de atajo de simulación en menos de 100 ms en el siguiente snapshot de 1 Hz.

**Constraints**:
- La Web Notifications API requiere invocación mediante interacción previa del usuario (*user gesture*) resuelta en la pantalla de acceso.
- Degradación elegante: el 100% de los avisos deben verse en snackbars si el usuario rechaza los permisos del navegador.
- El reloj Garmin Fenix 7s permanece desacoplado de las alertas de espectador, protegiendo su memoria heap y batería.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Rule | Status | Compliance Verification |
| :--- | :---: | :--- |
| **I. Multi-Tier Distributed Separation (Clean Architecture)** | **PASS** | El reloj Garmin Fenix 7s no procesa notificaciones de espectador; la lógica de alertas reside en el cliente web; Android solo transmite la distancia meta planificada. |
| **II. Contract-First & Schema Validation** | **PASS** | Los esquemas de telemetría y eventos de notificación están definidos formalmente en `packages/shared-contracts` con validación estricta. |
| **III. Real-Time Resilience & Offline-First Buffer** | **PASS** | La supresión de hitos pasados previene ráfagas de avisos tras caídas o reconexiones de red del espectador; el relay mantiene el metadato de distancia. |
| **IV. Test-First & Multi-Tier Verification (TDD)** | **PASS** | Pruebas de contrato y tests unitarios de las máquinas de estado de alerta planificados previo a la implementación. |
| **V. Resource Budgets, Battery Efficiency & Observability** | **PASS** | Cero consumo de ciclos de reloj; evaluación local reactiva sin sobrecarga de red; atajos de teclado ligeros en modo TTY. |

---

## Project Structure

### Documentation (this feature)

```text
specs/003-spectator-notifications/
├── plan.md              # Plan de implementación de la funcionalidad
├── research.md          # Investigación técnica de arquitectura y decisiones
├── data-model.md        # Modelos de datos, entidades y máquinas de estado
├── quickstart.md        # Guía de validación y escenarios paso a paso
├── contracts/           # Contratos JSON Schema y especificación de protocolo
│   ├── spectator-notifications.schema.json
│   └── notifications-protocol.md
└── checklists/
    └── requirements.md  # Checklist de calidad de especificación
```

### Source Code (repository root)

```text
running-activity-support/
├── packages/
│   └── shared-contracts/
│       ├── telemetry.schema.json                   # Inclusión de totalRaceDistanceM opcional
│       └── src/
│           └── index.ts                            # Tipos para SpectatorNotification, RunningMetrics
├── apps/
│   ├── web-dashboard/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── page.tsx                        # Solicitud anticipada de permisos en "Conectar en Vivo"
│   │   │   │   └── session/[token]/page.tsx        # Integración de useSpectatorNotifications y contenedor snackbar
│   │   │   ├── components/
│   │   │   │   ├── bento/
│   │   │   │   │   └── CheerWallTile.tsx           # Supresión del input de PIN y soporte de scroll target
│   │   │   │   └── ui/
│   │   │   │       └── NotificationSnackbarContainer.tsx # Componente flotante de alertas Aurora Bento
│   │   │   ├── hooks/
│   │   │   │   └── useSpectatorNotifications.ts    # Hook orquestador de alertas (hitos, esfuerzo, sprint, late joiner)
│   │   │   └── services/
│   │   │       └── RelayServerLogic.ts             # Almacenamiento y propagación de raceDistanceM
│   │   ├── scripts/
│   │   │   └── simulate-runner.ts                  # Atajos interactivos por teclado [k], [h], [c]
│   │   └── tests/
│   │       ├── unit/
│   │       │   ├── useSpectatorNotifications.test.ts # Tests de lógica temporal, cooldowns y límites
│   │       │   └── CheerWallTile.test.ts             # Verificación de omisión de campo PIN
│   │       └── contract/
│   │           └── spectator-notifications-contract.test.ts # Verificación con Ajv
│   └── android-companion/
│       └── app/src/main/java/com/runningsupport/companion/
│           ├── ui/screens/GatewayConsoleScreen.kt  # Campo de entrada para targetDistanceKm
│           ├── service/RunningActivityService.kt   # Extensión de métricas con distancia de carrera
│           └── network/WebSocketGatewayClient.kt   # Inclusión de totalRaceDistanceM en registro
```

**Structure Decision**: Se mantiene la arquitectura modular del monorepo, ubicando la lógica de UI y orquestación de alertas en `apps/web-dashboard`, los contratos compartidos en `packages/shared-contracts` y la parametrización de distancia en `apps/android-companion`.

---

## Complexity Tracking

*No se detectan violaciones a la Constitución ni a las directrices de arquitectura del proyecto.*
