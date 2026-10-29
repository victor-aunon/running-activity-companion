# Research: Sistema de Notificaciones Web y Experiencia del Espectador

**Feature**: `003-spectator-notifications`  
**Date**: 2026-10-29  
**Spec Reference**: [spec.md](./spec.md)

---

## Executive Summary

Esta investigación establece la arquitectura técnica para enriquecer la experiencia de los espectadores en la webapp mediante un sistema de alertas en tiempo real (snackbars en la aplicación y notificaciones nativas de escritorio del navegador), la eliminación de fricción de autenticación en el Muro de Ánimos (supresión del campo de PIN redundante), la parametrización de la distancia total de carrera y un conjunto de herramientas de simulación interactiva por teclado en el test-runner.

---

## Research Topics & Decisions

### 1. Eliminación del Campo PIN en el Muro de Ánimos (`CheerWallTile`)

- **Contexto**: Actualmente, el componente `CheerWallTile` contiene `SpectatorCredentialsInput`, que exige al espectador introducir su nombre y volver a teclear el PIN de 4 dígitos para cada mensaje de ánimo, a pesar de que el usuario ya se autenticó previamente para acceder a la ruta `/session/[token]?pin=XXXX`.
- **Decision**: Eliminar por completo el campo `<input type="password" placeholder="PIN"...>` del formulario de ánimos. `CheerWallTile` conservará únicamente el campo para el nombre del remitente (`senderName`). El PIN activo (`activePin`) se inyecta internamente desde el estado de la sesión autenticada (`useDashboardSession`) al despachar el comando `DISPATCH_CHEER`.
- **Rationale**:
  - Elimina el 100% de la fricción y redundancia en el envío de mensajes de soporte.
  - El backend de relay ya valida el PIN adjunto en el payload de WebSocket; adjuntarlo automáticamente desde el contexto de la sesión garantiza la seguridad sin degradar la usabilidad.
  - Simplifica el diseño visual del formulario en la tarjeta Bento Box Aurora.
- **Alternatives Considered**:
  - *Autocompletar el campo de PIN pero mantenerlo visible*: Descartado porque confunde al usuario y ocupa espacio innecesario en la tarjeta.
  - *Eliminar el PIN del protocolo WebSocket*: Descartado para mantener la compatibilidad con el esquema de seguridad y rate-limiting existente en el servidor de retransmisión.

---

### 2. Solicitud Anticipada de Permisos en la Pantalla de Acceso (Web Notifications API)

- **Contexto**: El usuario requiere que se solicite el permiso de notificaciones en la pantalla inicial de acceso para no recibir interrupciones o avisos emergentes molestos más adelante durante la carrera.
- **Decision**: Al enviar el formulario de acceso en la landing page (`/`), antes de efectuar la redirección al dashboard (`router.push`), se comprueba si el navegador soporta `window.Notification`. Si el permiso se encuentra en estado `'default'`, se invoca explícitamente `await Notification.requestPermission()`. Una vez resuelto (tanto si el espectador concede `'granted'` como si deniega `'denied'`), se realiza la navegación a `/session/[token]`.
- **Rationale**:
  - Se cumple la clarificación acordada (Opción B: decisión explícita en el momento de conectar).
  - Resuelve el permiso en un evento iniciado por el usuario (*user gesture* requerido por navegadores como Chrome y Safari).
  - En el dashboard en vivo no se mostrarán diálogos invasivos ni popups bloqueantes.
  - Si el permiso es denegado o no soportado, la aplicación degrada grácilmente mostrando el 100% de los avisos a través de snackbars internos en la webapp.
- **Alternatives Considered**:
  - *Solicitar el permiso inmediatamente al cargar la landing*: Bloqueado por políticas modernas de navegadores que penalizan prompts de notificación sin interacción previa del usuario.
  - *Solicitar el permiso en el primer hito del 25%*: Rechazado expresamente por el usuario ("Que no le venga el aviso después").

---

