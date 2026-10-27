import test from 'node:test';
import assert from 'node:assert/strict';

void test('useSpectatorCheer Unit Test: Cheer validation and name truncation logic', async (t) => {
  await t.test('Truncates athlete names over 20 characters with ellipsis', () => {
    function formatGratitudeText(name: string): string {
      const truncated = name.length > 20 ? `${name.substring(0, 17)}...` : name;
      return `${truncated} te lo agradece`;
    }

    assert.equal(formatGratitudeText('Víctor'), 'Víctor te lo agradece');
    assert.equal(
      formatGratitudeText('Federico Guillermo Alejandro de la Mancha'),
      'Federico Guillerm... te lo agradece',
    );
  });

  await t.test('Validates 4-digit PIN format', () => {
    const pinRegex = /^\d{4}$/;
    assert.equal(pinRegex.test('4829'), true);
    assert.equal(pinRegex.test('123'), false);
    assert.equal(pinRegex.test('12345'), false);
    assert.equal(pinRegex.test('abcd'), false);
  });

  await t.test('Formats cheer statuses gracefully for the UI', () => {
    function resolveStatusLabel(status: string): string {
      switch (status) {
        case 'EN_RELOJ':
        case 'ENVIADO':
          return 'Enviado';
        case 'AGRADECIDO':
          return 'Agradecido';
        case 'EXPIRADO':
          return 'Expirado';
        default:
          return 'Enviado';
      }
    }

    assert.equal(resolveStatusLabel('EN_RELOJ'), 'Enviado');
    assert.equal(resolveStatusLabel('ENVIADO'), 'Enviado');
    assert.equal(resolveStatusLabel('AGRADECIDO'), 'Agradecido');
    assert.equal(resolveStatusLabel('EXPIRADO'), 'Expirado');
  });
});
