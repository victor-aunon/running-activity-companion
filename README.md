# Real-Time Running Activity Support System

Sistema distribuido de telemetría y soporte en tiempo real para corredores de fondo durante entrenamientos y competiciones, con enlace BLE desde reloj Garmin, pasarela móvil Android 16 (con soporte de Spotify en vivo), servidor relay por WebSockets y dashboard web Bento Box para espectadores.

---

## 🏛 Arquitectura del Sistema

```
[ Garmin Fenix 7S ] 
       │  (Bluetooth Low Energy - BLE 1 Hz)
       ▼
[ Android Companion Gateway ]  ◀─── [ Spotify Android (Música en Vivo) ]
       │  (WebSockets - TLS / JSON Contracts)
       ▼
[ WebSocket Relay Server ]
       │  (Broadcasting 1 Hz)
       ▼
[ Web Spectator Dashboard (Next.js Bento Box) ]
```

1. **Garmin Fenix 7S (`apps/garmin-fenix7s`):** Connect IQ Data Field para la actividad nativa "Carrera". Emite telemetría por BLE a 1 Hz y muestra avisos de ánimo sobreimpresos sin interrumpir las métricas de carrera.
2. **Android Companion Gateway (`apps/android-companion`):** Servicio Android en primer plano. Actúa de puente transparente entre el reloj (BLE) y la nube (WebSockets), detecta la música activa de Spotify y almacena datos sin conexión (Room SQLite).
3. **Web Spectator Dashboard (`apps/web-dashboard`):** Dashboard web reactivo en Next.js (App Router, Tailwind CSS, Leaflet) con diseño *Aurora Bento Box Light Mode*. Incluye reproductor de Spotify en vivo y muro de ánimo interactivo.
4. **Contratos Compartidos (`packages/shared-contracts`):** Esquemas JSON y tipos TypeScript para telemetría, notificaciones y Now Playing.

---

## ❓ Preguntas Frecuentes de Configuración

### ¿Tengo que modificar archivos de código en Android o en Garmin?
**ROTUNDAMENTE NO.**
* **En Garmin (`apps/garmin-fenix7s`)**: El código ya viene 100% configurado con los UUIDs de BLE estándar de Nordic/Running Support. Solo necesitas compilarlo con tu clave `.der`.
* **En Android (`apps/android-companion`)**: **No necesitas tocar ningún archivo.** La URL del servidor WebSocket (sea tu servidor en la nube `wss://...` o tu IP local en Wi-Fi) **se introduce directamente en la pantalla de la app** en el campo *"SERVIDOR RELAY WEBSOCKET"*. La app la recuerda automáticamente mediante preferencias locales.

---

## 🔑 Cómo Generar la Clave `.der` de Garmin (Developer Key)

El compilador de Garmin (`monkeyc`) requiere una clave privada RSA en formato DER para firmar criptográficamente el binario `.prg`. Tienes dos formas muy sencillas de generarla:

### Opción A: Desde Visual Studio Code (Recomendado, 2 clics)
1. Abre VS Code e instala la extensión oficial **Monkey C** (de Garmin).
2. Abre la paleta de comandos: `Cmd + Shift + P` (macOS) o `Ctrl + Shift + P` (Windows/Linux).
3. Escribe y selecciona: **`Monkey C: Generate a Developer Key`**.
4. Selecciona la carpeta donde deseas guardarla (por ejemplo en tu directorio de usuario o en la raíz del proyecto) y nómbrala `developer_key.der`.
5. ¡Listo! Ya tienes tu clave válida para siempre.

### Opción B: Desde la Terminal con OpenSSL (1 solo comando)
Ejecuta en tu terminal:
```bash
# 1. Generar clave privada RSA de 4096 bits
openssl genrsa -out developer_key.pem 4096

# 2. Convertir al formato DER (PKCS#8) que exige Garmin
openssl pkcs8 -topk8 -inform PEM -outform DER -in developer_key.pem -out developer_key.der -nocrypt

# 3. Eliminar el archivo intermedio PEM (opcional)
rm developer_key.pem
```
Guarda tu `developer_key.der` en un lugar seguro (por ejemplo, en `~/.garmin/developer_key.der`).

