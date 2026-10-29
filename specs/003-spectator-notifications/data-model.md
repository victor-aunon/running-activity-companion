# Data Model: Sistema de Notificaciones Web y Experiencia del Espectador

**Feature**: `003-spectator-notifications`  
**Date**: 2026-10-29  
**Spec Reference**: [spec.md](./spec.md) | [research.md](./research.md)

---

## 1. Domain Entities & State Models

### 1.1 `RaceDistanceConfig`

Representa la configuración de distancia total de la carrera obtenida por jerarquía de resolución.

| Campo | Tipo | Requerido | Descripción | Reglas de Validación |
| :--- | :--- | :---: | :--- | :--- |
| `totalRaceDistanceM` | `number \| undefined` | No | Distancia objetivo total en metros enviada por la pasarela móvil | Número positivo $> 0$ |
| `fallbackRaceDistanceM` | `number` | Sí | Distancia de respaldo por entorno web (`NEXT_PUBLIC_DEFAULT_RACE_DISTANCE_M`) | Número positivo en metros $> 0$ (Default: `10000`) |
| `effectiveDistanceM` | `number` | Sí | Distancia resuelta para el cómputo de porcentajes y cuenta regresiva | Valor positivo calculado ($\ge 1000$) |

**Jerarquía de resolución:**
$$\text{effectiveDistanceM} = \text{totalRaceDistanceM} \;\lor\; \text{fallbackRaceDistanceM} \;\lor\; 10000$$

---

### 1.2 `SpectatorNotification`

Representa una alerta visual y de sistema generada para el espectador en la webapp.

| Campo | Tipo | Requerido | Descripción | Reglas de Validación |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `string` | Sí | Identificador único de la notificación | Formato UUID o `notif-${timestamp}-${type}` |
| `type` | `NotificationType` | Sí | Tipo o categoría de la alerta | Uno de: `'MILESTONE_25'`, `'MILESTONE_50'`, `'MILESTONE_75'`, `'EXERTION'`, `'SPRINT'` |
| `title` | `string` | Sí | Título corto destacado de la alerta | Máximo 60 caracteres |
| `message` | `string` | Sí | Cuerpo descriptivo de la notificación | Máximo 160 caracteres con interpolación de `{{corredor}}` |
| `timestamp` | `number` | Sí | Marca de tiempo Unix epoch en milisegundos de emisión | Entero positivo UTC |
| `cta` | `NotificationCta \| null` | No | Acción rápida opcional asociada a la notificación | Objeto `NotificationCta` (en alertas de sprint) |
| `durationMs` | `number` | Sí | Tiempo de permanencia antes del auto-cierre del snackbar | Entero positivo (Default: `6000` ms) |

**Enumerado `NotificationType`:**
- `'MILESTONE_25'`: Corredor alcanza el 25% de la distancia total.
- `'MILESTONE_50'`: Corredor alcanza el 50% de la distancia total (ecuador de carrera).
- `'MILESTONE_75'`: Corredor alcanza el 75% de la distancia total (fase decisiva).
- `'EXERTION'`: Frecuencia cardíaca continuada por encima del umbral de esfuerzo.
- `'SPRINT'`: Frecuencia cardíaca alta y cadencia elevada simultáneamente con botón de ánimo.

**Estructura `NotificationCta`:**
```typescript
export interface NotificationCta {
  label: string; // ej. "¡Envíale un ánimo!"
  action: 'SCROLL_CHEER_WALL';
  presetId?: 'MUCHO_ANIMO' | 'TU_PUEDES' | 'SIGUE_ASI';
  customText?: string;
}
```

---

### 1.3 `NotificationEngineState`

Estructura de memoria local por cliente espectador gestionada por el hook `useSpectatorNotifications`.

