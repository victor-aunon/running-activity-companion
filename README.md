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
# Nombre mostrado en la cabecera del dashboard
NEXT_PUBLIC_ATHLETE_NAME="Víctor"

# Localidad del evento
NEXT_PUBLIC_DEFAULT_LOCALITY="Madrid"

# Endpoint de conexión WebSocket para los espectadores
NEXT_PUBLIC_WS_URL="ws://localhost:3001/api/ws/session"

# Puerto HTTP del frontend Next.js
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

```bash
# Ejecutar suite de pruebas (unitarias, contratos y schemas)
pnpm --filter web-dashboard test

# Ejecutar el Quality Gate determinista (Airbnb linter, Oxlint, tipos estrictos y complejidad)
bash .specify/scripts/bash/check-quality-gate.sh
```
