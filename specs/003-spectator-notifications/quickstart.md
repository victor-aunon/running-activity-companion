# Quickstart: Validación de Notificaciones Web y Experiencia del Espectador

**Feature**: `003-spectator-notifications`  
**Date**: 2026-10-29  
**Spec Reference**: [spec.md](./spec.md) | [data-model.md](./data-model.md) | [contracts/](./contracts/)

---

## 1. Prerrequisitos y Preparación

Compilar los contratos compartidos e iniciar el entorno local:

```bash
# Desde la raíz del repositorio
pnpm install
pnpm build --filter @running-support/shared-contracts
```

---

## 2. Escenarios de Validación End-to-End

### Escenario 1: Envío de Ánimo sin Campo de PIN en el Muro de Ánimos

Verifica que el espectador no visualiza el campo de PIN en el Muro de Ánimos y puede despachar mensajes directamente:

1. Inicia el servidor de retransmisión (Relay) y la webapp:
   ```bash
   pnpm --filter @running-support/web-dashboard dev
   ```
2. Abre en el navegador la sesión autenticada: `http://localhost:3000/session/live-marathon-2026?mock=stitch&pin=4829`.
3. Navega al Muro de Ánimos (`CheerWallTile`) en la columna derecha del dashboard.
4. **Verificación visual y de interacción**:
   - El formulario solo muestra el campo de texto *"Tu nombre (ej. Laura)..."*.
   - **NO** existe ningún campo de entrada para el PIN de 4 dígitos.
   - Pulsa un botón de ánimo rápido (ej. "¡Mucho ánimo!").
   - El mensaje se envía de inmediato, transicionando a estado "Enviado" sin errores de autorización.

---

### Escenario 2: Solicitud Anticipada de Permisos en la Pantalla de Acceso

Verifica que la solicitud de notificaciones se gestiona antes de entrar al dashboard:

1. Abre el navegador en la pantalla inicial: `http://localhost:3000/`.
2. Introduce el identificador de sesión `carrera-victor` y el PIN `4829`.
3. Haz clic en el botón principal **"Conectar en Vivo"**.
4. **Comprobación**:
   - El navegador muestra el diálogo nativo solicitando permisos de notificación (*"¿Quieres permitir que running-activity-support envíe notificaciones?"*).
   - Al aceptar o rechazar, el navegador redirige inmediatamente al dashboard de la sesión.
   - Una vez dentro del dashboard, no aparece ningún diálogo emergente invasivo de permisos.

---

### Escenario 3: Pruebas de Hitos de Distancia (25%, 50%, 75%) mediante Simulador

Utiliza el atajo interactivo `[k]` en el simulador para avanzar rápidamente la carrera:

1. En una terminal, ejecuta el simulador de corredor:
   ```bash
   pnpm --filter @running-support/web-dashboard simulate:runner -- --port=3001 --token=carrera-victor
   ```
2. En el navegador, mantén abierta la sesión `http://localhost:3000/session/carrera-victor?pin=4829`.
3. En la terminal del simulador, pulsa la tecla `[k]` repetidamente (cada pulsación suma +1 km):
   - Al alcanzar **2.5 km** (25% de 10 km): Aparece un snackbar *"¡25% Completado!"* y una notificación de escritorio del navegador.
   - Al alcanzar **5.0 km** (50% de 10 km): Aparece el aviso del ecuador de la carrera.
   - Al alcanzar **7.5 km** (75% de 10 km): Aparece el aviso de la fase decisiva.

---

### Escenario 4: Pruebas de Alertas de Esfuerzo y Sprint con Atajos de Teclado

Verifica los avisos fisiológicos utilizando los atajos `[h]` y `[c]`:

1. Con el simulador y la webapp conectados:
2. **Prueba de Esfuerzo**:
   - Pulsa `[h]` en la terminal del simulador. La consola indicará: `💓 [OVERRIDE] Pulso fijado a 190 bpm`.
   - En la webapp, en menos de 1 segundo se muestra el snackbar: *"Víctor está haciendo un esfuerzo (190 bpm)"*.
   - Si se mantiene durante 30 segundos, se reenvía el aviso (hasta un máximo de 3 veces).
   - Pulsa `[h]` nuevamente para restaurar el pulso regular: el contador de alertas consecutivas se resetea.
3. **Prueba de Sprint y Llamada a la Acción (CTA)**:
   - Pulsa simultáneamente `[h]` (pulso a 190 bpm) y `[c]` (cadencia a 210 spm).
   - En la webapp aparece la alerta destacada: *"¡Sprint en curso!"* con el botón **"¡Envíale un ánimo!"**.
   - Haz clic en *"¡Envíale un ánimo!"*:
     - La pantalla realiza un desplazamiento suave (*smooth scroll*) directo hasta el Muro de Ánimos.
     - El formulario preselecciona el mensaje de sprint listo para ser enviado con un toque.

---

### Escenario 5: Supresión de Alertas para Espectadores Tardíos

Verifica que no se emiten alertas retroactivas acumuladas:

1. Avanza en el simulador la distancia hasta los **6.0 km** con la tecla `[k]`.
2. Abre una **nueva pestaña** del navegador en modo incógnito o recarga la sesión en `http://localhost:3000/session/carrera-victor?pin=4829`.
3. **Comprobación**:
   - No se dispara ninguna alerta retroactiva de los hitos del 25% ni del 50%.
   - Al pulsar `[k]` y superar los **7.5 km**, la alerta del 75% sí se dispara en tiempo real con normalidad.

---

### Escenario 6: Ejecución de la Suite Completa de Tests

Ejecuta las pruebas unitarias y de contrato automatizadas:

```bash
# Tests unitarios del hook useSpectatorNotifications y componentes
pnpm --filter @running-support/web-dashboard test tests/unit/useSpectatorNotifications.test.ts
pnpm --filter @running-support/web-dashboard test tests/unit/CheerWallTile.test.ts
pnpm --filter @running-support/web-dashboard test tests/contract/spectator-notifications-contract.test.ts
```

**Criterio de éxito**: Todos los tests se ejecutan en verde (100% passing) sin regresiones.
