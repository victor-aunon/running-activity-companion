# Feature Specification: Reproductor de Spotify en Tiempo Real para Espectadores

**Feature Branch**: `002-spotify-live-player`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "Como espectador en la webapp quiero poder visualizar un pequeño reproductor integrado de Spotify en la webapp, justo encima del muro de ánimo, con la pista que está reproduciendo el corredor en su teléfono Android. Si no está reproduciendo nada, indica que no se está reproduciendo nada en el teléfono del corredor. Añade la opción de poder escuchar la misma música en tiempo real"

## Clarifications

### Session 2026-10-25
- Q: ¿Cómo debe resolverse la experiencia de escuchar la misma música en tiempo real para el espectador en la webapp? (FR-006) → A: Widget integrado oficial de Spotify en la webapp con control de reproducción sincronizada y botón complementario "Abrir en Spotify" (Opción A).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visualización en Tiempo Real de la Música del Corredor (Priority: P1)

Como espectador en el dashboard web en vivo, quiero visualizar un reproductor compacto de Spotify ubicado justo encima del muro de ánimo que muestre en tiempo real la pista que el corredor está escuchando en su teléfono Android (título, artista, carátula de álbum y barra de progreso sincronizada), para sentirme conectado con el ritmo y la motivación del atleta durante la carrera.

**Why this priority**: Es el núcleo de la funcionalidad requerida por el usuario. Permite visibilizar de forma inmediata la atmósfera musical del corredor directamente en la vista principal de espectadores sin tener que abandonar la pantalla.

**Independent Test**: Se puede verificar iniciando la reproducción de una pista en Spotify dentro del teléfono Android del corredor y comprobando que en la webapp del espectador aparece el mosaico del reproductor encima del muro de ánimo con los metadatos correspondientes (título, artista, carátula) y la barra de avance en tiempo real.

**Acceptance Scenarios**:

1. **Given** el corredor tiene una sesión activa y reproduce una canción en Spotify en su teléfono Android, **When** el espectador accede o visualiza el dashboard web de la sesión, **Then** se muestra un mosaico integrado justo encima del muro de ánimo con la carátula, el título de la canción, el artista y el progreso de reproducción sincronizado.
2. **Given** la canción en reproducción avanza en el teléfono del corredor, **When** transcurre el tiempo, **Then** la barra de progreso en el reproductor del espectador avanza de forma fluida y continua reflejando la posición temporal de la pista.
3. **Given** el corredor cambia de canción en su teléfono, **When** la nueva pista comienza a reproducirse, **Then** el reproductor en la webapp actualiza la portada, título y artista con una transición visual suave en menos de 3 segundos.

---

### User Story 2 - Notificación de Estado Inactivo / Sin Música (Priority: P2)

Como espectador en el dashboard web, cuando el corredor no esté escuchando música en su teléfono Android (reproducción pausada, detenida o aplicación cerrada), quiero que el componente indique claramente el mensaje: "No se está reproduciendo nada en el teléfono del corredor", para tener certidumbre sobre el estado sonoro del atleta sin confusiones ni estados vacíos ambiguos.

**Why this priority**: Resuelve la retroalimentación de estado cuando no hay contenido en reproducción, evitando que el espectador crea que existe un fallo técnico de carga o desconexión.

**Independent Test**: Se puede verificar pausando o cerrando la música en el teléfono Android del corredor y confirmando que el reproductor en la webapp conmuta a una tarjeta informativa con el texto literal "No se está reproduciendo nada en el teléfono del corredor".

**Acceptance Scenarios**:

1. **Given** el corredor pausa o detiene la reproducción en Spotify en su teléfono, **When** el evento de pausa es recibido por la webapp, **Then** el reproductor muestra el estado inactivo con el mensaje: "No se está reproduciendo nada en el teléfono del corredor" y una iconografía contextual atenuada.
2. **Given** el teléfono del corredor no ha iniciado ninguna aplicación musical al arrancar la actividad, **When** el espectador carga el dashboard, **Then** el contenedor encima del muro de ánimo muestra el mensaje de inactividad de forma predeterminada sin mostrar controles de reproducción deshabilitados rotos.
3. **Given** el reproductor está en estado inactivo y el corredor reanuda la música en su teléfono, **When** el nuevo estado llega a la webapp, **Then** el componente transiciona automáticamente al modo activo mostrando la pista en reproducción.

---

### User Story 3 - Opción para Escuchar la Misma Música en Tiempo Real (Priority: P3)

