# Feature Specification: Real-Time Running Activity Support System

**Feature Branch**: `001-running-activity-support`

**Created**: 2026-10-21

**Status**: Draft (Updated with Aurora & Bento Light Style, Native Garmin Activity Service, and Spectator Redefinitions)

**Input**: User description: "Quiero construir una sistema conformado por varias aplicaciones: - Una aplicación para mi reloj Garmin Fenix 7s que recoge datos en tiempo real de mi actividad de carrera - Una aplicación en Android 16 que recibe los datos en tiempo real desde el reloj - Una aplicación web que recibe datos desde la aplicación en Android en tiempo real. Desde la web app se pueden enviar notificaciones a la app de Android y ésta las envía de vuelta al reloj"

## Clarifications

### Session 2026-10-21 (Updated)
- Q: ¿Cómo deben autenticarse y vincularse los espectadores en la aplicación web para visualizar la sesión en vivo y enviar notificaciones al corredor? → A: Enlace web compartible con token de visualización pública y un PIN temporal de 4 dígitos para autorizar el envío de ánimos desde el panel de espectadores.
- Q: ¿Qué formato y longitud de contenido deben tener los mensajes enviados desde la web hacia el reloj Garmin Fenix 7s? → A: Botones de ánimos predefinidos ("¡Mucho ánimo!", "¡Tú puedes!", "¡Sigue así!") más un campo de texto libre corto limitado a 50 caracteres.
- Q: ¿Cómo interactúa el corredor con las notificaciones y qué respuestas recibe el espectador en la web? → A: Notificación nativa tipo banner temporal superior en la actividad nativa de running; al enviar, la web muestra "Enviado". Si el corredor pulsa el botón de respuesta en el reloj, la web actualiza el estado a "[Nombre] te lo agradece" (configurable por variable de entorno, ej. "Víctor te lo agradece").
- Q: ¿Debe el dashboard web incluir visualización cartográfica interactiva en vivo con el trazado GPS de la ruta? → A: Sí, mapa interactivo en tiempo real con trazado de ruta GPS y posición actual, integrado en una cuadrícula Bento Box con estética Aurora en modo claro exclusivo (sin modo oscuro).
- Q: ¿Cómo se definen las zonas de esfuerzo cardíaco/ritmo en la web? → A: Configuradas directamente como variables de entorno (ej. umbrales de frecuencia cardíaca por zona).
- Q: ¿Cómo se ejecuta la aplicación en el reloj Garmin Fenix 7s? → A: Como un servicio integrado (Connect IQ Data Field / Background Service) dentro de la actividad de running nativa del reloj (nunca una pantalla o app de carrera separada), con interruptor de activación/desactivación previo a la actividad.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Real-Time Activity Tracking & Live Metric Streaming in Native Run (Priority: P1)

As a runner using the native Garmin Running activity on my Fenix 7s with the support service enabled, and carrying my mobile companion, I want my live running metrics (heart rate, pace, cadence, distance, and elapsed time) to be collected in the background and streamed in real time to an Aurora-styled Bento Box web dashboard, so that family, friends, or supporters can follow my progress live in a clear, luminous interface.

**Why this priority**: Core value proposition of the system. Allows the athlete to train with Garmin's native running screens and sensors while streaming live telemetry.

**Independent Test**: Can be tested by starting a native Run activity on the watch with the data field service active, verifying that telemetry points are captured, received by the mobile companion app, and immediately rendered on the live Bento Box web dashboard.

**Acceptance Scenarios**:

1. **Given** the runner activates the support service and starts a native Garmin Running activity connected via Bluetooth to the Android companion, **When** the runner generates biometric and GPS data, **Then** the service transmits telemetry snapshots at 1 Hz via BLE to the phone, which relays them to the web dashboard.
2. **Given** an active web session viewing the runner's dashboard, **When** new telemetry arrives, **Then** the Bento Box metric tiles (ritmo, frecuencia cardíaca con color según zonas de esfuerzo configuradas por entorno, cadencia, distancia) and the live GPS route map update with sub-second latency.
3. **Given** the runner pauses or finishes the native running activity on the watch, **Then** the session state is updated in real time on the web dashboard.

---

### User Story 2 - Spectator Cheer Messages & Runner Gratitude Response (Priority: P2)

As a spectator viewing the live web dashboard, I want to send quick cheer messages ("¡Mucho ánimo!", "¡Tú puedes!", "¡Sigue así!") or a custom message up to 50 characters to the runner, see immediate confirmation ("Enviado"), and receive a personalized gratitude message ("[Nombre] te lo agradece") if the runner presses the reply button on the watch during their run.

**Why this priority**: Delivers direct emotional support to the athlete during endurance running, establishing a real-time connection with supporters.

**Independent Test**: Can be tested by clicking a cheer preset on the web dashboard, verifying that the web displays "Enviado", the watch displays the banner during the native run, and upon pressing the watch reply button, the web reflects "[Nombre] te lo agradece".

