#!/usr/bin/env node

import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const garminDir = path.join(projectRoot, 'apps', 'garmin-fenix7s');

console.log('\n========================================');
console.log('⌚ Garmin Fenix 7S: Tests y Compilación');
console.log('========================================');

if (!fs.existsSync(garminDir)) {
  console.error(`❌ Directorio no encontrado: ${garminDir}`);
  process.exit(1);
}

// 1. Verificar existencia de la developer_key en la raíz
const candidateKeys = [
  path.join(projectRoot, 'developer_key'),
  path.join(projectRoot, 'developer_key.der'),
  path.join(projectRoot, 'developer_key.pem'),
  path.join(garminDir, 'developer_key'),
  path.join(garminDir, 'developer_key.der')
];

let developerKeyPath = candidateKeys.find(p => fs.existsSync(p));

if (!developerKeyPath) {
  console.warn('\n⚠️  [GARMIN AVISO] No se encontró el archivo de clave de desarrollador (developer_key).');
  console.warn('   Garmin Connect IQ (Monkey C) requiere una clave RSA para firmar binarios y compilar tests.');
  console.warn('   Por favor, deposita tu clave en la raíz del proyecto como "developer_key" para habilitar los tests.');
  console.warn('   Saltando ejecución de tests de garmin-fenix7s por falta de credencial local.\n');
  process.exit(0);
}

console.log(`🔑 Clave de desarrollador detectada: ${path.relative(projectRoot, developerKeyPath)}`);

// 2. Configurar JAVA_HOME si no está presente
const env = { ...process.env };
if (!env.JAVA_HOME) {
  const localJdk = path.join(os.homedir(), '.jdk', 'jdk-17.0.21+9', 'Contents', 'Home');
  if (fs.existsSync(localJdk)) {
    env.JAVA_HOME = localJdk;
  }
}

// 3. Localizar el compilador monkeyc
const isWindows = process.platform === 'win32';
const monkeycExe = isWindows ? 'monkeyc.bat' : 'monkeyc';

function findMonkeyc() {
  // A. PATH del sistema
  const whichCmd = isWindows ? 'where' : 'which';
  const check = spawnSync(whichCmd, [monkeycExe], { env, shell: isWindows });
  if (check.status === 0 && check.stdout) {
    const lines = check.stdout.toString().trim().split(/\r?\n/);
    if (lines[0] && fs.existsSync(lines[0])) return lines[0];
  }

  // B. Rutas estándar en Linux / macOS / Windows
  const candidates = [
    path.join(os.homedir(), 'AppData', 'Roaming', 'Garmin', 'ConnectIQ', 'Sdks', 'connectiq-sdk-win-9.3.0-2026-10-20-95888f262' , 'bin', 'monkeybrains.jar'),
    path.join(os.homedir(), '.garmin', 'connectiq-sdk', 'bin', monkeycExe),
    path.join(os.homedir(), 'Library', 'Application Support', 'Garmin', 'ConnectIQ', 'Sdks'),
  ];

  if (candidates[0] && fs.existsSync(candidates[0])) {
    return candidates[0];
  }

  return null;
}

const monkeycBin = findMonkeyc();
if (!monkeycBin) {
  console.warn('\n⚠️  [GARMIN AVISO] El compilador monkeyc no está disponible en el PATH ni en ~/.garmin/connectiq-sdk.');
  console.warn('   Para compilar en local o CI, instala el Connect IQ SDK de Garmin.');
  console.warn('   Saltando ejecución de garmin-fenix7s.\n');
  process.exit(0);
}

console.log(`🛠️  Compilador Monkey C: ${monkeycBin}`);

// 4. Asegurar existencia de directorio bin y default.jungle en el SDK si aplica
const binDir = path.join(garminDir, 'bin');
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

const defaultJungleSdk = path.join(path.dirname(monkeycBin), 'default.jungle');
if (!fs.existsSync(defaultJungleSdk)) {
  try {
    fs.writeFileSync(defaultJungleSdk, '');
  } catch (e) {
    // ignorar si no hay permisos de escritura
  }
}

const relativeKey = path.relative(garminDir, developerKeyPath);

// 5. Compilar tests unitarios (monkeyc -t)
console.log('\n▶️  [1/2] Compilando tests unitarios para Garmin Fenix 7S (--unit-test)...');
const testOut = path.join('bin', 'RunningSupportTest.prg');
const testArgs = [
  '-d', 'fenix7s',
  '-f', 'monkey.jungle',
  '-o', testOut,
  '-y', relativeKey,
  '-t'
];

const testResult = spawnSync(monkeycBin, testArgs, {
  cwd: garminDir,
  env,
  stdio: 'inherit',
  shell: isWindows
});

if (testResult.status !== 0) {
  console.error(`\n❌ Error compilando tests unitarios de Garmin (exit code: ${testResult.status})`);
  process.exit(testResult.status || 1);
}

// 6. Compilar binario de la aplicación (.prg)
console.log('\n▶️  [2/2] Compilando aplicación ejecutable para Garmin Fenix 7S (RunningSupport.prg)...');
const appOut = path.join('bin', 'RunningSupport.prg');
const appArgs = [
  '-d', 'fenix7s',
  '-f', 'monkey.jungle',
  '-o', appOut,
  '-y', relativeKey
];

const appResult = spawnSync(monkeycBin, appArgs, {
  cwd: garminDir,
  env,
  stdio: 'inherit',
  shell: isWindows
});

if (appResult.status !== 0) {
  console.error(`\n❌ Error compilando la aplicación Garmin .prg (exit code: ${appResult.status})`);
  process.exit(appResult.status || 1);
}

console.log('\n✅ Garmin Fenix 7S: Tests compilados y binario .prg generado exitosamente en apps/garmin-fenix7s/bin/RunningSupport.prg');
