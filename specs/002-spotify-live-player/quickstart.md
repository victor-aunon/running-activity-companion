# Quickstart: Validación de Reproductor de Spotify en Tiempo Real

**Feature**: `002-spotify-live-player`  
**Date**: 2026-10-25  
**Spec Reference**: [spec.md](./spec.md) | [data-model.md](./data-model.md)

---

## 1. Prerrequisitos y Preparación

Asegúrate de contar con las dependencias del monorepo instaladas y construidas:

```bash
# Desde la raíz del repositorio
pnpm install
pnpm build --filter @running-support/shared-contracts
```

---

## 2. Escenarios de Validación

### Escenario 1: Validación del Contrato de Mensajes de Protocolo (Contract Test)

Verifica que el nuevo mensaje `NowPlayingUpdatePacket` cumple con la validación de esquema JSON:

```bash
# Ejecutar test de contrato de Now Playing
pnpm --filter @running-support/web-dashboard test tests/contract/now-playing-contract.test.ts
```

**Resultado esperado**:
- Un paquete con `type: "NOW_PLAYING_UPDATE"` y metadatos completos de canción pasa la validación.
- Un paquete con `state: "NONE"` y `track: null` pasa la validación.
- Un paquete con campos requeridos ausentes (ej. sin `sessionId` o sin `playback.state`) es rechazado con error de validación.

---

### Escenario 2: Renderizado Visual con Canción en Reproducción

Inicia el entorno de desarrollo y carga la sesión simulada con una pista de Spotify activa:

```bash
# En una terminal: iniciar servidor de relay y dashboard
pnpm --filter @running-support/web-dashboard dev
```

1. Abre el navegador en `http://localhost:3000/session/live-marathon-2026?mock=stitch&nowPlaying=active`.
2. Inspecciona la columna derecha del Bento Grid, directamente encima de `CheerWallTile` ("Muro de Ánimo").
3. **Verificación visual**:
   - Se muestra el mosaico `SpotifyPlayerTile` con la carátula del álbum, el título de la canción y el artista.
   - La barra de progreso avanza suavemente segundo a segundo.
   - Se visualiza el widget oficial de Spotify Embed con el botón para escuchar en tiempo real.
   - Existe un botón accesible "Abrir en Spotify" que enlaza a `https://open.spotify.com/track/...`.

---

### Escenario 3: Renderizado de Estado Inactivo ("Sin Música")

Carga la sesión simulando que el corredor tiene Spotify pausado o cerrado:

1. Abre el navegador en `http://localhost:3000/session/live-marathon-2026?mock=stitch&nowPlaying=idle`.
2. **Verificación visual**:
   - El mosaico de Spotify encima del muro de ánimo renderiza la tarjeta de estado inactivo.
   - Se muestra claramente el texto exacto: **"No se está reproduciendo nada en el teléfono del corredor"**.
   - No aparecen carátulas rotas, barras de progreso erróneas ni controles deshabilitados confusos.

---

### Escenario 4: Transición Dinámica por WebSocket en Tiempo Real

Verifica que el cambio de música enviado por el corredor se refleja en el dashboard de espectador en vivo:

1. Inicia el simulador de corredor enviando un evento de inicio de canción:
   ```bash
   pnpm --filter @running-support/web-dashboard exec tsx scripts/simulate-now-playing.ts --track "The Pretender - Foo Fighters" --state PLAYING
   ```
2. Observa la webapp: en menos de 2.5 segundos, el reproductor transiciona suavemente de estado inactivo a la nueva pista.
3. Envía el comando de pausa desde el simulador:
   ```bash
   pnpm --filter @running-support/web-dashboard exec tsx scripts/simulate-now-playing.ts --state NONE
   ```
4. Observa la webapp: el reproductor conmutará inmediatamente al mensaje de estado inactivo ("No se está reproduciendo nada en el teléfono del corredor").

---

### Escenario 5: Ejecución de la Suite Completa de Tests

Ejecuta las pruebas unitarias y de integración asociadas:

```bash
# Tests unitarios del hook y componente
pnpm --filter @running-support/web-dashboard test tests/unit/useNowPlaying.test.ts
pnpm --filter @running-support/web-dashboard test tests/unit/SpotifyPlayerTile.test.ts
```

**Criterio de éxito**: Todos los tests pasan en verde (Green phase) sin regresiones en los tests existentes de telemetría y muro de ánimo.