| Campo | Tipo | Inicial | Descripción |
| :--- | :--- | :---: | :--- |
| `milestonesReported` | `{ p25: boolean; p50: boolean; p75: boolean }` | `{ p25: false, p50: false, p75: false }` | Banderas irreversibles de hitos ya notificados |
| `exertionConsecutiveCount` | `number` | `0` | Contador de alertas de esfuerzo consecutivas emitidas ($0 \dots 3$) |
| `lastExertionTimestamp` | `number` | `0` | Marca de tiempo de la última notificación de esfuerzo emitida |
| `sprintConsecutiveCount` | `number` | `0` | Contador de alertas de sprint consecutivas emitidas ($0 \dots 3$) |
| `lastSprintTimestamp` | `number` | `0` | Marca de tiempo de la última notificación de sprint emitida |
| `finalSprintEmitted` | `boolean` | `false` | Indica si ya se emitió el aviso único de sprint a $<2\text{km}$ de meta |
| `isLateJoinerEvaluated` | `boolean` | `false` | Indica si el primer snapshot suprimió los hitos pasados del espectador |

---

### 1.4 `SimulationOverrideState` (Test-Runner `simulate-runner.ts`)

Estado interactivo en tiempo de ejecución del script simulador por pulsaciones de teclado TTY.

| Campo | Tipo | Inicial | Control Teclado | Efecto en Telemetría |
| :--- | :--- | :---: | :---: | :--- |
| `distanceOffsetM` | `number` | `0` | Tecla `[k]` | Suma $+1000$ m al `distanceM` en cada pulsación |
| `overrideHeartRate` | `number \| null` | `null` | Tecla `[h]` | Conmuta entre `190` bpm fijo y valor sinusoidal regular |
| `overrideCadence` | `number \| null` | `null` | Tecla `[c]` | Conmuta entre `210` spm fijo y valor sinusoidal regular |

---

## 2. Máquina de Estados: Transición de Alertas

```
                         [ Telemetría Entrante (1 Hz) ]
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
 [ Evaluación de Distancia ]                             [ Evaluación Fisiológica ]
            │                                                     │
   ¿Primer paquete recibido?                               ¿HR ≥ Umbral Esfuerzo?
   ├── SÍ (Espectador tardío)                              ├── NO  ──> exertionCount = 0
   │     Silenciar hitos ≤ Distancia Actual                └── SÍ
   └── NO                                                        │
         │                                                 ¿Cadencia ≥ Umbral Sprint?
         ▼                                                 ├── NO  ──> Flujo Esfuerzo
   ¿Cruza 25%, 50% o 75%?                                  │             Cooldown 30s?
   ├── SÍ (No emitido antes)                               │             Count < 3?
   │     Disparar Snackbar + Browser                       │             Emitir "Esfuerzo"
   └── NO                                                  └── SÍ  ──> Flujo Sprint
                                                                         ¿Restante < 2 km?
                                                                         ├── SÍ ──> Emitir 1 sola vez (Final)
                                                                         └── NO ──> Cooldown 30s & Count < 3
```

### Reglas de Negocio
1. **Supresión en Conexión Tardía**:
   - Si $\text{distanciaActual} \ge 0.25 \times \text{meta}$, `milestonesReported.p25 = true` (sin emitir notificación).
   - Si $\text{distanciaActual} \ge 0.50 \times \text{meta}$, `milestonesReported.p50 = true` (sin emitir notificación).
   - Si $\text{distanciaActual} \ge 0.75 \times \text{meta}$, `milestonesReported.p75 = true` (sin emitir notificación).
2. **Ciclo de Esfuerzo**:
   - La alerta solo se emite si $(\text{now} - \text{lastExertionTimestamp}) \ge 30000$ ms y $\text{exertionConsecutiveCount} < 3$.
   - Al emitirse, $\text{exertionConsecutiveCount} \leftarrow \text{exertionConsecutiveCount} + 1$ y $\text{lastExertionTimestamp} \leftarrow \text{now}$.
   - Si $\text{heartRateBpm} < \text{exertionHrThreshold}$, $\text{exertionConsecutiveCount} \leftarrow 0$.
3. **Ciclo de Sprint**:
   - Si $\text{distanciaRestanteM} < 2000$ m: Se permite una única notificación; `finalSprintEmitted` se fija en `true` y bloquea emisiones futuras de sprint.
   - Si $\text{distanciaRestanteM} \ge 2000$ m: Se rige por cooldown de 30 s y $\text{sprintConsecutiveCount} < 3$.
   - La notificación contiene el objeto `cta` que activa el desplazamiento hacia el Muro de Ánimos y la preselección del preset de sprint.
