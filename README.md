# Real-Time Running Activity Support System

Sistema distribuido de soporte y telemetría en tiempo real para corredores de fondo durante entrenamientos y competiciones, con pasarela BLE, sincronización por WebSockets y dashboard para espectadores.

---

## 🏛 Arquitectura del Sistema

```
[ Garmin Fenix 7S ] 
       │  (Bluetooth Low Energy - BLE 1 Hz)
       ▼
[ Android Companion Gateway ]
       │  (WebSockets - TLS / JSON Contracts)
       ▼
[ WebSocket Relay Server ]
       │  (Broadcasting 1 Hz)
       ▼
[ Web Spectator Dashboard (Next.js Bento Box) ]
```

1. **Garmin Fenix 7S (`apps/garmin-fenix7s`):** Connect IQ Data Field para la actividad nativa "Carrera". Emite telemetría (FC, ritmo, distancia, cadencia) por BLE y muestra avisos de ánimo sobreimpresos sin interrumpir las métricas de carrera.
2. **Android Companion Gateway (`apps/android-companion`):** Servicio Android (API 28-36) en primer plano. Actúa de puente transparente entre el reloj (BLE) y la nube (WebSockets). Incluye base de datos local SQLite (Room) para buffer sin conexión y genera el PIN de 4 dígitos de la sesión.
3. **Web Spectator Dashboard (`apps/web-dashboard`):** Dashboard web reactivo en Next.js (App Router, Tailwind CSS, Leaflet) con diseño *Aurora Bento Box Light Mode*. Permite a familiares y amigos seguir al corredor en vivo y enviarle ánimos.
4. **Contratos Compartidos (`packages/shared-contracts`):** Definiciones de esquemas JSON y tipos TypeScript para la telemetría y los comandos de animación.

---

## 🌐 1. Web Dashboard & Botón "Acceso Rápido"

### ¿Qué significa el botón "Acceso Rápido"?
En la pantalla de bienvenida (`http://localhost:3000`), el formulario principal solicita un **Token de Sesión** y un **PIN de 4 dígitos**. 
* El botón **"Acceso Rápido" (Demo / Carrera en Vivo)** es un atajo directo diseñado para pruebas, demostraciones o familiares con enlace directo: permite entrar a la visualización en vivo de la carrera (`/session/live-session` o `/session/live-demo`) con un solo clic, sin necesidad de teclear credenciales manualmente.

### Puesta en Marcha:
```bash
# 1. Instalar dependencias del monorepo
pnpm install

# 2. Iniciar el servidor web Next.js (puerto 3000)
pnpm --filter web-dashboard dev

# 3. En otra terminal, iniciar el servidor WebSocket Relay (puerto 3001)
pnpm --filter web-dashboard relay
```
Abre tu navegador en `http://localhost:3000`.

### Simulación de Corredor Virtual (Sin Reloj ni Móvil):
Una vez que el servidor Relay esté activo en el puerto 3001, puedes iniciar el simulador de corredor:
```bash
# Ejecutar el simulador de corredor (se conecta automáticamente al relay en puerto 3001)
pnpm --filter web-dashboard simulate:runner -- --token=live-session --pin=4829
```
* Emite telemetría GPS, pulso y ritmo a 1 Hz recorriendo un trayecto real de Madrid.
* El dashboard web (`/session/live-session`) reflejará de inmediato las métricas en directo.
* Al pulsar `r` o `Enter` en la terminal del simulador, se simula que el corredor pulsa el botón del reloj para agradecer un mensaje recibido.

---

## ⌚ 2. Aplicación de Reloj: Garmin Fenix 7S (`apps/garmin-fenix7s`)

La aplicación es un **Data Field de Connect IQ** (`Toybox.WatchUi.DataField`) escrito en Monkey C.

