import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveNotificationVisualConfig,
  executeCtaScrollAndPreset,
} from '../../src/components/ui/NotificationSnackbarLogic.ts';
import type { NotificationCta } from '@running-support/shared-contracts';

void test('NotificationSnackbarContainer Unit Tests', async (t) => {
  await t.test('Resolves correct badge labels and styles per notification type', () => {
    assert.equal(resolveNotificationVisualConfig('MILESTONE_25').badgeLabel, 'Hito');
    assert.equal(resolveNotificationVisualConfig('EXERTION').badgeLabel, 'Esfuerzo');
    assert.equal(resolveNotificationVisualConfig('SPRINT').badgeLabel, 'Sprint');
  });

  await t.test(
    'executeCtaScrollAndPreset triggers smooth scroll to cheer-wall and selects preset',
    () => {
      let scrolledTargetId = '';
      let selectedPreset = '';

      const sprintCta: NotificationCta = {
        label: '¡Envíale un ánimo!',
        action: 'SCROLL_CHEER_WALL',
        presetId: 'MUCHO_ANIMO',
        customText: '¡A por el sprint final!',
      };

      executeCtaScrollAndPreset(sprintCta, {
        scrollToElement: (id) => {
          scrolledTargetId = id;
        },
        selectPreset: (preset) => {
          selectedPreset = preset;
        },
      });

      assert.equal(scrolledTargetId, 'cheer-wall', 'Must target cheer-wall anchor');
      assert.equal(selectedPreset, 'MUCHO_ANIMO', 'Must preselect sprint preset');
    },
  );
});
