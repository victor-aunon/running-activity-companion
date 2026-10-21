# Design System & UI Architecture: Aurora & Bento Box (Light Style - Racing Orange)

**Feature**: `001-running-activity-support` | **Date**: 2026-10-21 (Updated)

## 1. Visual Aesthetics: Aurora & Bento Box (Light Mode - Racing Orange Identity)

The web dashboard is conceived as an **Aurora & Bento Box interface in strictly Light Mode**, using an **aggressive athletic competition color palette centered around racing orange (`#F97316` / `#FF5500`)** and completely eliminating generic AI purple/violet tones:
- **Atmosphere & Racing Glow**:
  - Soft, ambient warm radial gradient washes behind the cards using translucent racing orange, amber, and rose (`rgba(249, 115, 22, 0.14)`, `rgba(245, 158, 11, 0.10)`).
  - Clean luminous canvas `#F8FAFC` giving a high-contrast athletic race-day aesthetic.
- **Bento Box Modular Architecture**:
  - Moderate-radius cards (`rounded-lg` / `10px`) with semi-translucent frosted glass effect (`bg-white/80 backdrop-blur-md`), avoiding excessively large curved corners.
  - Zero avatar/profile images: The athlete and spectators are represented purely via typography, clean labels, or discrete initials, keeping the interface uncluttered and privacy-focused.
  - Subtle borders (`border-slate-200/80`) and layered ambient elevation shadows.
  - Grid layout with variable tile spans (metrics, interactive map, spectator cheer wall).

---

