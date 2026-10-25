# Research: Reproductor de Spotify en Tiempo Real para Espectadores

**Feature**: `002-spotify-live-player`  
**Date**: 2026-10-25  
**Spec Reference**: [spec.md](./spec.md)

---

## Executive Summary

Esta investigación aborda la arquitectura distribuida para capturar el estado de reproducción de Spotify en el teléfono Android 16 del corredor, transmitirlo en tiempo real mediante el protocolo de retransmisión existente hacia el dashboard web, e integrarlo como un mosaico Bento Box con la estética Aurora en modo claro, ofreciendo escucha en directo mediante el widget oficial de Spotify Embed.

---

## Research Topics & Decisions

### 1. Captura de Metadatos de Spotify en Android 16 (API 36)

- **Contexto**: El corredor corre con su teléfono Android reproduciendo música en Spotify. Es necesario detectar la pista, artista, carátula, duración y estado de reproducción sin interacción manual ni drenaje de batería.
- **Decision**: Utilizar `MediaSessionManager` de Android en combinación con un servicio de escucha de notificaciones / sesiones multimedia (`NotificationListenerService` / `MediaController.Callback`), complementado con el `BroadcastReceiver` para acciones de Spotify (`com.spotify.music.metadatachanged` y `com.spotify.music.playbackstatechanged`).
- **Rationale**:
  - `MediaSessionManager` proporciona acceso reactivo a las sesiones activas del sistema operativo.
  - La arquitectura es 100% orientada a eventos: solo consume ciclos de CPU cuando se produce un cambio de pista (`onMetadataChanged`) o de estado (`onPlaybackStateChanged`).
  - No requiere credenciales de desarrollador de Spotify ni tokens de usuario en el teléfono del corredor.
  - Cumple estrictamente con el **Principio V de la Constitución** (presupuesto de batería y límites de ejecución en segundo plano de Android 16).
- **Alternatives Considered**:
  - *Spotify App Remote SDK*: Requiere que la app solicite autenticación OAuth al corredor, mantenga una conexión IPC persistente y que la app de Spotify esté configurada con huellas SHA-1 específicas. Introduce fricción y complejidad innecesaria.
  - *Sondeo periódico de procesos / APIs*: Rechazado por violación de políticas de batería de Android y consumo innecesario de energía.

---

### 2. Contrato de Protocolo y Streaming en Tiempo Real

- **Contexto**: Los datos de reproducción deben viajar desde el companion de Android hasta el relay WebSocket y distribuirse a los espectadores conectados.
- **Decision**: Incorporar un nuevo tipo de mensaje formal en `@running-support/shared-contracts`:
  - `NowPlayingUpdatePacket` (`type: 'NOW_PLAYING_UPDATE'`), que encapsula `RunnerTrackInfo` y `RunnerPlaybackStatus`.
  - El teléfono Android emite este mensaje exclusivamente ante eventos de cambio de estado (reproducción, pausa, cambio de pista) y con un pulso de sincronización de respaldo cada 30 segundos.
  - El servidor de relay almacena en memoria el último `nowPlaying` de la sesión y lo reenvía inmediatamente a cualquier nuevo espectador que se conecte (garantía de estado inicial).
- **Rationale**:
  - Respeta el **Principio II de la Constitución** (Contract-First y desacoplamiento de protocolos).
  - No contamina el paquete de telemetría de 1 Hz (`TelemetrySnapshotPacket`) con datos de música invariantes, ahorrando ancho de banda en redes celulares 4G/5G.
  - El reloj Garmin Fenix 7s no participa en este flujo, protegiendo su presupuesto de memoria heap y batería BLE.
- **Alternatives Considered**:
  - *Embeber `nowPlaying` en cada snapshot de telemetría*: Ineficiente (duplicaría metadatos 3600 veces por hora).
  - *Canal HTTP REST independiente*: Añadiría latencia y requeriría polling por parte de los clientes web.

---

### 3. Integración del Reproductor Web de Spotify (Next.js / React)