---

## ⌚ 1. Guía Paso a Paso: App de Reloj Garmin (`apps/garmin-fenix7s`)

La aplicación es un **Data Field de Connect IQ** (`Toybox.WatchUi.DataField`) para la actividad nativa "Carrera".

### Prerrequisitos:
* **Garmin Connect IQ SDK** instalado y en el PATH (`connectiq`, `monkeyc`).
* Tu archivo `developer_key.der`.

### Paso 1: Compilar el binario para tu reloj
Desde la raíz del repositorio:
```bash
cd apps/garmin-fenix7s

# Compilar para Garmin Fenix 7S
monkeyc -d fenix7s -f monkey.jungle -o bin/RunningSupport.prg -y /ruta/a/developer_key.der
```
*(Nota: Si usas Fenix 7 estándar o Fenix 7 Pro, cambia `-d fenix7s` por `-d fenix7` o `-d fenix7spro`)*.

### Paso 2: Instalar en el Reloj Físico
1. Conecta tu reloj Garmin al ordenador con el cable USB.
2. El reloj se montará como unidad de almacenamiento masivo USB (en macOS utiliza herramientas como *OpenMTP* o *Android File Transfer* si el sistema no lo monta directamente).
3. Copia el archivo generado `bin/RunningSupport.prg` a la carpeta:
   ```text
   GARMIN/APPS/RunningSupport.prg
   ```
4. Expulsa la unidad USB y desconecta el cable.

### Paso 3: Activar en el Reloj
1. En el reloj, pulsa **START** y selecciona la actividad **Carrera** (Run).
2. Mantén pulsado el botón central izquierdo (**UP / MENU**) $\rightarrow$ selecciona **Configuración de Carrera**.
3. Entra en **Pantallas de Datos**.
4. Selecciona una pantalla para editar (o añade una nueva) $\rightarrow$ entra en **Campos de Connect IQ** $\rightarrow$ selecciona **Running Activity Support**.
5. ¡Listo! En cuanto inicies la actividad, el Data Field empezará a emitir telemetría por BLE.

---

## 📱 2. Guía Paso a Paso: App Android Companion (`apps/android-companion`)

Actúa como pasarela headless (sin gastar batería en renderizar métricas) entre el reloj y la nube.

### Prerrequisitos:
* **Android Studio** instalado (o Android SDK con `adb`).
* Un teléfono físico Android con Bluetooth y conexión de datos móviles.

### Paso 1: Compilar la APK
Desde la terminal:
```bash
cd apps/android-companion

# Dar permisos de ejecución al wrapper de Gradle (si es necesario)
chmod +x gradlew

# Compilar APK de depuración
./gradlew assembleDebug
```
El archivo APK resultante se generará en:  
`apps/android-companion/app/build/outputs/apk/debug/app-debug.apk`

### Paso 2: Instalar la APK en tu teléfono
* **Vía ADB (por cable USB o Wi-Fi)**:
  ```bash
  adb install -r app/build/outputs/apk/debug/app-debug.apk
  ```
* **Vía Android Studio**: Abre la carpeta `apps/android-companion` en Android Studio y pulsa **Run 'app'** (`Shift + F10`).
* **Vía archivo directo**: Puedes enviarte el `.apk` a tu teléfono (Telegram, Google Drive, WhatsApp) e instalarlo directamente en Android.

### Paso 3: Configurar y Arrancar en el Teléfono
1. Abre la aplicación **Running Support Gateway** en tu teléfono.
2. Concede los permisos que te solicite (Dispositivos cercanos / Bluetooth y Notificaciones).
3. **Configura la URL de tu Servidor**:
   * En el campo **"SERVIDOR RELAY WEBSOCKET"**, escribe la URL de tu servidor:
     - **En pruebas locales (mismo Wi-Fi)**: `ws://192.168.1.XX:3001/api/ws/session` (la IP local de tu ordenador).
     - **En emulador Android**: `ws://10.0.2.2:3001/api/ws/session`.
     - **En producción (desplegado en internet)**: `wss://tudominio.com/api/ws/session`.