## 2. Web Dashboard Screen Layout (`apps/web-dashboard`)

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│  BENTO TILE: Header & Athlete Identity                                           │
│  [🏃 Víctor]  [📍 Madrid (Casa de Campo)]  [⏱️ Tiempo Transcurrido: 00:48:15]    │
├────────────────────────┬────────────────────────┬────────────────────────────────┤
│  BENTO TILE: Ritmo     │  BENTO TILE: Pulso     │  BENTO TILE: Cadencia y Dist.  │
│  4:22 min/km           │  158 bpm               │  178 spm · 10.42 km            │
│  (Variación vs obj.)   │  [Zona 3: Tempo] (Env) │  (Progreso sesión)             │
├────────────────────────┴────────────────────────┼────────────────────────────────┤
│  BENTO TILE: Mapa GPS Interactivo (Leaflet/OSM) │  BENTO TILE: Muro de Ánimo     │
│  • Trazado en tiempo real                       │  [🔥 ¡Mucho ánimo!] (Ámbar)    │
│  • Posición actual con halo Aurora              │  [⚡ ¡Tú puedes!] (Esmeralda)   │
│  • Altitud y perfil de elevación                │  [🚀 !Sigue así!] (Violeta)    │
│                                                 │  [ Mensaje personalizado... ]  │
│                                                 │  ───────────────────────────── │
│                                                 │  Feed de Mensajes:             │
│                                                 │  • Mamá: "¡Tú puedes!"         │
│                                                 │    └─► "Víctor te lo agradece" │
│                                                 │  • Carlos: "¡Mucho ánimo!"     │
│                                                 │    └─► "Enviado"               │
└─────────────────────────────────────────────────┴────────────────────────────────┘
```

### 2.1 Dynamic Effort Zones & Locality Resolution
Cardio metrics and athlete location dynamically read configuration and live reverse-geocoding:
- **Población en Vivo**: Derivada dinámicamente de las coordenadas GPS del corredor (ej. "Madrid (Casa de Campo), España") o localidad configurada.
- **Zonas de Esfuerzo**: Configuración por variables de entorno:
```typescript
// Configured in .env.local
NEXT_PUBLIC_ZONE_1_MAX=130   // Recovery (Sky Blue)
NEXT_PUBLIC_ZONE_2_MAX=145   // Aerobic (Emerald Green)
NEXT_PUBLIC_ZONE_3_MAX=160   // Tempo (Amber)
NEXT_PUBLIC_ZONE_4_MAX=175   // Threshold (Orange)
NEXT_PUBLIC_ZONE_5_MAX=195   // Anaerobic (Crimson)
NEXT_PUBLIC_ATHLETE_NAME=Víctor
```

### 2.2 Spectator Cheer Tile ("Muro de Ánimo")
- **Target Audience**: Espectadores (amigos, familiares, seguidores).
- **Vibrant Multi-Color Action Buttons**:
  - `🔥 ¡Mucho ánimo!`: Botón grande con degradado ámbar/naranja (`from-amber-400 to-orange-500`).
  - `⚡ ¡Tú puedes!`: Botón grande con degradado esmeralda/verde azulado (`from-emerald-400 to-teal-500`).
  - `🚀 !Sigue así!`: Botón grande con degradado índigo/violeta (`from-indigo-500 to-purple-600`).
  - `Input`: Texto libre corto (máx 50 car.) con contador en tiempo real y botón de envío.
- **Immediate Feedback**:
  - Upon clicking send, the message appears in the feed with the blue badge **"Enviado"**.
- **Runner Gratitude Response**:
  - When the runner presses the reply button on the Garmin Fenix 7s during their run, the badge updates dynamically to:
    **`"${process.env.NEXT_PUBLIC_ATHLETE_NAME || 'Víctor'} te lo agradece"`** (Violet badge with heart icon).

---

## 3. Android Companion Gateway Screen (`apps/android-companion`)

### Minimalist Headless Console (Zero Running Metrics)
- **Constraint Enforcement**: Strictly NO pace, heart rate, cadence, or distance displayed.
- **Bento-Inspired Simple Cards**:
  1. **Estado del Servicio**: Toggle switch (Activo / Inactivo) con indicador de servicio en primer plano.
  2. **Reloj Garmin Fenix 7s**: `Conectado por BLE` con nivel de batería (`84%`).
  3. **Pasarela Web (WebSockets)**: `Conectado y transmitiendo` con indicador de paquetes en buffer local (`0 pendientes`).
  4. **Código de Espectadores**: PIN de 4 dígitos en tipografía grande (`3 9 1 4`) y botón "Compartir Enlace en Vivo".

---

## 4. Garmin Fenix 7s Native Activity Integration (`apps/garmin-fenix7s`)

### Arquitectura de Servicio en Actividad Nativa
- **Tipo de Aplicación**: Connect IQ **Data Field** con Background Service.
- **Integración Nativa**:
  - El corredor abre su actividad nativa de Garmin **"Carrera"** (Run).
  - Utiliza sus pantallas de datos habituales configuradas en el reloj (ritmo, pulsaciones, mapas nativos).
  - El Data Field opera en segundo plano recogiendo los sensores a 1 Hz y transmitiendo por BLE.
- **Activación Previa a la Carrera**:
  - Menú de configuración del Data Field en el reloj:
    - **`Servicio En Vivo: [ ACTIVADO | DESACTIVADO ]`**
    - Si está desactivado, el Data Field no emite radio BLE ni mantiene wakelocks en el móvil.
- **Visualización de Notificaciones en Carrera**:
  - Cuando entra un mensaje de ánimo, aparece un **banner superior temporal** (estilo notificación nativa Garmin) ocupando la parte superior sin tapar los campos inferiores de ritmo o pulso.
  - Alerta háptica: 2 vibraciones suaves.
  - Descarte automático tras 7 segundos o descarte con botón `Back/Lap`.
  - Botón de respuesta rápida `Start/Select`: Al pulsar, envía el acuse de gratitud para que la web muestre **"Víctor te lo agradece"**.

---

## 5. Responsive Architecture & Breakpoint System

The web dashboard is architected as a **fully responsive interface** designed mobile-first:
- **Mobile (<640px / `sm`)**:
  - **Header**: Vertical stacked layout with athlete identity on top and elapsed duration pill + share actions below.
  - **Metrics**: 1-column stack of cards (or compact 2x2 grid) with touch-readable typography and large tap targets.
  - **Main Section**: Single-column vertical flow with GPS map at full width (height 360px) and Cheer Wall placed directly below.
  - **Touch Targets**: Minimum 44x44px for cheer preset buttons, text send action, and map zoom/recenter controls.
- **Tablet (640px - 1024px / `md` to `lg`)**:
  - **Metrics**: 2-column grid (2 cards per row) maintaining proportional padding.
  - **Main Section**: Map and Cheer Wall stack with generous padding and vertical rhythm.
- **Desktop (1024px+ / `lg` and `xl`)**:
  - **Metrics**: 4-column row (1 card per metric).
  - **Main Section**: 12-column Bento grid split: 7 or 8 columns for interactive GPS map, 5 or 4 columns for Spectator Cheer Wall.
- **Touch & Gesture Optimization**:
  - Leaflet map supports pinch-to-zoom, two-finger gesture handling, and inertia panning without intercepting page scroll.
  - Cheer action buttons provide tactile press feedback (`active:scale-95`).
