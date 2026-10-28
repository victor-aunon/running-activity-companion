# Registro HTML de Sesión y Ánimos para el Corredor (Design Document)

**Fecha:** 2026-10-27  
**Estado:** Aprobado para Planificación  
**Autor:** Senior Architect & Runner User  

---

## 1. Intención y Propósito ("The Why")
Durante una carrera o entrenamiento, los espectadores envían ánimos y mensajes de apoyo a través del cuadro de mandos web, los cuales se retransmiten en tiempo real al reloj Garmin mediante la aplicación Android Companion.
Aunque anteriormente se descartó que los espectadores descargaran datos en bruto en formato JSON desde la web, como corredor resulta muy gratificante y valioso disponer de un recuerdo tangible, ordenado y visual de la actividad y de los mensajes de apoyo recibidos.
Este documento define la arquitectura y diseño para generar y exportar un **informe HTML autónomo (offline)** directamente desde la aplicación Android Companion al almacenamiento local del teléfono (`Downloads/`), con un diseño idéntico al Bento visual de la web pero estructurado como una crónica de carrera (timeline por kilómetro y minuto).

---

## 2. Objetivos, No-Objetivos y Anti-Objetivos

### Objetivos (Goals)
1. **Generación Local & Offline:** El archivo HTML se construye 100% en el dispositivo Android a partir de la base de datos local (Room: `workout_sessions`, `cheer_notifications`, `telemetry_buffer`), sin depender de peticiones externas ni servicios en la nube en el momento de la exportación.
2. **Diseño Visual Bento & Timeline:**
   - **Encabezado Bento:** Nombre de sesión, atleta, fecha y rango horario, coordenadas GPS de salida y meta, y métricas clave en pastillas destacadas (distancia total en km, ritmo medio en min/km, tiempo total transcurrido y total de ánimos recibidos).
   - **Línea de tiempo de carrera:** Cada mensaje ubicado en su punto temporal y espacial (kilómetro de carrera y minuto transcurrido), indicando remitente, texto y si fue respondido/agradecido desde el reloj Garmin.
3. **Autonomía Total del Documento:** El archivo `.html` exportado incluye todo su CSS embebido (inline `<style>`), siendo 100% autónomo, responsive (móvil y escritorio) y preparado para impresión / PDF.
4. **Acceso Persistente en Android:** El botón de exportación se sitúa de forma permanente y clara en la consola principal `GatewayConsoleScreen`, permitiendo exportar el resumen en cualquier momento tras o durante la sesión sin depender de un modal o aviso efímero.
5. **Almacenamiento Estándar:** Guardado a través de `MediaStore.Downloads` en `Downloads/RunningSupport/running-session-[sessionId]-[YYYYMMDD].html` sin requerir permisos invasivos de almacenamiento (Scoped Storage compatible con Android 10+). Opción inmediata de abrir en el navegador o compartir mediante Intent.

### No-Objetivos (Non-Goals)
- No se requiere generar el archivo en el servidor relay ni en el navegador web del espectador.
- No se requiere incrustar un mapa interactivo con dependencias de JavaScript pesado ni tiles de mapas externos (las coordenadas de salida y meta se muestran como texto/datos en la cabecera).
- No se exportan telemetrías segundo a segundo en bruto; el enfoque es el recuerdo y lectura de los ánimos y métricas consolidadas.

### Anti-Objetivos (Anti-Goals)
- **Cero dependencias externas en el HTML:** No usar CDNs externos (Google Fonts, Tailwind CDN, FontAwesome) que hagan que el archivo falle o se vea roto al abrirlo en modo avión o sin internet.
- **Sin popups bloqueantes obligatorios:** No obligar al usuario a descargar el archivo de golpe al cruzar la meta; el control lo tiene el corredor desde la consola de la app.

---

## 3. Decisiones de Diseño y Especificación Visual

### 3.1. Estructura del Archivo HTML
- **Metadatos y Estilo:**
  - Codificación UTF-8, `viewport` responsive.
  - Paleta de colores Aurora / Slate / Bento del proyecto (`#0f172a` fondo oscuro/acentos, `#38bdf8` ritmo/cielo, `#10b981` éxito/enviado, `#a855f7` agradecido, `#f8fafc` fondos claros de tarjetas).
  - Reglas `@media print` para que al imprimir desde el navegador se genere un PDF impecable en A4.
