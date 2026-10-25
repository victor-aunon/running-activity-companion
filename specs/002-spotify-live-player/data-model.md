# Data Model: Reproductor de Spotify en Tiempo Real

**Feature**: `002-spotify-live-player`  
**Date**: 2026-10-25  
**Spec Reference**: [spec.md](./spec.md)

---

## 1. Domain Entities

### 1.1 `RunnerTrackInfo`

Representa los metadatos inmutables de la pista musical activa en el reproductor de Spotify del corredor.

| Campo | Tipo | Requerido | Descripción | Reglas de Validación |
| :--- | :--- | :---: | :--- | :--- |
| `trackId` | `string` | Sí | Identificador alfanumérico o Spotify URI | Mínimo 1 carácter (ej. `"4cOdK2wGLETKBW3PvgPWqT"` o `"spotify:track:..."`) |
| `title` | `string` | Sí | Título de la pista | Máximo 200 caracteres, no vacío |
| `artist` | `string` | Sí | Nombre del artista principal o artistas colaboradores | Máximo 200 caracteres, no vacío |
| `album` | `string` | No | Nombre del álbum | Máximo 200 caracteres |
| `artworkUrl` | `string` | No | URL pública HTTPS de la imagen de la carátula | Formato URI válido (o fallback genérico si ausente) |
| `durationMs` | `number` | Sí | Duración total de la canción en milisegundos | Entero positivo $\ge 0$ |
| `spotifyUrl` | `string` | Sí | Enlace canónico HTTPS para abrir en Spotify | Formato URL web estándar de Spotify |

---

### 1.2 `RunnerPlaybackStatus`

Representa el estado dinámico y temporal de la reproducción en el dispositivo Android del corredor.

| Campo | Tipo | Requerido | Descripción | Reglas de Validación |
| :--- | :--- | :---: | :--- | :--- |
| `state` | `PlaybackState` | Sí | Estado del reproductor | Uno de: `'PLAYING'`, `'PAUSED'`, `'STOPPED'`, `'NONE'` |
| `positionMs` | `number` | Sí | Posición transcurrida en la pista al momento de captura | $0 \le \text{positionMs} \le \text{durationMs}$ |
| `capturedAt` | `number` | Sí | Timestamp Unix epoch en milisegundos de la captura | Marca de tiempo válida en UTC |
| `isLiveSync` | `boolean` | No | Bandera que indica si la emisión proviene de una sesión en directo | Booleano (default: `true`) |

**Enumerado `PlaybackState`:**
- `'PLAYING'`: Música sonando activamente en el teléfono del corredor.
- `'PAUSED'`: Canción pausada temporalmente por el corredor.
- `'STOPPED'`: Reproducción detenida o cola finalizada.
- `'NONE'`: No hay ninguna aplicación de Spotify activa o no se está reproduciendo nada.

---

### 1.3 `NowPlayingUpdatePacket` (Protocol Message)

Paquete estructurado transmitido por WebSocket entre el teléfono Android, el servidor de retransmisión y los clientes web.

| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :---: | :--- |
| `type` | `'NOW_PLAYING_UPDATE'` | Sí | Discriminador de tipo de mensaje de protocolo |
| `sessionId` | `string` | Sí | Identificador de la sesión de carrera activa |
| `timestamp` | `number` | Sí | Marca de tiempo Unix de generación del paquete |
| `playback` | `RunnerPlaybackStatus` | Sí | Estado actual de reproducción |
| `track` | `RunnerTrackInfo \| null` | Sí | Metadatos de la pista (`null` si `state === 'NONE'`) |

---

### 1.4 `SpectatorAudioSession` (Client Web State)

Estado de la sesión de escucha local del espectador en su navegador.

| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :---: | :--- |
| `isListening` | `boolean` | Sí | Si el espectador ha iniciado la reproducción de audio en la webapp |
| `isMuted` | `boolean` | Sí | Si el audio del espectador está silenciado |
| `localProgressMs` | `number` | Sí | Posición temporal actual calculada en el navegador |
| `syncDriftMs` | `number` | No | Estimación de la diferencia temporal con respecto al corredor |

---

## 2. State Machine: Ciclo de Vida de Reproducción

```
       [ App Inactiva / Sin Música ] (state: NONE, track: null)
                       │
                       │ Spotify inicia reproducción
                       ▼
       [ Reproducción Activa ] (state: PLAYING, track: RunnerTrackInfo)
         │           ▲                       │
         │ Corredor  │ Corredor              │ Cambio de pista
         │ pausa     │ reanuda               ▼
         ▼           │             [ Nueva Pista Activa ]
       [ Pausada ] ──┘             (state: PLAYING, track: NuevoTrack)
         │
         │ Sin actividad > 3 min / App cerrada
         ▼
       [ App Inactiva / Sin Música ] (state: NONE, track: null)
```

### Reglas de Transición
1. Si `state === 'NONE'` o `state === 'STOPPED'`, el campo `track` DEBE ser `null`. La webapp renderiza obligatoriamente el mensaje: *"No se está reproduciendo nada en el teléfono del corredor"*.
2. Si `state === 'PAUSED'`, la webapp mantiene visibles los metadatos de la última pista durante 60 segundos antes de conmutar al estado inactivo completo si no se produce reanudación.
3. Si `state === 'PLAYING'`, el cliente web calcula la posición interpolada mediante $positionMs + (\text{Date.now()} - capturedAt)$.
4. Si la sesión deportiva finaliza (`SessionStatus === 'COMPLETED'`), el estado de audio se marca automáticamente como `'STOPPED'` en el cliente web.
