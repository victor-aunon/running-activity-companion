# UI Contract: `SpotifyPlayerTile` Component

**Feature**: `002-spotify-live-player`  
**Date**: 2026-10-25  
**Spec Reference**: [spec.md](../spec.md)

---

## 1. Component Specification

### Ubicación en el Layout
- **Contenedor**: Columna lateral en `MapAndCheerColumns` (`lg:col-span-5 xl:col-span-4`).
- **Posición**: Directamente superior a `CheerWallTile` (muro de ánimo).
- **Estilo Visual**: Bento Box Aurora Light Mode (`bg-white/80`, `backdrop-blur-md`, `border-slate-200/60`, `rounded-2xl`, sombras sutiles `shadow-sm`).

---

## 2. Props Interface (`TypeScript`)

```typescript
export interface SpotifyPlayerTileProps {
  /**
   * Información de la pista actual del corredor.
   * null si no hay ninguna pista activa.
   */
  track: RunnerTrackInfo | null;

  /**
   * Estado de reproducción dinámico reportado por el dispositivo del corredor.
   */
  playbackStatus: RunnerPlaybackStatus;

  /**
   * Nombre del atleta para personalización del texto de estado.
   * Default: "el corredor"
   */
  athleteName?: string;

  /**
   * Clases CSS opcionales para extender el contenedor exterior.
   */
  className?: string;
}
```

---

## 3. UI States & Rendering Rules

### 3.1 Estado Inactivo (`playbackStatus.state === 'NONE' || playbackStatus.state === 'STOPPED'`)
- **Texto Obligatorio**: `"No se está reproduciendo nada en el teléfono del corredor"` (o `"No se está reproduciendo nada en el teléfono de ${athleteName}"` si se provee nombre).
- **Iconografía**: Icono monocromático suave de música o Spotify en `text-slate-400`.
- **Altura**: Altura compacta (`h-24` a `h-28`), manteniendo proporción visual con el Bento Grid sin desbordar el viewport de escritorio.

### 3.2 Estado Activo (`playbackStatus.state === 'PLAYING'`)
- **Carátula**: Imagen cuadrada con esquinas redondeadas (`rounded-lg`, 56x56 px) y sombra suave.
- **Información de Texto**:
  - Título de la pista: tipografía en negrita (`font-semibold text-slate-800 truncate`).
  - Nombre del artista: texto secundario (`text-sm text-slate-500 truncate`).
- **Barra de Progreso**:
  - Línea delgada con gradiente sutil Aurora (`bg-indigo-500` / `bg-emerald-500`).
  - Indicador de tiempo transcurrido / tiempo total (formato `mm:ss / mm:ss`).
- **Widget Embebido de Spotify**:
  - `iframe` oficial de Spotify Embed (`https://open.spotify.com/embed/track/{trackId}?utm_source=generator&theme=0`) en modo compacto (altura 80px).
- **Botón "Abrir en Spotify"**:
  - Botón secundario con enlace `target="_blank"` a `spotifyUrl` para saltar a la aplicación nativa o reproductor web de Spotify del espectador.

### 3.3 Estado Pausado (`playbackStatus.state === 'PAUSED'`)
- Muestra los metadatos de la última pista con una insignia `"Pausado"` y la barra de progreso detenida.
- Si la pausa supera los 60 segundos sin eventos, conmuta al Estado Inactivo.