4. Enciende el interruptor **"Servicio en Primer Plano"**:
   * La app conectará por BLE con tu reloj y abrirá el socket con tu servidor.
   * La app mostrará en grande el **PIN DE ACCESO ESPECTADORES** (ej: `4829`) para que se lo des a tus seguidores.
   * Si escuchas Spotify en el móvil, la app detectará la música y la transmitirá automáticamente al dashboard.

---

## 🌐 3. Guía: Web Dashboard & Servidor Relay (`apps/web-dashboard`)

### Variables de Entorno Web (`.env.local` en `apps/web-dashboard/`):
Copia `.env.example` a `.env.local` y ajusta según tu entorno:

```ini
# Configuración del Atleta y Carrera
NEXT_PUBLIC_ATHLETE_NAME="Víctor"
NEXT_PUBLIC_DEFAULT_LOCALITY="Madrid"
NEXT_PUBLIC_TARGET_PACE="4:30"
NEXT_PUBLIC_DEFAULT_RACE_DISTANCE_M=10000

# Zonas Dinámicas de Esfuerzo Cardíaco (BPM)
NEXT_PUBLIC_ZONE_1_MAX=130
NEXT_PUBLIC_ZONE_2_MAX=145
NEXT_PUBLIC_ZONE_3_MAX=160
NEXT_PUBLIC_ZONE_4_MAX=175
NEXT_PUBLIC_ZONE_5_MAX=195

# Rangos Dinámicos de Cadencia (Pasos por Minuto - SPM)
NEXT_PUBLIC_CADENCE_LOW_MAX=155
NEXT_PUBLIC_CADENCE_MODERATE_MAX=169
NEXT_PUBLIC_CADENCE_OPTIMAL_MAX=185

# Umbrales y Gatillos de Notificaciones para Espectadores
NEXT_PUBLIC_NOTIF_EXERTION_HR_BPM=175          # Pulso (BPM) para alerta de alto esfuerzo (o hereda NEXT_PUBLIC_ZONE_4_MAX)
NEXT_PUBLIC_NOTIF_EXERTION_COOLDOWN_SEC=30     # Cooldown entre alertas consecutivas de esfuerzo (segundos)
NEXT_PUBLIC_NOTIF_EXERTION_MAX_CONSECUTIVE=3   # Límite máximo de alertas consecutivas de esfuerzo
NEXT_PUBLIC_NOTIF_SPRINT_HR_BPM=175            # Pulso mínimo (BPM) requerido para condición de sprint
NEXT_PUBLIC_NOTIF_SPRINT_CADENCE_SPM=180       # Cadencia mínima (SPM) requerida para condición de sprint
NEXT_PUBLIC_NOTIF_SPRINT_FINAL_DISTANCE_M=2000 # Distancia restante (metros) para considerar fase final (disparo único)
NEXT_PUBLIC_NOTIF_SPRINT_COOLDOWN_SEC=30       # Cooldown entre alertas de sprint en fase estándar
NEXT_PUBLIC_NOTIF_SPRINT_MAX_CONSECUTIVE=3     # Límite de alertas consecutivas de sprint en fase estándar

# Conexión WebSocket y Servidor
NEXT_PUBLIC_WS_URL="ws://localhost:3001/api/ws/session"
PORT=3000
```
*(En producción con SSL, cambia `NEXT_PUBLIC_WS_URL` por `wss://tudominio.com/api/ws/session`)*.

### Puesta en Marcha en Desarrollo:
```bash
# 1. Instalar dependencias
pnpm install

# 2. Iniciar el frontend Next.js (puerto 3000)
pnpm --filter web-dashboard dev

# 3. En otra terminal, iniciar el relay WebSocket (puerto 3001)
pnpm --filter web-dashboard relay
```
Abre en tu navegador `http://localhost:3000`.

