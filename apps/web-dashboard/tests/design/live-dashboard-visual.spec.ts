import { test, expect } from '@playwright/test';

test.describe('Live Dashboard Visual Design Audit (Google Stitch Fidelity)', () => {
  test('Dashboard page matches Aurora Bento Box Light Mode specification', async ({ page }) => {
    await page.goto('/session/live-demo?mock=stitch');
    await page.waitForLoadState('networkidle');

    // 1. Verify Light Mode background presence
    const bodyBg = await page.evaluate(() => {
      const el = document.body;
      return window.getComputedStyle(el).backgroundColor;
    });
    expect(bodyBg).toBe('rgb(248, 250, 252)');

    // 2. Verify header cards exist with 16px rounded-2xl border radius
    const headerRadius = await page.evaluate(() => {
      const card = document.querySelector('header');
      return card ? window.getComputedStyle(card).borderRadius : null;
    });
    expect(headerRadius).toBe('16px');

    // 3. Visual snapshot comparison against Stitch golden master
    await expect(page).toHaveScreenshot('screen-live-dashboard.png', {
      scale: 'device',
      maxDiffPixelRatio: 0.05,
      animations: 'disabled',
    });
  });

  test('Dashboard page displays clean fallbacks when no live telemetry is active', async ({
    page,
  }) => {
    await page.goto('/session/unstarted-live-session');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=--:--').first()).toBeVisible();
    await expect(page.locator('text=0.00')).toBeVisible();
    await expect(page.locator('text=Aún no hay mensajes de ánimo')).toBeVisible();
    await expect(page.locator('text=PIN: ----')).toBeVisible();
  });
});

test.describe('Live Dashboard Interactive Controls and Layout', () => {
  test('Dashboard interactive controls and desktop height alignment', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1024 });
    await page.goto('/session/live-demo?mock=stitch');
    await page.waitForLoadState('networkidle');

    // 1. Share button copies link and shows feedback
    const shareBtn = page.getByRole('button', { name: /Compartir Enlace/i });
    await expect(shareBtn).toBeVisible();
    await shareBtn.click();
    await expect(page.getByText('¡Enlace Copiado!')).toBeVisible();

    // 2. Refresh button rotates and triggers refresh
    const refreshBtn = page.getByTitle('Actualizar datos');
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();

    // 3. Satellite button toggles between Satélite and Mapa
    const satelliteBtn = page.getByRole('button', { name: 'Satélite' });
    await expect(satelliteBtn).toBeVisible();
    await satelliteBtn.click();
    await expect(page.getByRole('button', { name: 'Mapa' })).toBeVisible();
    await page.getByRole('button', { name: 'Mapa' }).click();
    await expect(page.getByRole('button', { name: 'Satélite' })).toBeVisible();

    // 4. Center runner and zoom buttons are active and clickable
    await page.getByTitle('Acercar zoom').click();
    await page.getByTitle('Alejar zoom').click();
    const centerBtn = page.getByRole('button', { name: /Centrar Runner/i });
    await expect(centerBtn).toBeVisible();
    await centerBtn.click();

    // 5. Header runner silhouette SVG and PIN: 4829 are present
    await expect(page.locator('header svg').first()).toBeVisible();
    await expect(page.getByText('PIN: 4829')).toBeVisible();

    // 6. Layout height alignment between map and cheer wall in desktop
    const mapCard = page.locator('div:has(> div:has-text("Ruta GPS en Directo"))').first();
    const cheerCard = page.locator('div:has(> div:has-text("Muro de Ánimos"))').first();

    const mapBox = await mapCard.boundingBox();
    const cheerBox = await cheerCard.boundingBox();

    expect(mapBox).not.toBeNull();
    expect(cheerBox).not.toBeNull();

    if (mapBox && cheerBox) {
      const mapBottom = mapBox.y + mapBox.height;
      const cheerBottom = cheerBox.y + cheerBox.height;
      expect(Math.abs(mapBottom - cheerBottom)).toBeLessThanOrEqual(4);
    }
  });
});
