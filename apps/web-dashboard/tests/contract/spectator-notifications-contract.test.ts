import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  isSpectatorNotification,
  type SpectatorNotification,
} from '@running-support/shared-contracts';

function loadSpectatorSchema() {
  const schemaPath = path.resolve(
    process.cwd(),
    '../../packages/shared-contracts/spectator-notifications.schema.json',
  );
  const fallbackPath = path.resolve(
    process.cwd(),
    'packages/shared-contracts/spectator-notifications.schema.json',
  );
  const targetPath = fs.existsSync(schemaPath) ? schemaPath : fallbackPath;
  return JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
}

void test('Spectator Notification Contract: JSON schema definition', () => {
  const schema = loadSpectatorSchema();
  assert.equal(schema.title, 'SpectatorNotificationEvent');
  assert.deepEqual(schema.required, ['id', 'type', 'title', 'message', 'timestamp', 'durationMs']);
  assert.deepEqual(schema.properties.type.enum, [
    'MILESTONE_25',
    'MILESTONE_50',
    'MILESTONE_75',
    'EXERTION',
    'SPRINT',
  ]);
});

void test('Spectator Notification Contract: Valid payload fixtures', () => {
  const milestone: SpectatorNotification = {
    id: 'notif-m25',
    type: 'MILESTONE_25',
    title: '¡25% Completado!',
    message: 'Víctor ha completado el primer cuarto del recorrido (2.5 km).',
    timestamp: 1729500142000,
    durationMs: 6000,
  };
  assert.equal(isSpectatorNotification(milestone), true);

  const exertion: SpectatorNotification = {
    id: 'notif-exertion',
    type: 'EXERTION',
    title: 'Alto Esfuerzo',
    message: 'Víctor está haciendo un esfuerzo (188 bpm).',
    timestamp: 1729500210000,
    durationMs: 6000,
  };
  assert.equal(isSpectatorNotification(exertion), true);

  const sprintNotif: SpectatorNotification = {
    id: 'notif-sprint',
    type: 'SPRINT',
    title: '¡Sprint en curso!',
    message: '¡Víctor está sprintando a 192 bpm y 212 spm!',
    timestamp: 1729500350000,
    durationMs: 8000,
    cta: {
      label: '¡Envíale un ánimo!',
      action: 'SCROLL_CHEER_WALL',
      presetId: 'MUCHO_ANIMO',
      customText: '¡A por el sprint final!',
    },
  };
  assert.equal(isSpectatorNotification(sprintNotif), true);
});

void test('Spectator Notification Contract: Rejects invalid payloads', () => {
  const missingTitle = {
    id: 'notif-invalid',
    type: 'MILESTONE_50',
    message: 'Falta título',
    timestamp: Date.now(),
    durationMs: 6000,
  };
  assert.equal(isSpectatorNotification(missingTitle), false);

  const badCtaAction = {
    id: 'notif-bad-cta',
    type: 'SPRINT',
    title: 'Sprint',
    message: 'Sprint con mala acción',
    timestamp: Date.now(),
    durationMs: 6000,
    cta: { label: 'Ir', action: 'OPEN_POPUP' },
  };
  assert.equal(isSpectatorNotification(badCtaAction), false);

  const badCtaPreset = {
    id: 'notif-bad-preset',
    type: 'SPRINT',
    title: 'Sprint',
    message: 'Sprint con preset inválido',
    timestamp: Date.now(),
    durationMs: 6000,
    cta: { label: 'Ir', action: 'SCROLL_CHEER_WALL', presetId: 'INVALID_PRESET' },
  };
  assert.equal(isSpectatorNotification(badCtaPreset), false);
});