### Requisitos:
* **Garmin Connect IQ SDK** (descargar desde [developer.garmin.com/connect-iq](https://developer.garmin.com/connect-iq/sdk/)).
* Extensión **Monkey C** para VS Code o línea de comandos con Java 17+.
* Clave de desarrollador (`developer_key.der`).

### Ejecución en el Simulador Oficial de Garmin:
1. Inicia el simulador de Garmin:
   ```bash
   connectiq
   ```
2. Compila el proyecto para el Fenix 7S:
   ```bash
   cd apps/garmin-fenix7s
   monkeyc -d fenix7s -f monkey.jungle -o bin/RunningSupport.prg -y /ruta/a/developer_key.der
   ```
3. Ejecuta el archivo compilado en el simulador.
4. En el menú del simulador, ve a **Simulation $\rightarrow$ Fit Data $\rightarrow$ Simulate Data** para inyectar pulso y velocidad simulados.

### Instalación en Reloj Físico (Garmin Fenix 7S):
1. Conecta el reloj Garmin Fenix 7S a tu ordenador mediante el cable USB.
2. El reloj aparecerá como unidad de almacenamiento masivo USB (en macOS puede requerir *Android File Transfer* u *OpenMTP*).
3. Compila el archivo ejecutable (`.prg`):
   ```bash
   monkeyc -d fenix7s -f monkey.jungle -o bin/RunningSupport.prg -y /ruta/a/developer_key.der
   ```
4. Copia el archivo `RunningSupport.prg` en la carpeta **`GARMIN/APPS/`** de la memoria interna del reloj.
5. Desconecta el reloj del cable USB de forma segura.
6. **Activación en el reloj:**
   * En el reloj, pulsa **START** y selecciona la actividad **Carrera** (Run).
   * Mantén pulsado el botón central izquierdo (**UP / MENU**) $\rightarrow$ selecciona **Configuración de Carrera**.
   * Entra en **Pantallas de Datos**.
   * Edita una pantalla existente o añade una nueva $\rightarrow$ selecciona el campo que deseas $\rightarrow$ entra en **Campos de Connect IQ** $\rightarrow$ elige **Running Activity Support**.

---

## 📱 3. Aplicación Android Companion Gateway (`apps/android-companion`)

La app Android actúa como pasarela headless (sin métricas en pantalla para no duplicar datos) y servicio en segundo plano.

### Requisitos:
* **Android Studio** (Ladybug o posterior) con Android SDK 34/36.
* Dispositivo físico o emulador con soporte de **Bluetooth Low Energy (BLE)**.

### Compilación e Instalación:
1. Compila el APK de depuración desde la terminal:
   ```bash
   cd apps/android-companion
   ./gradlew assembleDebug
   ```
2. Instala el APK en el dispositivo conectado por USB (con Depuración USB activa):
   ```bash
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```
3. Alternativamente, abre la carpeta `apps/android-companion` directamente en Android Studio y pulsa **Run 'app'** (`Shift + F10`).

### Configuración en el Dispositivo:
1. Abre la aplicación **Running Companion Gateway**.
2. Concede los permisos requeridos cuando se soliciten:
   * **Dispositivos cercanos** (`BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`).
   * **Notificaciones** (`POST_NOTIFICATIONS`).
3. Activa el interruptor **SERVICIO ACTIVO**:
   * Se iniciará el Foreground Service de Android.
   * La app buscará por BLE el reloj Garmin Fenix 7S y abrirá la conexión WebSocket con el servidor relay.
   * En pantalla verás el **PIN de 4 dígitos** asignado a la sesión para compartir con los espectadores.
4. **Modo de Prueba / Sin Reloj:** Si no tienes el reloj a mano, puedes activar el interruptor de *Modo Simulación* dentro de la app para que genere telemetría local de prueba y verifique la pasarela.

---

## 🧪 4. Pruebas y Control de Calidad

```bash
# Ejecutar suite de pruebas unitarias y de contratos
pnpm --filter web-dashboard test

# Ejecutar el Quality Gate determinista (Airbnb linter, oxlint, tipos TypeScript y complejidad)
bash .specify/scripts/bash/check-quality-gate.sh

# Ejecutar auditoría visual de Playwright (Bento Box fidelidad Stitch e interacciones)
bash .specify/scripts/bash/verify-stitch-design.sh
```

---

## ⚙️ 5. Variables de Entorno y Configuración por Plataforma

Cada una de las tres aplicaciones pertenece a un ecosistema tecnológico distinto con su propio modelo estándar de configuración:

### 1. Web Dashboard (`apps/web-dashboard` - Next.js)
Usa archivos **`.env.local`** (o `.env`). En Next.js, cualquier variable consumida en el navegador cliente **debe** llevar el prefijo `NEXT_PUBLIC_`:

| Variable | Por Defecto | Descripción |
|---|---|---|
| `NEXT_PUBLIC_ATHLETE_NAME` | `"Víctor"` | Nombre del corredor mostrado en la cabecera y modal. |
| `NEXT_PUBLIC_DEFAULT_LOCALITY` | `"Alicante"` | Localidad de carrera mostrada en el header. |
| `NEXT_PUBLIC_WS_URL` | `"ws://localhost:3001/api/ws/session"` | Endpoint del servidor WebSocket Relay. |
| `PORT` | `3000` | Puerto HTTP del servidor web Next.js. |
| `NEXT_PUBLIC_ZONE_1_MAX` a `_5_MAX` | `130, 145, 160, 175, 195` | Umbrales superiores de frecuencia cardíaca (BPM). |
| `NEXT_PUBLIC_CADENCE_LOW_MAX` | `155` | Límite superior de Cadencia Baja / Calentamiento (SPM). |
| `NEXT_PUBLIC_CADENCE_MODERATE_MAX` | `169` | Límite superior de Cadencia Moderada (SPM). |
| `NEXT_PUBLIC_CADENCE_OPTIMAL_MAX` | `185` | Límite superior de Rango Óptimo Eficiente (SPM). Por encima es Cadencia Alta. |

### 2. Android Companion Gateway (`apps/android-companion` - Kotlin / Gradle)
En Android **no** se usan archivos `.env` (sería un antipatrón en Java/Kotlin). La configuración se divide en:
* **`local.properties`** (en la raíz de `apps/android-companion/`): Define la ruta local del SDK de Android (`sdk.dir=/Users/.../Android/sdk`). Se genera automáticamente por Android Studio y **no** se commitea a Git.
* **`buildConfigField` en `build.gradle.kts`**: Para constantes inyectadas en tiempo de compilación (ej. endpoints base o versión del protocolo).
* **Recursos XML (`res/values/strings.xml`)**: Para nombres de la aplicación, identificadores de canales de notificación y constantes de UI.
* **Ajustes de la App (Shared Preferences)**: La app dispone de campos en pantalla para configurar la URL del servidor WebSocket relay y activar el interruptor de simulación.

### 3. Garmin Fenix 7S (`apps/garmin-fenix7s` - Connect IQ / Monkey C)
El reloj es un dispositivo embebido sin variables de entorno de sistema operativo. Su configuración se realiza mediante:
* **Connect IQ App Settings (`resources/settings/properties.xml` y `settings.xml`)**: Es el estándar oficial de Garmin. Permite que el corredor configure parámetros de la app (como el UUID del servicio BLE de transmisión) directamente desde su smartphone a través de la app oficial **Garmin Connect Mobile** o en el ordenador con **Garmin Express**.
* **`monkey.jungle`**: Archivo de configuración del compilador Connect IQ que define el dispositivo destino (`fenix7s`), flags de compilación y rutas de recursos.
* **`developer_key.der`**: Clave criptográfica RSA privada del desarrollador utilizada por `monkeyc` para firmar el binario compilado `.prg`.