### Despliegue en Producción (Docker / Dokploy / VPS):
El proyecto incluye un `Dockerfile` multi-stage optimizado que ejecuta el servidor unificado (`server.mjs`) en el puerto 3000 (manejando tanto el frontend Next.js como el endpoint WebSocket `/api/ws/session` en el mismo puerto):
```bash
# Construir imagen Docker
docker build -t running-activity-support .

# Ejecutar contenedor
docker run -d -p 3000:3000 \
  -e NEXT_PUBLIC_ATHLETE_NAME="Víctor" \
  -e NEXT_PUBLIC_WS_URL="wss://tudominio.com/api/ws/session" \
  running-activity-support
```

---

## 🏃 4. Pruebas Rápidas con Simulador (Sin Reloj ni Teléfono)

Si quieres probar todo el sistema en tu ordenador sin necesidad del reloj ni del teléfono:

1. Inicia el servidor relay:
   ```bash
   pnpm --filter web-dashboard relay
   ```
2. Inicia el simulador de corredor:
   ```bash
   pnpm --filter web-dashboard simulate:runner -- --token=live-session --pin=4829
   ```
3. En otra terminal, emite música en vivo simulada de Spotify:
   ```bash
   pnpm --filter web-dashboard simulate:now-playing -- --title="The Pretender" --artist="Foo Fighters" --state=PLAYING
   ```
4. Entra a `http://localhost:3000` y haz clic en **"Acceso Rápido (Carrera en Vivo)"** o accede a `http://localhost:3000/session/live-session`. Verás la telemetría en tiempo real sobre el mapa de Madrid y el reproductor de Spotify activo sobre el muro de ánimo.

---

## 🧪 5. Control de Calidad y Tests

### Comando Maestro de Test (Todo el Monorepo)
Desde la raíz del repositorio, ejecuta:
```bash
npm test
# o con pnpm:
pnpm test
```
Este comando encadena y valida automáticamente los 4 subsistemas del proyecto:
1. `test:contracts`: Validación de esquemas y tipos JSON compartidos (`packages/shared-contracts`).
2. `test:web`: Suite del servidor relay WebSocket y cuadro de mandos Next.js (`apps/web-dashboard`).
3. `test:android`: Tests unitarios de Android Companion y compilación de la APK de depuración (`apps/android-companion`). Multiplataforma (macOS, Linux y Windows).
4. `test:garmin`: Tests unitarios de Monkey C y compilación del binario `.prg` para Fenix 7S (`apps/garmin-fenix7s`).

Para ejecutar pruebas individuales por subsistema:
```bash
npm run test:contracts   # Solo contratos compartidos
npm run test:web         # Solo web dashboard y relay
npm run test:android     # Solo Android (tests + APK)
npm run test:garmin      # Solo Garmin Fenix 7S (tests + PRG)
```

---

## 🛠 Guía de Configuración del Entorno para Tests (Para Desarrolladores y LLMs)

Para que un desarrollador o un agente LLM pueda aprovisionar una máquina desde cero y ejecutar exitosamente `npm test`, deben cumplirse los siguientes prerrequisitos:

### 1. Node.js (v20 o superior)
- Instalar Node.js LTS mediante tu gestor de versiones preferido (`fnm`, `nvm`, `asdf`) o instalador oficial.
- Instalar `pnpm` globalmente: `npm install -g pnpm`.

### 2. Java Runtime (JDK 17)
Tanto Android Gradle como el compilador `monkeyc` de Garmin requieren Java 17.
- **macOS:**
  ```bash
  # Opción directa sin privilegios de root (Apple Silicon aarch64):
  mkdir -p ~/.jdk && curl -L "https://api.adoptium.net/v3/binary/latest/17/ga/mac/aarch64/jdk/hotspot/normal/eclipse" | tar -xz -C ~/.jdk
  export JAVA_HOME="$HOME/.jdk/$(ls ~/.jdk | grep jdk-17)/Contents/Home"
  ```