### 3. Detección de Hitos de Distancia (25%, 50%, 75%) y Configuración de Distancia Total

- **Contexto**: La webapp debe saber cuándo el corredor alcanza el 25%, 50% y 75% del recorrido. La distancia total se define en la app Android y tiene un valor de respaldo por entorno en la web.
- **Decision**:
  1. En la app Android Companion, añadir el campo `targetDistanceKm` en la pantalla de consola de pasarela (con valor predeterminado `"10.0"` km), enviándolo en metros (`totalRaceDistanceM`) dentro de `GATEWAY_REGISTER` y en las métricas de telemetría.
  2. En el servidor Relay, almacenar `room.raceDistanceM` y adjuntarlo a los paquetes de telemetría transmitidos a los espectadores.
  3. En la webapp, resolver la distancia total efectiva:
     $$\text{totalDistanceM} = \text{metrics.totalRaceDistanceM} \;\lor\; \text{parseDistanceEnv(NEXT\_PUBLIC\_DEFAULT\_RACE\_DISTANCE\_M)} \;\lor\; 10000$$
  4. Disparar notificaciones emergentes (snackbar y notificación de escritorio) al cruzar monótonamente los umbrales de $0.25 \times \text{totalDistanceM}$, $0.50 \times \text{totalDistanceM}$ y $0.75 \times \text{totalDistanceM}$.
- **Rationale**:
  - Homogéneo con la arquitectura ya probada de `targetPaceSecPerKm`.
  - Respeta el **Principio II de la Constitución** (Contract-First y desacoplamiento de capas).
  - La evaluación monótona evita que pequeñas fluctuaciones de GPS repitan notificaciones ya emitidas.
- **Alternatives Considered**:
  - *Calcular porcentajes en el servidor Relay y emitir un nuevo tipo de mensaje*: Innecesario y añade acoplamiento de lógica de presentación en el relay. La webapp ya recibe la telemetría a 1 Hz y dispone de todo el contexto para emitir las alertas locales.

---

### 4. Notificaciones Reactivas de Esfuerzo Fisiológico y Alerta de Sprint

- **Contexto**: Se deben emitir avisos cuando el corredor esté en esfuerzo continuo (BPM > umbral, cooldown de 30s, máx 3 consecutivas) y cuando esté sprintando (BPM > umbral Y cadencia > umbral, con CTA de ánimo, limitado a 1 vez si resta <2km o reglas estándar si restan $\ge 2\text{km}$).
- **Decision**:
  - Implementar una máquina de estados local en el hook `useSpectatorNotifications`:
    - **Esfuerzo**:
      - Condición: $\text{heartRateBpm} \ge \text{exertionHrThreshold}$ (por defecto 175 bpm o Zona 5).
      - Ventana de comprobación: 30 segundos de cooldown entre avisos.
      - Contador consecutivo: Máximo 3 notificaciones consecutivas. Si en cualquier momento el pulso desciende por debajo del umbral, el contador se resetea inmediatamente a 0.
    - **Sprint**:
      - Condición: $\text{heartRateBpm} \ge \text{sprintHrThreshold}$ (175 bpm) $\land$ $\text{cadenceSpm} \ge \text{sprintCadenceThreshold}$ (180 spm).
      - Si $\text{distanciaRestanteM} < 2000$ m: Se emite exactamente **1 sola vez** durante todo el tramo final de carrera.
      - Si $\text{distanciaRestanteM} \ge 2000$ m: Se aplican las reglas estándar (cooldown de 30s y hasta 3 consecutivas).
      - Llamada a la acción (CTA): Incluye botón "¡Envíale un ánimo!" que ejecuta un *smooth scroll* hasta el contenedor `#cheer-wall` y selecciona el preset de sprint en el formulario.
- **Rationale**:
  - Reglas de negocio deterministas y estrictamente verificables.
  - La ventana de enfriamiento de 30 segundos evita el spamming y el parpadeo de avisos por fluctuaciones cardíacas momentáneas.
  - La llamada a la acción fomenta el soporte emocional inmediato sin interferir con la navegación del usuario.

