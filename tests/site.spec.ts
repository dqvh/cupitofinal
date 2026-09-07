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

test('reserva mobile: productos opcionales colapsados y fáciles de agregar', async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/prueba');
  await page.evaluate(() => {
    const key = 'cupito_data_test-owner';
    const data = JSON.parse(localStorage.getItem(key)!);
    data.products = [
      { id: 'p1', name: 'Aceite nutritivo', price: 2500, desc: 'Cuidado para después del servicio' },
      { id: 'p2', name: 'Pack de cuidado semanal', price: 4800, desc: 'Para mantener el resultado' },
      { id: 'p3', name: 'Gift card', price: 7000, desc: 'Un regalo simple' },
    ];
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.reload();
  await expect(page.locator('.large-logo img')).toHaveAttribute('alt', 'Logo de Cupito');
  await page.getByRole('button', { name: /Consulta de prueba/ }).click();
  await page.getByRole('button', { name: 'Elegir horario' }).click();
  await page.getByRole('button', { name: '09:00', exact: true }).click();

  const productsToggle = page.getByRole('button', { name: /¿Te llevás algo más\?/ });
  await expect(productsToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#booking-products-list')).toHaveCount(0);
  await productsToggle.click();
  await expect(productsToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#booking-products-list')).toBeVisible();
  await page.getByRole('button', { name: 'Agregar Aceite nutritivo' }).click();
  await expect(productsToggle).toContainText('1 · $2.500');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/booking-products-mobile.png', fullPage: true });
});

test('sidebar: pestañas activas tienen contraste blanco legible', async ({ page }) => {
  await seed(page, true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/app');
  await page.waitForTimeout(1000);

  const aside = page.locator('aside');
  await expect(aside).toBeVisible();

  // 1. Pestaña principal activa (Hoy)
  const hoyBtn = aside.getByRole('button', { name: 'Hoy', exact: true });
  await expect(hoyBtn).toHaveAttribute('aria-current', 'page');
  const hoyColor = await hoyBtn.evaluate(el => getComputedStyle(el).color);
  expect(hoyColor).toBe('rgb(255, 255, 255)');

  // 2. Pestaña del submenú Más (Equipo)
  const equipoBtn = aside.getByRole('button', { name: 'Equipo', exact: true });
  if (!(await equipoBtn.isVisible())) {
    await aside.getByRole('button', { name: 'Más', exact: true }).click();
  }
  await equipoBtn.click();
  await expect(equipoBtn).toHaveAttribute('aria-current', 'page');
  const equipoSpanColor = await equipoBtn.locator('span').first().evaluate(el => getComputedStyle(el).color);
  expect(equipoSpanColor).toBe('rgb(255, 255, 255)');
});

test('dashboard: botón nuevo turno en cabecera tiene alto contraste y no es blanco', async ({ page }) => {
  await seed(page, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/app');
  await page.waitForTimeout(800);

  const welcomeBanner = page.locator('.welcome');
  await expect(welcomeBanner).toBeVisible();
  const nuevoTurnoBtn = welcomeBanner.getByRole('button', { name: 'Nuevo turno' });
  await expect(nuevoTurnoBtn).toBeVisible();

  const btnStyle = await nuevoTurnoBtn.evaluate(el => {
    const cs = getComputedStyle(el);
    return {
      color: cs.color,
      backgroundColor: cs.backgroundColor,
    };
  });

  // El texto debe ser blanco
  expect(btnStyle.color).toBe('rgb(255, 255, 255)');
  // El fondo NO debe ser blanco ni transparente
  expect(btnStyle.backgroundColor).not.toBe('rgb(255, 255, 255)');
  expect(btnStyle.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(btnStyle.backgroundColor).toContain('36, 84, 66');

  await page.screenshot({ path: 'artifacts/dashboard-welcome-mobile.png' });
});

test('dashboard: turnos en mobile tienen estructura limpia y barra de acciones separada', async ({ page }) => {
  await seed(page, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/app');
  await page.evaluate(() => {
    const session = localStorage.getItem('cupito_session') || 'test-owner';
    const key = `cupito_data_${session}`;
    const raw = localStorage.getItem(key);
    const data = raw ? JSON.parse(raw) : {};
    const today = new Date().toISOString().split('T')[0];
    data.professionals = [
      { id: 'pro1', name: 'Lucas', color: '#0284c7' },
      { id: 'pro2', name: 'Feli', color: '#16a34a' },
    ];
    data.services = [
      { id: 's1', name: 'Corte Tradicional / Fade', price: 9500, duration: 35 },
    ];
    data.products = [
      { id: 'p1', name: 'Cera Mate', price: 3500 },
      { id: 'p2', name: 'Shampoo', price: 4200 },
    ];
    data.bookings = [
      {
        id: 'b-test-1',
        client: 'Feli',
        phone: '1123456789',
        serviceId: 's1',
        date: today,
        time: '10:15',
        status: 'pendiente',
        proId: 'pro2',
        items: [{ productId: 'p1', qty: 1 }, { productId: 'p2', qty: 1 }],
      },
      {
        id: 'b-test-2',
        client: 'Mariano García',
        phone: '1198765432',
        serviceId: 's1',
        date: today,
        time: '11:00',
        status: 'confirmada',
        proId: 'pro1',
      },
    ];
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.reload();
  await page.waitForTimeout(800);

  const bookingRows = page.locator('.workspace-content .space-y-3 > div');
  await expect(bookingRows).toHaveCount(2);

  const firstRow = bookingRows.first();
  await expect(firstRow).toBeVisible();
  await expect(firstRow.getByText('10:15')).toBeVisible();
  await expect(firstRow.getByText('Feli').first()).toBeVisible();
  await expect(firstRow.getByText('Pendiente')).toBeVisible();
  await expect(firstRow.getByText('Corte Tradicional / Fade')).toBeVisible();
  await expect(firstRow.getByText('+2 prod.')).toBeVisible();
  await expect(firstRow.getByRole('button', { name: /Confirmar/i })).toBeVisible();
  await expect(firstRow.getByRole('link', { name: /WhatsApp/i })).toBeVisible();
  await expect(firstRow.getByRole('button', { name: /Detalles/i })).toBeVisible();

  await firstRow.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/dashboard-turnos-mobile.png' });
});

test('reserva: upscroll suave al cambiar de paso', async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/prueba');
  await page.evaluate(() => {
    const key = 'cupito_data_test-owner';
    const data = JSON.parse(localStorage.getItem(key)!);
    data.services = [
      { id: 's1', name: 'Corte Tradicional', price: 9000, duration: 30 },
      { id: 's2', name: 'Corte + Barba', price: 13000, duration: 45 },
      { id: 's3', name: 'Perfilado de Cejas', price: 4000, duration: 15 },
      { id: 's4', name: 'Coloración y Reflejos', price: 22000, duration: 90 },
      { id: 's5', name: 'Tratamiento Capilar', price: 15000, duration: 60 },
    ];
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.reload();
  await page.waitForTimeout(600);

  // Scrollear hacia abajo en la lista de servicios
  await page.evaluate(() => window.scrollTo(0, 350));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);

  // Seleccionar servicio al final y avanzar a paso 1
  await page.getByRole('button', { name: /Tratamiento Capilar/ }).click();
  await page.getByRole('button', { name: 'Elegir horario' }).click();

  // Esperar el scroll suave al inicio
  await page.waitForTimeout(600);
  const scrollYAfterStep1 = await page.evaluate(() => window.scrollY);
  expect(scrollYAfterStep1).toBeLessThan(100);

  await page.screenshot({ path: 'artifacts/booking-step1-upscroll.png' });
});


