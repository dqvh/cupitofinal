import { test, expect } from '@playwright/test';

async function seed(page: import('@playwright/test').Page, authenticated = false) {
  await page.addInitScript(({ authenticated }) => {
    if (localStorage.getItem('cupito_data_test-owner')) return;
    const user = { id: 'test-owner', name: 'Ana', business: 'Local de prueba', email: 'qa@example.test', password: '', slug: 'prueba', plan: 'crece', createdAt: Date.now() };
    const data = { services: [{ id: 'service', name: 'Consulta de prueba', duration: 60, price: 1000 }], bookings: [], products: [], professionals: [], reviews: [], waitlist: [], coupons: [], settings: { setupDismissed: true, hours: Array(7).fill({ open: true, from: '09:00', to: '18:00' }), depositEnabled: false, depositPct: 20, maxAdvanceDays: 30 } };
    localStorage.setItem('cupito_users', JSON.stringify([user]));
    localStorage.setItem('cupito_data_test-owner', JSON.stringify(data));
    if (authenticated) localStorage.setItem('cupito_session', user.id);
  }, { authenticated });
}

test('portada mobile: HTML visible sin JavaScript', async ({ browser }) => {
  const page = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.lp-price-card').nth(1)).toContainText('9.500');
  expect(await page.locator('h1').evaluate(el => getComputedStyle(el).opacity)).toBe('1');
  await page.close();
});

test('hidratación, menú mobile, planes y rutas secundarias', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await expect(page.getByRole('button', { name: 'Cerrar menú' })).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.lp-price-card').nth(0)).toContainText('25 reservas');
  await expect(page.locator('.lp-price-card').nth(2)).toContainText('22.000');
  expect(requests.some(url => /\/assets\/(store-|Dashboard-)|fonts\.google/.test(url))).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/landing-mobile.png', fullPage: true });
  await page.locator('.lp-price-card').nth(1).getByRole('link').click();
  await expect(page).toHaveURL(/registro\?plan=crece/);
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await page.goto('/login');
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  await page.screenshot({ path: 'artifacts/landing-desktop.png' });
  expect(errors).toEqual([]);
});

test('reserva completa: horario, contacto y notas persistidas', async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/prueba');
  await page.getByRole('button', { name: /Consulta de prueba/ }).click();
  await page.getByRole('button', { name: 'Elegir horario' }).click();
  await page.getByRole('button', { name: 'Mañana', exact: true }).click();
  await expect(page.getByRole('button', { name: '17:15', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '09:00', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('Nombre y apellido').fill('Cliente de prueba');
  await page.getByLabel('Teléfono celular').fill('1123456789');
  await page.getByLabel('Aclaraciones o notas').fill('Necesito acceso sin escaleras.');
  await page.getByRole('button', { name: 'Confirmar mi turno' }).click();
  await expect(page.getByText('¡Tu turno está confirmado!')).toBeVisible();
  const bookings = await page.evaluate(() => JSON.parse(localStorage.getItem('cupito_data_test-owner')!).bookings);
  expect(bookings).toHaveLength(1);
  expect(bookings[0].notes).toBe('Necesito acceso sin escaleras.');
  await page.screenshot({ path: 'artifacts/booking-mobile.png', fullPage: true });
});

test('ajustes: borrador de horarios, validación, guardado y seña', async ({ page }) => {
  await seed(page, true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/app');
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  await page.getByRole('button', { name: 'Horarios', exact: true }).click();
  await page.getByLabel('Lunes: cierre', { exact: true }).fill('08:00');
  await page.getByRole('button', { name: 'Guardar horarios' }).click();
  await expect(page.getByRole('alert')).toContainText('posterior');
  await page.getByRole('button', { name: 'Pagos y seña', exact: true }).click();
  await page.getByRole('button', { name: 'Horarios', exact: true }).click();
  await expect(page.getByLabel('Lunes: cierre', { exact: true })).toHaveValue('08:00');
  await page.getByLabel('Lunes: cierre', { exact: true }).fill('17:00');
  await page.getByRole('button', { name: 'Guardar horarios' }).click();
  await expect(page.getByText('Sin cambios pendientes')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cupito_data_test-owner')!).settings.hours[1].to)).toBe('17:00');
  await page.screenshot({ path: 'artifacts/settings-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Pagos y seña', exact: true }).click();
  await page.getByRole('button', { name: 'Activar seña', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Activar seña', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByLabel('Alias de transferencia').fill('local.prueba');
  await page.getByLabel('Titular de la cuenta').fill('Ana Prueba');
  await page.getByRole('button', { name: 'Activar seña', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Activar seña', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('búsqueda rápida abre horarios con teclado y restaura el foco', async ({ page }) => {
  await seed(page, true);
  await page.goto('/#/app');
  await expect(page.getByRole('region', { name: 'Acciones pendientes' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/dashboard-desktop.png' });
  await page.getByRole('button', { name: 'Buscar acciones' }).click();
  await expect(page.getByRole('dialog', { name: 'Buscar en el panel' })).toBeVisible();
  await page.getByLabel('Buscar sección o acción').fill('horarios');
  await page.getByLabel('Buscar sección o acción').press('Enter');
  await expect(page.getByRole('heading', { name: 'Días y horarios de atención' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('panel mobile muestra acciones cotidianas sin desbordar', async ({ page }) => {
  await seed(page, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/app');
  await expect(page.getByRole('region', { name: 'Acciones pendientes' })).toBeVisible();
  await page.screenshot({ path: "artifacts/dashboard-overview-mobile.png", fullPage: true });
  await page.getByRole('button', { name: 'Turnos por confirmar' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/reservas/i);
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/dashboard-mobile.png', fullPage: true });
});
