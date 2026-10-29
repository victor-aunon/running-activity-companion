# Contract: Protocolo de Notificaciones y Telemetría Extendida para Espectadores

**Feature**: `003-spectator-notifications`  
**Date**: 2026-10-29  
**Schema Reference**: [`spectator-notifications.schema.json`](./spectator-notifications.schema.json)

---

## 1. Extensión del Mensaje `GATEWAY_REGISTER`

Cuando la pasarela Android Companion inicia la conexión con el servidor de retransmisión, envía el mensaje `GATEWAY_REGISTER`. Se incorpora el campo opcional `totalRaceDistanceM` para compartir la distancia total planificada:

```json
{
  "type": "GATEWAY_REGISTER",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "spectatorPin": "4829",
  "athleteName": "Víctor",
  "startTime": 1729500000000,
  "targetPaceSecPerKm": 270,
  "totalRaceDistanceM": 10000
}
```

### Campos:
- `totalRaceDistanceM` (`number`, opcional): Distancia total de carrera fijada en la pasarela en metros (ej. `10000` para 10 km, `21097` para media maratón, `42195` para maratón).

---

## 2. Extensión de Métricas en `TelemetrySnapshotPacket`

El servidor Relay o la pasarela adjuntan `totalRaceDistanceM` dentro del objeto `metrics` para que cualquier espectador que se conecte disponga inmediatamente de la referencia de distancia total:

```json
{
  "type": "TELEMETRY_SNAPSHOT",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "seq": 142,
  "timestamp": 1729500142000,
  "coordinates": {
    "lat": 40.4168,
    "lng": -3.7038,
    "elevationM": 655.2,
    "gpsQuality": 4
  },
  "metrics": {
    "heartRateBpm": 182,
    "speedMps": 3.75,
    "paceSecPerKm": 266.7,
    "cadenceSpm": 184,
    "stepCount": 426,
    "totalDistanceM": 2510.4,
    "elapsedSeconds": 668,
    "targetPaceSecPerKm": 270,
    "totalRaceDistanceM": 10000
  }
}
```

---

## 3. Contrato de Notificación al Espectador (`SpectatorNotificationEvent`)

Las alertas generadas en el cliente web se modelan con la interfaz `SpectatorNotificationEvent`:

### Ejemplo 1: Hito de Distancia (25%)
```json
{
  "id": "notif-1729500142000-m25",
  "type": "MILESTONE_25",
  "title": "¡25% Completado!",
  "message": "Víctor ha completado el primer cuarto del recorrido (2.5 km).",
  "timestamp": 1729500142000,
  "durationMs": 6000
}
```

### Ejemplo 2: Alto Esfuerzo Cardíaco
```json
{
  "id": "notif-1729500210000-exertion",
  "type": "EXERTION",
  "title": "Alto Esfuerzo",
  "message": "Víctor está haciendo un esfuerzo (188 bpm).",
  "timestamp": 1729500210000,
  "durationMs": 6000
}
```

### Ejemplo 3: Alerta de Sprint con CTA
```json
{
  "id": "notif-1729500350000-sprint",
  "type": "SPRINT",
  "title": "¡Sprint en curso!",
  "message": "¡Víctor está sprintando a 192 bpm y 212 spm!",
  "timestamp": 1729500350000,
  "durationMs": 8000,
  "cta": {
    "label": "¡Envíale un ánimo!",
    "action": "SCROLL_CHEER_WALL",
    "presetId": "MUCHO_ANIMO",
    "customText": "¡A por el sprint final!"
  }
}
```

---

## 4. Contrato de Muro de Ánimos sin Campo PIN

El componente `CheerWallTile` despacha el comando `DISPATCH_CHEER` utilizando el `activePin` proporcionado por el contexto de sesión:

```json
{
  "type": "DISPATCH_CHEER",
  "notificationId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "spectatorPin": "4829",
  "senderName": "Laura",
  "presetId": "MUCHO_ANIMO",
  "body": "¡Mucho ánimo!",
  "ttlSeconds": 30
}
```

- En la interfaz de usuario, el formulario NO renderiza `<input type="password" placeholder="PIN"...>`.
- `senderName` se ingresa por el espectador (o se recupera de `localStorage`).
- `spectatorPin` se añade de forma automática en el cliente al invocar `onSendCheer`.