- **Contexto**: El espectador desea visualizar la pista en curso y tener la opción de escuchar la misma música en tiempo real desde la webapp.
- **Decision**: Implementar el componente `SpotifyPlayerTile` utilizando el **Spotify Embed Iframe oficial** (`https://open.spotify.com/embed/track/{trackId}?utm_source=generator&theme=0`) integrado con una tarjeta estilizada Bento Box Aurora, acompañado de un botón de acción rápida "Abrir en Spotify" con deep-linking (`spotify:track:...` y URL web canónica).
- **Rationale**:
  - **Sin fricción de autenticación**: Cualquier espectador puede reproducir la música de inmediato sin necesidad de iniciar sesión obligatoria en la webapp.
  - **Cumplimiento legal y DRM**: Spotify Embed gestiona de forma nativa los derechos de autor, reproduciendo la vista previa oficial para usuarios sin sesión o la pista completa para usuarios con sesión de Spotify en su navegador.
  - **Sincronización visual**: La webapp controla la barra de progreso sincronizada calculando el tiempo transcurrido en el cliente.
- **Alternatives Considered**:
  - *Spotify Web Playback SDK*: Exige que el espectador tenga una cuenta Spotify Premium e inicie sesión OAuth en la webapp. Excluiría a usuarios casuales y aumentaría la complejidad del frontend.
  - *Retransmisión de audio vía WebRTC desde el móvil*: Ilegal por términos de servicio de streaming (retransmisión no autorizada de copyright), además de sobrecargar la batería y ancho de banda del corredor.

---

### 4. Sincronización de Progreso en Cliente sin Latencia

- **Contexto**: La posición de la canción avanza continuamente segundo a segundo.
- **Decision**: Interpolar el progreso en el cliente web mediante un temporizador local desacoplado:
  $$\text{progresoActualMs} = \min(\text{durationMs}, \text{positionMs} + (\text{ahora} - \text{capturedAt}))$$
- **Rationale**:
  - Proporciona una animación de barra de progreso fluida a 60fps sin sobrecargar la red con mensajes continuos de posición.
  - Si el corredor pausa la canción, el estado conmuta a inactivo y el temporizador se detiene.
- **Alternatives Considered**:
  - *Envío continuo de milisegundos desde Android cada segundo*: Alto desperdicio de batería y datos móviles.

---

### 5. Estado Inactivo y Experiencia de Usuario (UX)

- **Contexto**: Cuando el corredor no tiene música en reproducción o pausa la pista, la interfaz debe indicar claramente: "No se está reproduciendo nada en el teléfono del corredor".
- **Decision**: Diseñar una variante de estado inactivo dentro de `SpotifyPlayerTile` que mantiene la coherencia visual del Bento Grid con fondo blanco translúcido (`bg-white/80`), borde sutil (`border-slate-200/60`), un icono de Spotify en escala de grises suave y el mensaje textual centrado de forma elegante.
- **Rationale**:
  - Evita saltos de diseño (layout shifts) en la columna lateral de la pantalla.
  - Cumple estrictamente con el requerimiento del usuario y la accesibilidad WCAG AA.

---

## Matriz de Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
| :--- | :---: | :---: | :--- |
| **Android 16 restringe lectura de notificaciones** | Media | Alto | Solicitar permiso `BIND_NOTIFICATION_LISTENER_SERVICE` con guía de activación clara en el companion. |
| **Corredor reproduce música de otra app (ej. YouTube Music)** | Media | Bajo | Filtrar exclusivamente el paquete `com.spotify.music`; si no hay sesión activa de Spotify, emitir estado inactivo `NONE`. |
| **Políticas de Autoplay en navegadores bloquean audio no solicitado** | Alta | Medio | El widget de Spotify Embed requiere clic del usuario para reproducir sonido, respetando las políticas de todos los navegadores. |
| **Pista de Spotify no disponible en el país del espectador** | Baja | Bajo | El widget de Spotify maneja restricciones geográficas automáticamente y el botón "Abrir en Spotify" permite buscarla. |