**Acceptance Scenarios**:

1. **Given** an authorized spectator on the web dashboard (via 4-digit session PIN), **When** they click "¡Mucho ánimo!" or enter a custom text under 50 characters, **Then** the notification is dispatched, and the web interface immediately displays the status "Enviado".
2. **Given** an incoming message arriving at the watch during the native running activity, **When** the message triggers, **Then** a top banner overlay appears on the Garmin screen for a few seconds with a haptic pulse, without disrupting the runner's native metric fields.
3. **Given** the banner displayed on the watch, **When** the runner presses the action button to reply, **Then** the watch transmits the acknowledgment back via Android to the web dashboard, which displays "${ATHLETE_NAME} te lo agradece".

---

### User Story 3 - Pre-Activity Activation & Offline Local Storage (Priority: P3)

As a runner preparing for a workout, I want to be able to enable or disable the tracking service prior to my native run so it doesn't trigger on everyday runs, and I want all telemetry data to be safely buffered locally in my phone if cellular coverage drops during the run.

**Why this priority**: Prevents unwanted background transmissions on non-tracked workouts and ensures zero data loss during trail or rural running.

**Independent Test**: Can be tested by disabling the data field toggle in settings and verifying that native running records without transmitting; then enabling it and running with phone in airplane mode to verify local Android Room buffering and auto-sync.

**Acceptance Scenarios**:

1. **Given** the tracking service is toggled OFF in the data field / companion settings, **When** the runner starts a native running activity, **Then** the watch records the workout normally without initiating BLE telemetry streams or phone wakelocks.
2. **Given** the tracking service is toggled ON, **When** the runner runs through an area without mobile coverage, **Then** the Android companion stores 100% of telemetry points in local storage (Room DB) and automatically drains the queue once coverage returns.

---

### Edge Cases

- **Service Disabled Prior to Workout**: If the athlete chooses not to track the session, the data field remains completely dormant with total radio silence (zero BLE advertisements, zero scanning, and zero packet transmissions), preserving 100% of standard battery life.
- **Multiple Spectators Sending Cheers Simultaneously**: The web platform and Android companion queue spectator messages sequentially so only one banner overlay displays at a time on the watch screen.
- **Watch Banner Auto-Dismissal**: If the runner is running at maximum effort and does not press any button, the banner automatically dismisses after 7 seconds, keeping the web status as "Enviado" (without the gratitude reply).
- **Network Flapping During Cheer Dispatch**: If a spectator clicks send while the athlete's phone is momentarily offline, the message is queued with a 60-second TTL; if expired before reaching the watch, the web indicates "Expirado".
- **BLE Disconnect Mid-Run**: If Bluetooth disconnects between the Garmin Fenix 7s and Android companion during an active run, the watch Data Field buffers up to 10 recent telemetry points in a circular memory buffer (protecting Connect IQ heap limits) and retries reconnection every 5 seconds. Native Garmin recording continues uninterrupted.
- **Degraded GPS & Satellite Loss**: If satellite lock is lost (`Position.QUALITY_NOT_AVAILABLE` or quality < 1), the watch service continues 1 Hz transmission using the last known valid coordinates with `gpsQuality: 0`. The web map displays a degraded signal indicator at the last position and pauses polyline path extension until satellite lock is restored.
- **In-Flight Cheer on Activity Completion**: If an activity ends (`SESSION_STATE_CHANGED` with `COMPLETED`) while cheers are queued or in transit, unreached messages immediately transition to `EXPIRADO` with `runnerReplyText: "Actividad finalizada"`.
- **Rapid Workout Restart**: If the runner accidentally stops and restarts an activity on the watch within 3 minutes, the Android companion associates the new activity with the existing `shareableToken` and spectator PIN for the day, preventing spectator link invalidation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The watch application MUST be implemented as a Connect IQ Data Field / Background Service integrated directly into the Garmin native Running activity, allowing standard native GPS and data screens.
- **FR-002**: The watch service MUST provide a pre-activity configuration toggle (Enabled/Disabled) so that the runner can choose whether telemetry and notifications are active for the upcoming run. When Disabled, the Data Field MUST operate under complete radio silence with zero BLE emissions.
- **FR-003**: When enabled, the watch service MUST sample running metrics at 1 Hz and transmit them via Bluetooth Low Energy to the Android companion gateway.
- **FR-004**: The Android companion MUST store all session metadata, telemetry snapshots, and notification logs in local Room/SQLite storage, operating offline-first. The telemetry buffer MUST cap active unsynced records at 50,000 points (~13.8 hours of 1 Hz streaming, max 50 MB) using FIFO eviction during prolonged outages, and MUST implement a retention policy retaining the last 5 completed workout sessions while automatically purging older records.
- **FR-005**: The Android companion UI MUST be strictly minimal/headless, displaying ONLY service state, connection health, and access PIN—explicitly displaying NO running metrics.
- **FR-006**: The web application MUST be built in Next.js (latest, App Router) and feature an **Aurora and Bento Box visual design in pure Light Mode** (with no dark mode toggle or styles) with moderate border-radii (8–10px, avoiding large rounded corners) and zero user/runner avatar images; the header MUST display the runner's current locality/town (derived from GPS coordinates or configured locality) instead of static workout titles.
- **FR-007**: The web application MUST configure effort zones (e.g. Zone 1 to Zone 5 heart rate thresholds) dynamically using environment variables (`NEXT_PUBLIC_ZONE_1_MAX` to `NEXT_PUBLIC_ZONE_5_MAX`). If any variable is missing, non-numeric, or non-monotonic (`zone_{n} >= zone_{n+1}`), the system MUST gracefully fall back to default thresholds [130, 145, 160, 175, 195].
- **FR-008**: The web application MUST configure the athlete's display name using an environment variable (`NEXT_PUBLIC_ATHLETE_NAME`, default "Víctor").
- **FR-009**: The web application MUST allow spectators with the session 4-digit PIN to dispatch cheer messages using prominent, large, distinctively color-coded action buttons ("¡Mucho ánimo!" in amber/orange, "¡Tú puedes!" in emerald/teal, "!Sigue así!" in indigo/violet) and custom text up to 50 characters. PIN verification MUST be rate-limited, locking submissions for 60 seconds after 5 consecutive incorrect attempts.
- **FR-010**: Upon message submission, the web application MUST immediately confirm the action with the status "Enviado".
- **FR-011**: The watch service MUST render incoming messages as a temporary top-banner overlay during the native running activity with haptic vibration, allowing the runner to dismiss or press a button to reply.
- **FR-012**: When the runner selects the reply button on the watch, the system MUST propagate the response to the web dashboard, displaying "${NEXT_PUBLIC_ATHLETE_NAME} te lo agradece" (e.g., "Víctor te lo agradece"). Athlete names exceeding 20 characters MUST be truncated with an ellipsis to preserve badge layout.
- **FR-013**: The web application MUST implement an interactive Leaflet/OSM GPS map inside a Bento Box tile showing the live path and current position without requiring API keys, gracefully handling degraded GPS states.
- **FR-014**: The web application MUST strictly separate logic and UI using container components, custom hooks, and presentational components styled with Tailwind CSS and `class-variance-authority`.
- **FR-015**: Web session state MUST be ephemeral in the browser session for v1, displaying a final summary upon workout completion without persistent cloud database archiving.
- **FR-016**: The web application MUST be completely responsive across mobile (375px+), tablet (768px+), and desktop (1024px, 1440px+) viewports; the Bento Box grid MUST reflow fluidly (1 column on mobile, 2 columns on tablet, 4 columns on desktop) with touch-optimized targets (minimum 44x44px) without horizontal scrolling.

