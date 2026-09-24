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
  const openMenuBtn = page.getByRole('button', { name: 'Abrir menú' });
  await expect(openMenuBtn).toBeVisible();
  await page.waitForTimeout(300);
  await openMenuBtn.click();
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
  // Servicio de 60 min y cierre a las 18: el último horario es 17:00.
  await expect(page.getByRole('button', { name: '17:00', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '17:30', exact: true })).toHaveCount(0);
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

test('horarios: borrador, validación y guardado', async ({ page }) => {
  await seed(page, true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/app/horarios');
  await page.getByLabel('Lunes: cierre', { exact: true }).fill('08:00');
  await page.getByRole('button', { name: 'Guardar horarios' }).click();
  await expect(page.getByRole('alert')).toContainText('posterior');
  // El borrador sobrevive a cambiar de sección.
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: 'Agenda', exact: true }).click();
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: 'Horarios', exact: true }).click();
  await expect(page.getByLabel('Lunes: cierre', { exact: true })).toHaveValue('08:00');
  await page.getByLabel('Lunes: cierre', { exact: true }).fill('17:00');
  await page.getByRole('button', { name: 'Guardar horarios' }).click();
  await expect(page.getByText('Sin cambios pendientes')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cupito_data_test-owner')!).settings.hours[1].to)).toBe('17:00');
  await page.screenshot({ path: 'artifacts/horarios-desktop.png', fullPage: true });
});

test('ajustes: seña requiere datos de cobro y persiste', async ({ page }) => {
  await seed(page, true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/app/ajustes/pagos');
  const toggle = page.getByRole('switch', { name: 'Activar seña' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await page.getByLabel('Alias de transferencia').fill('local.prueba');
  await page.getByLabel('Titular de la cuenta').fill('Ana Prueba');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('cupito_data_test-owner')!).settings);
  expect(settings.depositEnabled).toBe(true);
  expect(settings.transferAlias).toBe('local.prueba');
});

test('ajustes: reglas de reserva y color se guardan de verdad', async ({ page }) => {
  await seed(page, true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/app/ajustes/reservas');
  await page.getByRole('button', { name: '15′' }).click();
  await page.getByLabel('Tiempo entre turnos').selectOption('10');
  await page.goto('/#/app/ajustes/apariencia');
  await page.getByRole('button', { name: 'Color #6d28d9' }).click();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await page.reload();
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('cupito_data_test-owner')!).settings);
  expect(s.slotInterval).toBe(15);
  expect(s.bufferMinutes).toBe(10);
  expect(s.brandColor).toBe('#6d28d9');
  // Otro guardado no borra el color (antes normalizeData lo descartaba).
  await page.goto('/#/app/ajustes/reservas');
  await page.getByLabel('Anticipación máxima').selectOption('60');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cupito_data_test-owner')!).settings.brandColor)).toBe('#6d28d9');
});

