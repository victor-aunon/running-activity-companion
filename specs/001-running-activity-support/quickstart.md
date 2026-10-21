# Quickstart & End-to-End Validation Guide: Running Activity Support

**Feature**: `001-running-activity-support` | **Date**: 2026-10-21 (Updated)

## 1. Prerequisites & Environment Setup

### 1.1 Web Application (Next.js Latest - Aurora Bento Light)
- **Node.js**: v20+ or v22 LTS
- **Package Manager**: pnpm or npm
- **Dependencies**: Next.js 15+, React 19, Tailwind CSS v4, `class-variance-authority`, `leaflet`, `lucide-react`.
- **Environment Variables** (`apps/web-dashboard/.env.local`):
  ```env
  NEXT_PUBLIC_ATHLETE_NAME=Víctor
  NEXT_PUBLIC_ZONE_1_MAX=130
  NEXT_PUBLIC_ZONE_2_MAX=145
  NEXT_PUBLIC_ZONE_3_MAX=160
  NEXT_PUBLIC_ZONE_4_MAX=175
  NEXT_PUBLIC_ZONE_5_MAX=195
  NEXT_PUBLIC_WS_URL=ws://localhost:3000/api/ws/session
  PORT=3000
  ```

### 1.2 Android Companion Gateway (Android 16)
- **Target SDK**: Android 16 (API 36) | Min SDK: 28
- **Permissions**: `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`, `FOREGROUND_SERVICE_CONNECTED_DEVICE`.
- **UI Verification**: Confirm that the Compose UI displays only connection cards, service switch, and 4-digit PIN—**zero running metrics**.

### 1.3 Garmin Wearable (Garmin Fenix 7s - Native Run Integration)
- **Connect IQ Type**: Data Field (`Toybox.WatchUi.DataField`).
- **Configuration**: Added to one of the data screens of the **native Garmin Running activity** ("Carrera").
- **Pre-Activity Toggle**: Verify setting `Servicio En Vivo: [ ACTIVADO ]` in the Data Field on-device menu.

---

## 2. End-to-End Validation Scenarios (With & Without Physical Watch)

### Scenario 1: Standalone Web Testing with CLI Virtual Runner (NO Hardware Required)
**Objective**: Develop and verify 100% of the Bento Box web dashboard, live Leaflet route map, and spectator cheer interaction without needing a Garmin watch or Android phone.

1. **Start Next.js Dashboard**:
   ```bash
   cd apps/web-dashboard
   npm run dev
   ```
2. **Launch the CLI Virtual Runner**:
   ```bash
   npm run simulate:runner -- --token=test-session --pin=4829
   ```
   *Behavior*:
   - Simulates a runner moving along an outdoor GPS path at 1 Hz.
   - Emits heart rate varying between 135 bpm (aerobic) and 172 bpm (threshold).
   - Listens for incoming spectator cheers from the web.
3. **Open Web Browser**: Navigate to `http://localhost:3000/session/test-session`.
   - Observe live Bento Box metrics updating each second.
   - Observe moving GPS marker and route line on Leaflet map.
4. **Test Cheer Wall & Runner Reply**:
   - In browser: enter PIN `4829`, click `"¡Mucho ánimo!"` → Status turns to `"Enviado"`.
   - In terminal (CLI Runner): press `[r]` (or Enter) to simulate runner pressing the watch reply button.
   - In browser: status turns immediately to `"Víctor te lo agradece"`.

---

### Scenario 2: Android Gateway Testing with Mock BLE Source (NO Watch Required)
**Objective**: Verify Android Room database persistence, offline queue buffering, and foreground service lifecycle without a physical Garmin watch.

1. In the Android app, enable the **"Modo Simulación / Prueba"** toggle in the Gateway console.
2. The internal `MockTelemetryDataSource` begins generating 1 Hz running samples directly into Room SQLite.
3. Test cellular disconnection by toggling Airplane Mode on the phone:
   - Observe the pending buffer counter increase (e.g., `30 paquetes pendientes`).
   - Turn off Airplane Mode: observe the counter drain to 0 as records are synchronized to the web.
4. Test notification receipt:
   - Send cheer from the web.
   - Android displays an interactive system notification with an action button `[Agradecer]`.
   - Clicking `[Agradecer]` on the phone relays `"Víctor te lo agradece"` to the web.

---

### Scenario 3: Garmin Connect IQ Desktop Simulator (NO Physical Watch Required)
**Objective**: Test the actual Monkey C Data Field bytecode and button interactions on your computer before flashing to hardware.

1. In VS Code or terminal with Connect IQ SDK:
   ```bash
   connectiq  # Starts the official Garmin Device Simulator
   ```
2. Select device target: **Garmin Fenix 7s**.
3. In simulator menu: **Simulation → Fit Data → Simulate Data** (or load a sample `.fit` run file).
4. Run the Data Field:
   - Verify top banner renders cleanly over native activity fields when a cheer packet arrives.
   - Click the simulated physical button `Start` to trigger the gratitude reply.