### Key Entities

- **Workout Session**: Athlete identifier, session UUID, start/end timestamps, status (Active, Paused, Completed), shareable token, 4-digit spectator PIN, summary aggregates.
- **Telemetry Snapshot**: 1 Hz packet (latitude, longitude, elevation, speed, pace, heart rate, cadence, total distance, elapsed seconds, device battery levels).
- **Spectator Cheer Message**: Message UUID, session UUID, cheer text (preset: "¡Mucho ánimo!", "¡Tú puedes!", "¡Sigue así!", or custom text <= 50 chars), timestamp, status ("Enviado", "En reloj", "Agradecido", "Expirado"), runner reply flag.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of 1 Hz telemetry packets from the native running activity are rendered on the Bento Box web dashboard in under 1.5 seconds under standard cellular conditions.
- **SC-002**: 100% of spectator cheer messages transition to "Enviado" within 500ms of clicking, and deliver to the watch within 2.0 seconds under active BLE connection.
- **SC-003**: When the runner replies on the watch, the web dashboard updates to "${ATHLETE_NAME} te lo agradece" within 1.5 seconds.
- **SC-004**: The web dashboard renders in 100% Light Mode Bento Box aesthetic with Aurora luminous gradients and zero dark mode styles.
- **SC-005**: Heart rate effort zone cards accurately reflect the thresholds specified in the project's environment variables.
- **SC-006**: The Android companion app displays zero running metrics, consuming less than 6% battery per hour of continuous background execution.
- **SC-007**: The Garmin Connect IQ data field operates seamlessly inside the native Garmin Running activity within the Fenix 7s memory limit without crashing native workout recording.
- **SC-008**: 100% of the web dashboard interface and interaction flows pass responsive audits on mobile (390px-430px), tablet (768px-1024px), and desktop (1280px-1440px+) viewports with zero horizontal overflow and fully touch-accessible controls.

## Assumptions

- The Garmin Fenix 7s user adds the Connect IQ Data Field to one of their native Running activity data screens and toggles it ON before the run.
- The athlete's name defaults to "Víctor" via environment variable `NEXT_PUBLIC_ATHLETE_NAME` if not overridden.
- Web spectators access the dashboard on modern browsers in light mode.