---

### 5. Supresión de Alertas Pasadas para Espectadores Tardíos (*Late-Joiner Filter*)

- **Contexto**: Si un espectador entra a la sesión cuando el corredor ya va por el kilómetro 6 de una carrera de 10 km, no debe recibir los avisos acumulados del 25% y 50%, pero sí debe enterarse si en ese instante el atleta está en pleno esfuerzo o sprint.
- **Decision**:
  - Al procesar el primer paquete de telemetría tras la conexión del cliente espectador, se calcula la distancia inicial:
    - Si $\text{distanciaInicial} \ge 0.25 \times \text{total}$, se marca el hito del 25% como completado en el estado silencioso.
    - Si $\text{distanciaInicial} \ge 0.50 \times \text{total}$, se marca el hito del 50% como completado en el estado silencioso.
    - Si $\text{distanciaInicial} \ge 0.75 \times \text{total}$, se marca el hito del 75% como completado en el estado silencioso.
  - No se emiten snackbars ni notificaciones de navegador para los hitos marcados en la inicialización.
  - Las condiciones fisiológicas de esfuerzo o sprint se evalúan en tiempo real inmediatamente: si en el instante de conexión el pulso supera el umbral, la alerta correspondiente sí se dispara.
- **Rationale**:
  - Experiencia limpia de onboarding en vivo, evitando una cascada molesta de alertas históricas obsoletas.

---

### 6. Controles Interactivos en el Test-Runner (`simulate-runner.ts`)

- **Contexto**: Necesidad de probar manualmente y de forma instantánea todos los avisos sin tener que esperar a que el corredor virtual recorra distancias reales.
- **Decision**: Configurar `process.stdin` en modo Raw en `simulate-runner.ts` y añadir los siguientes escuchadores de eventos de teclado (conservando los comandos existentes `[r]` y `[f]`):
  - Tecla `[k]`: Suma de inmediato 1.000 metros (+1 km) a la variable de distancia acumulada `distanceM`.
  - Tecla `[h]`: Conmuta la variable `overrideHeartRate = overrideHeartRate ? null : 190`. Si está activa, el paquete de telemetría emitirá 190 bpm; al pulsarla de nuevo se restaura el pulso sinusoidal.
  - Tecla `[c]`: Conmuta la variable `overrideCadence = overrideCadence ? null : 210`. Si está activa, el paquete de telemetría emitirá 210 spm; al pulsarla de nuevo se restaura la cadencia sinusoidal.
  - La combinación simultánea de `[h]` y `[c]` permite probar la condición de sprint instantáneamente.
- **Rationale**:
  - Acelera las pruebas manuales y demostraciones de producto a escala de segundos.
  - Permite verificar los hitos del 25%, 50% y 75% con solo pulsar `[k]` unas pocas veces.
- **Alternatives Considered**:
  - *Endpoints HTTP de prueba para inyectar telemetría*: Mayor complejidad arquitectónica innecesaria cuando el simulador CLI ya corre localmente.

---

## Matriz de Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
| :--- | :---: | :---: | :--- |
| **Navegador bloquea o no soporta Web Notifications API** | Media | Bajo | El sistema verifica `'Notification' in window` y degrada al 100% en snackbars emergentes locales. |
| **Pestaña en segundo plano throttled por el navegador** | Media | Medio | Las notificaciones del sistema de escritorio (si están permitidas) se muestran incluso si la pestaña está inactiva o minimizada. |
| **Disparo múltiple por GPS jitter o reconexión** | Media | Bajo | Los hitos porcentuales se marcan con booleanos irreversibles (`true`) en la sesión, garantizando disparo único. |
| **Colisión de teclas en el simulador** | Baja | Bajo | Las teclas `k`, `h` y `c` son disjuntas de `r` (reply), `f` (finish) y `Ctrl+C` (exit). |