- **Linux (Ubuntu/Debian):**
  ```bash
  sudo apt-get update && sudo apt-get install -y openjdk-17-jdk
  export JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64"
  ```
- **Windows:**
  ```powershell
  winget install EclipseAdoptium.Temurin.17.JDK
  # o con Chocolatey:
  choco install openjdk17
  ```

### 3. Android SDK (Command-line Tools & Platform 36)
Para compilar la APK y correr los tests de Android Companion sin necesidad de la interfaz gráfica de Android Studio:
1. Descarga e instala los **Android Command Line Tools**:
   - **macOS:**
     ```bash
     mkdir -p ~/.android-sdk/cmdline-tools
     curl -L -o /tmp/cmdline-tools.zip "https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip"
     unzip -q /tmp/cmdline-tools.zip -d ~/.android-sdk/cmdline-tools
     mv ~/.android-sdk/cmdline-tools/cmdline-tools ~/.android-sdk/cmdline-tools/latest
     rm /tmp/cmdline-tools.zip
     ```
   - **Linux:**
     ```bash
     mkdir -p ~/.android-sdk/cmdline-tools
     curl -L -o /tmp/cmdline-tools.zip "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
     unzip -q /tmp/cmdline-tools.zip -d ~/.android-sdk/cmdline-tools
     mv ~/.android-sdk/cmdline-tools/cmdline-tools ~/.android-sdk/cmdline-tools/latest
     rm /tmp/cmdline-tools.zip
     ```
   - **Windows:**
     Descarga `commandlinetools-win-11076708_latest.zip` y descomprime en `%USERPROFILE%\.android-sdk\cmdline-tools\latest`.

2. Instala la plataforma y build-tools con `sdkmanager`:
   ```bash
   yes | ~/.android-sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root="$HOME/.android-sdk" "platforms;android-36" "build-tools;35.0.0" "build-tools;34.0.0"
   ```

3. Crea o verifica `apps/android-companion/local.properties`:
   ```properties
   sdk.dir=/Users/tu_usuario/.android-sdk
   ```
   *(El script `scripts/test-android.mjs` lo detecta y genera automáticamente si detecta `~/.android-sdk`)*.

### 4. Garmin Connect IQ SDK (`monkeyc`) y Definición de Dispositivo `fenix7s`
Para compilar y testear la app de reloj:
1. **Descarga el SDK de Connect IQ:**
   Consulta la última versión en `https://developer.garmin.com/downloads/connect-iq/sdks/sdks.json` y descomprime en `~/.garmin/connectiq-sdk/` (o agrega la carpeta `bin/` al `PATH`).
   - Crear un archivo vacío `~/.garmin/connectiq-sdk/bin/default.jungle` si el SDK no lo genera automáticamente.
2. **Definiciones del dispositivo `fenix7s`:**
   El compilador `monkeyc` busca las definiciones del dispositivo (`compiler.json`, layouts y simulador) en la carpeta de datos de Connect IQ:
   - **macOS:** `~/Library/Application Support/Garmin/ConnectIQ/Devices/fenix7s/`
   - **Linux:** `~/.Garmin/ConnectIQ/Devices/fenix7s/`
   - **Windows:** `%APPDATA%\Garmin\ConnectIQ\Devices\fenix7s\`
3. **Clave de desarrollador (`developer_key`):**
   - Deposita el archivo de clave privada RSA en la raíz del repositorio con el nombre **`developer_key`** (o `developer_key.der`).
   - *Nota de seguridad:* Este archivo está en `.gitignore` y **nunca** debe subirse al control de versiones. Si el archivo no existe, `npm test` mostrará un aviso explicativo y continuará con los tests de los otros módulos sin fallar abruptamente.

---

## 🛡 Quality Gate

```bash
# Ejecutar el Quality Gate determinista (Airbnb linter, Oxlint, tipos estrictos y complejidad)
bash .specify/scripts/bash/check-quality-gate.sh
```
