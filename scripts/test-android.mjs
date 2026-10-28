#!/usr/bin/env node

import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const androidDir = path.join(projectRoot, 'apps', 'android-companion');

console.log('\n========================================');
console.log('🤖 Android Companion: Tests y Build APK');
console.log('========================================');

if (!fs.existsSync(androidDir)) {
  console.error(`❌ Directorio no encontrado: ${androidDir}`);
  process.exit(1);
}

// 1. Detectar o configurar JAVA_HOME si no está en el entorno
const env = { ...process.env };
if (!env.JAVA_HOME) {
  const localJdk = path.join(os.homedir(), '.jdk', 'jdk-17.0.21+9', 'Contents', 'Home');
  if (fs.existsSync(localJdk)) {
    env.JAVA_HOME = localJdk;
  }
}

// 2. Configurar Android SDK si no está en el entorno
const localSdk = path.join(os.homedir(), '.android-sdk');
if (!env.ANDROID_HOME && fs.existsSync(localSdk)) {
  env.ANDROID_HOME = localSdk;
}

const localProps = path.join(androidDir, 'local.properties');
if (!fs.existsSync(localProps) && env.ANDROID_HOME) {
  const sdkPathEscaped = env.ANDROID_HOME.replace(/\\/g, '/');
  fs.writeFileSync(localProps, `sdk.dir=${sdkPathEscaped}\n`);
}

// Configurar ANDROID_USER_HOME si existe scratch local
const localAndroidHome = path.join(projectRoot, '.android');
if (!env.ANDROID_USER_HOME && fs.existsSync(localAndroidHome)) {
  env.ANDROID_USER_HOME = localAndroidHome;
}

// 3. Ejecutar gradlew (Windows: gradlew.bat, macOS/Linux: ./gradlew)
const isWindows = process.platform === 'win32';
const gradlewCmd = isWindows ? 'gradlew.bat' : './gradlew';
const gradlewPath = path.join(androidDir, gradlewCmd);

if (!fs.existsSync(gradlewPath)) {
  console.error(`❌ No se encontró el wrapper de Gradle en: ${gradlewPath}`);
  process.exit(1);
}

console.log(`📍 Entorno: ${process.platform} (${os.arch()})`);
console.log(`☕ JAVA_HOME: ${env.JAVA_HOME || '(del sistema)'}`);
console.log(`📲 ANDROID_HOME: ${env.ANDROID_HOME || '(del sistema / local.properties)'}`);

console.log('\n▶️  Ejecutando tests unitarios y compilando APK (testDebugUnitTest + assembleDebug)...');

const result = spawnSync(gradlewCmd, ['testDebugUnitTest', 'assembleDebug'], {
  cwd: androidDir,
  env,
  stdio: 'inherit',
  shell: isWindows
});

if (result.status !== 0) {
  console.error(`\n❌ Error ejecutando tests o build de Android Companion (exit code: ${result.status})`);
  process.exit(result.status || 1);
}

console.log('\n✅ Android Companion: Tests pasados y APK compilada exitosamente.');