Como espectador en el dashboard web, quiero disponer de un widget oficial integrado de Spotify en el mosaico para escuchar la misma música en tiempo real en mi navegador sincronizada con el punto de reproducción del corredor, así como de un botón directo "Abrir en Spotify", para compartir la misma experiencia acústica e inmersiva durante el seguimiento de la actividad.

**Why this priority**: Añade la dimensión interactiva auditiva para el espectador, enriqueciendo la experiencia pasiva de visualización hacia una experiencia compartida y sin fricción de autenticación obligatoria.

**Independent Test**: Se puede verificar pulsando el control de reproducción del widget integrado en la webapp, comprobando que se inicia la reproducción de audio correspondiente a la pista del corredor en el navegador sincronizada en el segundo actual, y verificando que el botón "Abrir en Spotify" abre la canción en la aplicación nativa o web del espectador.

**Acceptance Scenarios**:

1. **Given** el reproductor muestra una pista activa del corredor, **When** el espectador interactúa con el widget integrado de Spotify para escuchar en tiempo real, **Then** se inicia la reproducción de audio en el navegador alineada con la posición temporal del atleta.
2. **Given** el espectador está escuchando la música sincronizada en la webapp y el corredor salta a una pista diferente, **When** la nueva pista se actualiza en el sistema, **Then** el widget oficial actualiza la pista en curso y mantiene la disponibilidad de reproducción inmediata para el espectador.
3. **Given** el espectador desea escuchar la canción en su propia aplicación nativa de Spotify, **When** pulsa el botón "Abrir en Spotify", **Then** se abre la pista directamente en la aplicación/web de Spotify del espectador mediante su enlace web canónico o URI.
4. **Given** el espectador pausa el audio en su reproductor web local, **When** interactúa con el botón de pausa/silencio local, **Then** solo se silencia o detiene el audio en su propio navegador sin enviar ninguna orden ni alterar la música del teléfono del corredor.

---

### Edge Cases

- **Cambio rápido de pista o avance manual por el corredor**: Si el corredor adelanta, retrocede o cambia canciones en rápida sucesión, la webapp descarta paquetes desordenados basándose en marcas de tiempo monótonas y estabiliza la interfaz en la pista vigente.
- **Pérdida temporal de cobertura móvil en el teléfono Android**: Si el teléfono entra en zona sin cobertura celular, la webapp mantiene la pista actual mostrando un indicador de sincronización congelada durante 30 segundos; si el periodo sin señal persiste, muestra el estado neutro sin bloquear la visualización de telemetría previa.
- **Restricciones de reproducción de audio en navegador (Autoplay Policy)**: Los navegadores modernos bloquean la reproducción automática de audio no iniciada por interacción del usuario; la opción de escuchar en tiempo real requiere un primer clic explícito del espectador en el widget para habilitar el contexto de audio.
- **Diferencias de catálogo o licencias de streaming para espectadores no autenticados**: En caso de que el espectador no disponga de una sesión activa de Spotify en su navegador, el widget embebido oficial de Spotify reproduce la vista previa de 30 segundos autorizada o permite iniciar sesión en Spotify dentro del widget sin romper el dashboard.
- **Contenido sonoro no musical o podcasts**: Si el corredor reproduce un podcast o lista de reproducción con pistas sin carátula disponible, el reproductor muestra una carátula genérica de respaldo con el estilo visual Aurora del sistema.
- **Finalización de la actividad de carrera**: Cuando la sesión de carrera finaliza (`COMPLETED`), el reproductor detiene cualquier reproducción local del espectador y muestra un estado de resumen indicando que la transmisión de música ha finalizado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema en el teléfono Android del corredor DEBE detectar los cambios de metadatos multimedia de la aplicación Spotify (título, artista, álbum, carátula o identificador de recurso, duración total y posición de reproducción) y su estado de reproducción (`PLAYING`, `PAUSED`, `STOPPED`, `NONE`).
- **FR-002**: El sistema DEBE empaquetar los datos de reproducción multimedia en un mensaje de protocolo validado y transmitirlo al servidor de retransmisión para su distribución en tiempo real a los espectadores conectados.
- **FR-003**: La aplicación web DEBE posicionar el mosaico del reproductor integrado de Spotify en la columna lateral de la cuadrícula Bento, ubicado verticalmente justo encima del componente del muro de ánimo (`CheerWallTile`).
- **FR-004**: Cuando el corredor esté reproduciendo una pista, el reproductor DEBE mostrar de forma clara y legible el título de la canción, el artista, la imagen del álbum y una barra de progreso temporal que avance al ritmo de la canción.
- **FR-005**: Cuando no se esté reproduciendo contenido en el teléfono del corredor, el reproductor DEBE mostrar obligatoriamente el mensaje informativo: "No se está reproduciendo nada en el teléfono del corredor", con diseño integrado y estético acorde a la paleta Aurora.
- **FR-006**: El reproductor DEBE integrar el widget oficial de Spotify con controles interactivos para reproducir la misma música en tiempo real en el navegador del espectador sincronizada con la posición temporal del corredor.
- **FR-007**: El reproductor DEBE incluir un botón o enlace de acceso directo ("Abrir en Spotify") que abra la pista en curso en la aplicación nativa o cliente web de Spotify del espectador.
- **FR-008**: La interacción del espectador con el reproductor (reproducir localmente, pausar localmente o modificar el volumen) DEBE ser estrictamente unidireccional y de escucha local; NUNCA debe enviar comandos de control que afecten la reproducción en el teléfono del corredor.

