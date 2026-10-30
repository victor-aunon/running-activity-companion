import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCheerWallCredentialsConfig,
  buildCheerPayload,
  resolveCheerStatusConfig,
  formatShortTime,
} from '../../src/components/bento/CheerWallLogic.ts';

void test('CheerWallTile Unit Tests: Frictionless cheer submission without PIN input', async (t) => {
  await t.test('Omits PIN input field and configures senderName as full width', () => {
    const config = getCheerWallCredentialsConfig();
    assert.equal(config.hasPinInput, false, 'PIN input field must be completely omitted');
    assert.equal(config.senderNameFullWidth, true, 'Sender name field must occupy full width');
    assert.equal(config.activePinRequired, false, 'User is not prompted for PIN');
  });

  await t.test('buildCheerPayload automatically injects activePin without user entry', () => {
    const activeSessionPin = '4829';
    const payload = buildCheerPayload('Laura', 'MUCHO_ANIMO', '¡Mucho ánimo!', activeSessionPin);

    assert.equal(payload.senderName, 'Laura');
    assert.equal(payload.presetId, 'MUCHO_ANIMO');
    assert.equal(payload.body, '¡Mucho ánimo!');
    assert.equal(payload.pin, '4829', 'Active session PIN must be transparently used');
  });

  await t.test('buildCheerPayload throws if senderName is empty', () => {
    assert.throws(
      () => buildCheerPayload('   ', 'TU_PUEDES', '¡Tú puedes!', '4829'),
      /Por favor, indica tu nombre/,
    );
  });

  await t.test('resolveCheerStatusConfig provides visual styling for all cheer states', () => {
    assert.equal(resolveCheerStatusConfig('ENVIADO').label, 'Enviado');
    assert.equal(resolveCheerStatusConfig('EN_RELOJ').label, 'Enviado');
    assert.equal(resolveCheerStatusConfig('AGRADECIDO').label, 'Agradecido');
    assert.equal(resolveCheerStatusConfig('EXPIRADO').label, 'Expirado');
  });

  await t.test('formatShortTime formats timestamp to HH:MM format', () => {
    const ts = new Date(2026, 9, 29, 14, 35).getTime();
    assert.equal(formatShortTime(ts), '14:35');
    assert.equal(formatShortTime(undefined), '');
  });
});
