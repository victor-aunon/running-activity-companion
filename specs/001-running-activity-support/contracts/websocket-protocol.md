# WebSocket Protocol Specification: Android Gateway ↔ Next.js Web App

**Version**: `2.0.0` | **Date**: 2026-10-21 (Updated)

## 1. Connection Lifecycle

### Handshake & Session Binding
- **Endpoint**: `wss://<host>/api/ws/session`
- **Query Parameter**: `?token=<shareable_token>&role=<gateway|spectator>`

1. **Android Gateway Connection**:
   - The Android Companion establishes the WebSocket specifying `role=gateway`.
   - Sends initial registration frame:
   ```json
   {
     "type": "GATEWAY_REGISTER",
     "sessionId": "b47c9431-7e53-488b-a81d-8472506e9021",
     "spectatorPin": "4829",
     "athleteName": "Víctor",
     "startTime": 1792576800000
   }
   ```
   - Server returns: `{"type": "GATEWAY_REGISTER_ACK", "status": "READY"}`

2. **Web Spectator Connection**:
   - The Next.js web client connects specifying `role=spectator&token=<shareable_token>`.
   - Server streams the current `WorkoutSession` state snapshot immediately upon connection.

---

## 2. Event Messages (Uplink: Gateway → Web)

### `TELEMETRY_SNAPSHOT` (1 Hz Stream from Native Run Activity)
Dispatched once per second by Android.
```json
{
  "type": "TELEMETRY_SNAPSHOT",
  "sessionId": "b47c9431-7e53-488b-a81d-8472506e9021",
  "seq": 142,
  "timestamp": 1792576942000,
  "coordinates": {
    "lat": 40.416775,
    "lng": -3.703790,
    "elevationM": 654.2,
    "gpsQuality": 4
  },
  "metrics": {
    "heartRateBpm": 158,
    "speedMps": 3.70,
    "paceSecPerKm": 270.2,
    "cadenceSpm": 176,
    "totalDistanceM": 525.4,
    "elapsedSeconds": 142
  },
  "deviceHealth": {
    "watchBatteryPct": 88,
    "phoneBatteryPct": 74,
    "bleRssi": -65
  }
}
```
*Note*: When Garmin satellite signal is lost, `coordinates` contains last known position with `gpsQuality: 0`.

### `SESSION_STATE_CHANGED`
Dispatched when runner presses Start, Pause, Resume, or Stop in the native Garmin Running activity:
```json
{
  "type": "SESSION_STATE_CHANGED",
  "sessionId": "b47c9431-7e53-488b-a81d-8472506e9021",
  "status": "PAUSED",
  "timestamp": 1792577000000
}
```
*Note*: When `status` transitions to `COMPLETED`, all queued in-flight cheers automatically transition to `EXPIRADO` with `runnerReplyText: "Actividad finalizada"`.

### `CHEER_STATUS_UPDATE`
Dispatched when notification delivery state progresses or runner responds:
```json
{
  "type": "CHEER_STATUS_UPDATE",
  "notificationId": "e305e91e-089c-4bf0-baec-2c1bbbe178a9",
  "sessionId": "b47c9431-7e53-488b-a81d-8472506e9021",
  "status": "AGRADECIDO",
  "runnerReplyText": "Víctor te lo agradece",
  "timestamp": 1792577020000
}
```

---

## 3. Command Messages (Downlink: Web Spectator → Gateway)

### `DISPATCH_CHEER`
Dispatched by authorized spectator on the Web App:
```json
{
  "type": "DISPATCH_CHEER",
  "notificationId": "e305e91e-089c-4bf0-baec-2c1bbbe178a9",
  "sessionId": "b47c9431-7e53-488b-a81d-8472506e9021",
  "spectatorPin": "4829",
  "senderName": "Laura",
  "presetId": "MUCHO_ANIMO",
  "body": "¡Mucho ánimo!",
  "ttlSeconds": 60
}
```

- Server responds to Web sender immediately:
  - If PIN invalid: `{"type": "ERROR", "code": "UNAUTHORIZED_PIN", "message": "PIN de espectador inválido"}`
  - If rate limited (5 consecutive failures): `{"type": "ERROR", "code": "PIN_RATE_LIMITED", "message": "Demasiados intentos fallidos. Inténtalo de nuevo en 60 segundos."}`
  - If valid: Confirms status `ENVIADO` to sender, forwards frame to Android Gateway, and broadcasts `ENVIADO` to session viewers.

---

## 4. Heartbeats, Dead Connection Cleanup & Reconnection
- Client sends a `PING` frame every 15 seconds: `{"type": "PING"}`.
- Server responds with: `{"type": "PONG", "timestamp": 1792577035000}`.
- If no pong is received within 5 seconds, client executes exponential backoff reconnection.
- Server terminates and cleans up zombie client connections if 3 consecutive pings (45 seconds) elapse without activity.