### Key Entities *(include if feature involves data)*

- **RunnerTrackInfo**: Representa los metadatos de la pista en el teléfono del corredor. Atributos: `trackId` (cadena única / URI de Spotify), `title` (cadena con nombre de canción), `artist` (cadena con nombre del artista o artistas), `album` (cadena con nombre del álbum), `artworkUrl` (URL o referencia de la carátula), `durationMs` (entero en milisegundos), `spotifyUrl` (URL canónica de Spotify para apertura directa).
- **RunnerPlaybackStatus**: Representa el estado dinámico de reproducción del corredor. Atributos: `state` (enumerado: `PLAYING`, `PAUSED`, `STOPPED`, `NONE`), `positionMs` (entero con milisegundos transcurridos en la pista), `capturedAt` (marca de tiempo en milisegundos para cálculo de deriva y sincronización de progreso).
- **SpectatorAudioSession**: Estado de la sesión de escucha local del espectador en la webapp. Atributos: `isListening` (booleano que indica si el espectador activó el audio), `isMuted` (booleano de silencio local), `syncOffsetMs` (desfase de sincronización local para compensar latencia de red).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La actualización visual de un cambio de canción o estado de pausa desde el teléfono Android hasta el dashboard web del espectador se produce con una latencia inferior a 2.5 segundos en condiciones normales de red celular.
- **SC-002**: El 100% de los espectadores pueden visualizar el estado musical actual (o el mensaje explícito "No se está reproduciendo nada en el teléfono del corredor") en la pantalla principal sin necesidad de desplazarse verticalmente fuera del viewport estándar de escritorio ni cambiar de pestaña.
- **SC-003**: Un espectador puede comenzar a escuchar la pista en curso en menos de 2 clics o interacciones desde el reproductor integrado.
- **SC-004**: La captura de metadatos multimedia en segundo plano en el dispositivo Android del corredor no incrementa el consumo de batería en más de un 1.5% adicional por hora de actividad de carrera.
- **SC-005**: La interfaz del reproductor mantiene una calificación de accesibilidad visual y contraste conforme a los estándares WCAG AA en modo claro de la estética Aurora.

## Assumptions

- **A-001**: El teléfono Android del corredor cuenta con permisos para escuchar notificaciones o sesiones multimedia del sistema operativo (`MediaSessionManager` / `NotificationListenerService`) para extraer los metadatos de Spotify sin requerir interacción manual del corredor durante la carrera.
- **A-002**: La reproducción en tiempo real para el espectador en la webapp se apoya en el widget oficial integrado de Spotify (Spotify Embed), complementado con deep-linking canónico a la app de Spotify, respetando los términos de servicio de derechos de autor y propiedad intelectual de la música.
- **A-003**: La transmisión de datos multimedia hacia la webapp se canaliza a través de la conexión en tiempo real existente (WebSocket) como parte del flujo de estado de la sesión, reutilizando la infraestructura sin abrir puertos ni servicios paralelos innecesarios.
- **A-004**: El corredor utiliza la aplicación oficial de Spotify en Android. Si utiliza otra aplicación o no tiene Spotify activo, el sistema trata el estado como no reproduciendo nada en Spotify.
- **A-005**: El diseño del componente adopta la misma estética visual Bento Box Aurora en modo claro (bordes redondeados, sombras sutiles, efectos de brillo translúcido y tipografía coherente) existente en `HeaderTile`, `MetricTile` y `CheerWallTile`.