test('buscador global: secciones, clientes y atajo de teclado', async ({ page }) => {
  await seed(page, true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/app');
  await page.getByRole('button', { name: 'Buscar clientes, turnos o secciones' }).click();
  await expect(page.getByRole('dialog', { name: 'Buscar en el panel' })).toBeVisible();
  await page.getByLabel('Buscar clientes, turnos o secciones').last().fill('horarios');
  await page.getByLabel('Buscar clientes, turnos o secciones').last().press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Horarios' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('panel mobile: resumen, barra inferior y sin desborde', async ({ page }) => {
  await seed(page, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/app');
  await expect(page.getByRole('region', { name: 'Resumen' })).toBeVisible();
  const newBtn = page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Nuevo turno' });
  await expect(newBtn).toBeVisible();
  const bg = await newBtn.locator('span').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  await page.getByRole('region', { name: 'Resumen' }).getByRole('button', { name: /Por confirmar/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Reservas');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/dashboard-mobile.png', fullPage: true });
});

test('turno: alta rápida, confirmación y reprogramación desde la ficha', async ({ page }) => {
  await seed(page, true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/app/agenda');
  await page.getByRole('button', { name: 'Nuevo turno' }).first().click();
  await page.getByLabel('Nombre del cliente').fill('Julia Paz');
  await page.getByLabel('Celular del cliente').fill('1133334444');
  // Con un solo servicio ya viene elegido.
  await expect(page.getByRole('button', { name: /Consulta de prueba/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('group', { name: 'Elegir día' }).getByRole('button').nth(1).click();
  await page.getByRole('button', { name: '10:00', exact: true }).click();
  await page.getByRole('button', { name: 'Crear turno' }).click();
  await expect(page.getByText(/Turno creado/)).toBeVisible();
  let bookings = await page.evaluate(() => JSON.parse(localStorage.getItem('cupito_data_test-owner')!).bookings);
  expect(bookings).toHaveLength(1);
  expect(bookings[0].time).toBe('10:00');
  // Ficha: reprogramar a las 11:00 del mismo día.
  await page.goto('/#/app/reservas');
  await page.getByRole('button', { name: /Julia Paz/ }).first().click();
  await page.getByRole('button', { name: 'Reprogramar' }).click();
  await page.getByRole('dialog').getByRole('checkbox').uncheck();
  await page.getByRole('dialog').getByRole('button', { name: '11:00', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar cambio' }).click();
  bookings = await page.evaluate(() => JSON.parse(localStorage.getItem('cupito_data_test-owner')!).bookings);
  expect(bookings[0].time).toBe('11:00');
  expect(bookings[0].events.map((e: { type: string }) => e.type)).toEqual(['creada', 'reprogramada']);
  await page.screenshot({ path: 'artifacts/booking-drawer.png' });
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
  await page.getByRole('button', { name: 'Mañana', exact: true }).click();
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

test('agenda: grilla del día con columnas por profesional y turnos ubicados', async ({ page }) => {
  await seed(page, true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/app');
  await page.evaluate(() => {
    const key = 'cupito_data_test-owner';
    const data = JSON.parse(localStorage.getItem(key)!);
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    data.professionals = [{ id: 'pro1', name: 'Lucas', role: 'Barbero', color: '#0ea5e9' }, { id: 'pro2', name: 'Feli', role: 'Barbera', color: '#f59e0b' }];
    data.bookings = [
      { id: 'b1', client: 'Mariano García', phone: '1198765432', serviceId: 'service', date: k, time: '10:00', status: 'confirmada', source: 'manual', proId: 'pro1' },
      { id: 'b2', client: 'Feli Cliente', phone: '1123456789', serviceId: 'service', date: k, time: '10:00', status: 'pendiente', source: 'online', proId: 'pro2' },
    ];
    localStorage.setItem(key, JSON.stringify(data));
    location.hash = `#/app/agenda?d=${k}`;
  });
  await page.reload();
  await expect(page.locator('.ag-head-cell', { hasText: 'Lucas' })).toBeVisible();
  await expect(page.locator('.ag-head-cell', { hasText: 'Feli' })).toBeVisible();
  const ev = page.getByRole('button', { name: /10:00 Mariano García/ });
  await expect(ev).toBeVisible();
  const box = await ev.boundingBox();
  expect(box!.height).toBeGreaterThan(55); // 60 minutos a 64px/h
  await page.screenshot({ path: 'artifacts/agenda-desktop.png' });
  // Arrastrar el turno 2 horas más tarde (128 px) a la columna de Feli.
  const feli = await page.locator('.ag-col').nth(1).boundingBox();
  await page.mouse.move(box!.x + 20, box!.y + 10);
  await page.mouse.down();
  await page.mouse.move(feli!.x + 30, box!.y + 60, { steps: 6 });
  await page.mouse.move(feli!.x + 30, box!.y + 10 + 128, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByText(/Mariano García: .* 12:00/)).toBeVisible();
  const moved = await page.evaluate(() => JSON.parse(localStorage.getItem('cupito_data_test-owner')!).bookings.find((b: { id: string }) => b.id === 'b1'));
  expect(moved.time).toBe('12:00');
  expect(moved.proId).toBe('pro2');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /12:00 Mariano García/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Mariano García');
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
  await page.evaluate(() => window.scrollTo({ top: 350, behavior: 'instant' }));
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

test('landing: botón ver demo en vivo navega a la demo y carga sin error', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Ver demo en vivo' }).click();
  await expect(page).toHaveURL(/#\/reservar\/studio-nails/);
  await expect(page.locator('h1')).toContainText(/Studio Nails/i);
  await expect(page.getByText('Este negocio todavía no tiene su página')).not.toBeVisible();
});

test('demo: /#/cupito-demo también resuelve a la demo de Studio Nails', async ({ page }) => {
  await page.goto('/#/cupito-demo');
  await expect(page.locator('h1')).toContainText(/Studio Nails/i);
  await expect(page.getByText('Este negocio todavía no tiene su página')).not.toBeVisible();
});

test('cursor: pointer presente en botones y controles interactivos', async ({ page }) => {
  await page.goto('/');
  const btnCursor = await page.getByRole('link', { name: 'Ver demo en vivo' }).evaluate((el) => getComputedStyle(el).cursor);
  expect(btnCursor).toBe('pointer');
});