- **Sección 1: Encabezado Bento:**
  - Título / Token de sesión (ej. `#carrera-victor`).
  - Nombre del atleta (por defecto configurado o tomado de la sesión).
  - Fecha formal (ej. `27 de octubre de 2026`).
  - Coordenadas de salida (`lat, lng` del primer registro con GPS válido) y meta/posición actual (`lat, lng` del último registro con GPS válido).
  - Estado: `FINALIZADA` si la sesión terminó, o `EN CURSO` si se exporta en vivo.
  - 4 pastillas de métricas:
    1. Distancia: `XX.XX km`
    2. Ritmo Medio: `M:SS /km`
    3. Tiempo Transcurrido: `HH:MM:SS`
    4. Ánimos: `N mensajes`
- **Sección 2: Línea Temporal (Timeline):**
  - Si hay 0 mensajes: Tarjeta elegante indicando *"Carrera completada sin ánimos registrados"*.
  - Para cada mensaje en orden cronológico:
    - Marcador visual en la línea temporal.
    - Etiqueta de posición: `KM X.X` y `Minuto MM:SS (HH:MMh)`.
    - Tarjeta de contenido: Remitente en negrita, badge de estado (`Enviado` o `Agradecido`), texto del mensaje.
    - Si `status == "AGRADECIDO"` o `runnerReplyText` está presente: Destacado visual con agradecimiento del corredor (`❤️ [Atleta] te lo agradece desde el Garmin`).

---

## 4. Arquitectura en la Aplicación Android

### 4.1. Fuentes de Datos (Room Database)
- **`SessionEntity`:**
  - `sessionId`, `athleteName`, `startedAt`, `endedAt`, `totalDistanceM`, `elapsedSeconds`.
  - Actualización periódica y al finalizar la sesión con la distancia y tiempo finales reales.
- **`TelemetryEntity`:**
  - Se añade columna `distanceM: Double = 0.0` (almacenando el odómetro transmitido por Garmin en `metrics.totalDistanceM` o calculado por velocidad integrada).
- **`CheerDao`:**
  - Consulta de ánimos de la sesión (`getCheersForSession(sessionId)`), ordenados por `receivedAt ASC`.
- **Mapeo de Kilómetro y Minuto:**
  - Para cada ánimo recibido en timestamp `T`, se consulta la telemetría más cercana para obtener la distancia recorrida acumulada en ese instante (`KM = distanceM / 1000.0`) y el tiempo transcurrido desde `startedAt`.

### 4.2. Componente Generador (`SessionHtmlReportGenerator`)
- Clase utilitaria en Kotlin pura encargada de recibir `SessionSummaryData` (datos de sesión, coordenadas, lista de ánimos procesados con km y tiempo) y producir un `String` con el HTML final autónomo.
- Sanitización de texto (`HtmlCompat` / sustitución de caracteres especiales) para prevenir inyecciones HTML en nombres o mensajes.

### 4.3. Exportador a Almacenamiento (`SessionExportManager`)
- Utiliza `ContentResolver` y `MediaStore.Downloads` (Android 10+ / API 29+) con guardado en subdirectorio `Downloads/RunningSupport/`.
- Nombre de archivo: `running-session-[sessionId]-[YYYYMMDD-HHmm].html`.
- Tipo MIME: `text/html`.
- Retorna la `Uri` del archivo guardado.
- Soporta lanzar `Intent(Intent.ACTION_VIEW)` y `Intent.ACTION_SEND` (FileProvider/MediaStore Uri).

### 4.4. UI en `GatewayConsoleScreen`
- Sección persistente bajo la configuración de sesión:
  - Título: **REGISTRO Y MEMORIA DE LA SESIÓN**.
  - Observa la sesión activa o la última sesión guardada en Room correspondiente al `sessionName` actual (o la última sesión general).
  - Muestra resumen (*X mensajes · Y km*) y botones:
    - `📥 Guardar Resumen HTML` (guarda en Descargas con feedback SnackBar / Toast).
    - `Compartir / Abrir` (abre el visor web o menú de compartir de Android).

---

## 5. Lo que se delega al Constructor / Implementador (Left to Builder)
- Formateo de fecha y hora localizado (ej. `Locale.getDefault()`).
- Pruebas unitarias completas:
  - Generación de HTML con datos completos.
  - Generación de HTML con 0 mensajes.
  - Escape de caracteres maliciosos (XSS injection).
  - Cálculo de ritmo medio `min/km` a partir de tiempo y distancia.
