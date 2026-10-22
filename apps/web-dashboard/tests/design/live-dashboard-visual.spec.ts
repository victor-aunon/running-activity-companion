import { test, expect, type Page } from '@playwright/test';

async function verifyInteractiveControls(page: Page) {
  const shareBtn = page.getByRole('button', { name: /Compartir Enlace/i });
  await expect(shareBtn).toBeVisible();
  await shareBtn.click();
  await expect(page.getByText('¡Enlace Copiado!')).toBeVisible();

  const refreshBtn = page.getByTitle('Actualizar datos');
  await expect(refreshBtn).toBeVisible();
  await refreshBtn.click();

  const satelliteBtn = page.getByRole('button', { name: 'Satélite' });
  await expect(satelliteBtn).toBeVisible();
  await satelliteBtn.click();
  await expect(page.getByRole('button', { name: 'Mapa' })).toBeVisible();
  await page.getByRole('button', { name: 'Mapa' }).click();

  await page.getByTitle('Acercar zoom').click();
  await page.getByTitle('Alejar zoom').click();
  const centerBtn = page.getByRole('button', { name: /Centrar Runner/i });
  await expect(centerBtn).toBeVisible();
  await centerBtn.click();
}

async function verifyLayoutAndFallbacks(page: Page) {
  await expect(page.locator('header svg').first()).toBeVisible();
  await expect(page.getByText('PIN: 4829')).toBeVisible();

  const mapCard = page.locator('div:has(> div:has-text("Ruta GPS en Directo"))').first();
  const cheerCard = page.locator('div:has(> div:has-text("Muro de Ánimos"))').first();
  const mapBox = await mapCard.boundingBox();
  const cheerBox = await cheerCard.boundingBox();

  if (mapBox && cheerBox) {
    const mapBottom = mapBox.y + mapBox.height;
    const cheerBottom = cheerBox.y + cheerBox.height;
    expect(Math.abs(mapBottom - cheerBottom)).toBeLessThanOrEqual(4);
  }

  await page.goto('/session/unstarted-live-session');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('text=--:--').first()).toBeVisible();
  await expect(page.locator('text=0.00')).toBeVisible();
  await expect(page.locator('text=Aún no hay mensajes de ánimo')).toBeVisible();
  await expect(page.locator('text=PIN: ----')).toBeVisible();
}

test('Dashboard page matches Aurora Bento Box Light Mode specification', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1024 });
  await page.goto('/session/live-demo?mock=stitch');
  await page.waitForLoadState('networkidle');

  const bodyBg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
  expect(bodyBg).toBe('rgb(248, 250, 252)');

  const headerRadius = await page.evaluate(() => {
    const card = document.querySelector('header');
    return card ? window.getComputedStyle(card).borderRadius : null;
  });
  expect(headerRadius).toBe('16px');

  await expect(page).toHaveScreenshot('screen-live-dashboard.png', {
    scale: 'device',
    maxDiffPixelRatio: 0.05,
    animations: 'disabled',
  });

  await verifyInteractiveControls(page);
  await verifyLayoutAndFallbacks(page);
});
