import { test, expect } from '@playwright/test';
import { fitsWorkingDay, validateHours, validateTransfer } from '../src/lib/scheduling';
import { checkoutAmount, PLAN_AMOUNTS } from '../src/lib/plans';
import subscription from '../api/create-subscription';
import publicApi from '../api/public';
import accountApi from '../api/account';

const day = { open: true, from: '09:00', to: '13:00', from2: '15:00', to2: '20:00' };
test('el servicio completo debe caber antes del cierre o del descanso', () => {
  expect(fitsWorkingDay(day, '12:00', 60)).toBe(true);
  expect(fitsWorkingDay(day, '12:30', 60)).toBe(false);
  expect(fitsWorkingDay(day, '14:00', 30)).toBe(false);
  expect(fitsWorkingDay(day, '19:30', 30)).toBe(true);
  expect(fitsWorkingDay(day, '19:30', 60)).toBe(false);
  expect(fitsWorkingDay({ ...day, open: false }, '10:00', 30)).toBe(false);
});
test('horarios y cuenta receptora se validan antes de guardar', () => {
  expect(validateHours(Array(7).fill(day))).toBeNull();
  expect(validateHours(Array(7).fill({ ...day, from2: '12:00' }))).toBeTruthy();
  expect(validateHours(Array(7).fill({ ...day, from: '21:00' }))).toBeTruthy();
  expect(validateTransfer('', '', 'Titular')).toBeTruthy();
  expect(validateTransfer('mi.alias', '123', 'Titular')).toBeTruthy();
  expect(validateTransfer('mi.alias', '', '')).toBeTruthy();
  expect(validateTransfer('mi.alias', '', 'Titular')).toBeNull();
});
test('el cobro anual coincide con los doce meses anunciados', async () => {
  const originalFetch = globalThis.fetch;
  process.env.MP_ACCESS_TOKEN = 'TEST-fixture';
  let payload: any;
  globalThis.fetch = async (_url, init) => {
    payload = JSON.parse(String(init?.body));
    return Response.json({ init_point: 'https://example.test/checkout' });
  };
  try {
    for (const plan of ['crece', 'escala'] as const) {
      const response = await subscription(new Request('http://localhost/api/create-subscription', { method: 'POST', body: JSON.stringify({ plan, billing: 'anual' }) }));
      expect(response.status).toBe(200);
      expect(payload.auto_recurring.transaction_amount).toBe(PLAN_AMOUNTS[plan].anual * 12);
      expect(payload.auto_recurring.transaction_amount).toBe(checkoutAmount(plan, 'anual'));
      expect(payload.auto_recurring.frequency).toBe(12);
    }
  } finally { globalThis.fetch = originalFetch; delete process.env.MP_ACCESS_TOKEN; }
});
test('servidor rechaza horarios fuera de atención y no acepta señas autoaprobadas', async () => {
  const originalFetch = globalThis.fetch;
  process.env.SUPABASE_URL = 'https://example.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture';
  const data = { services: [{ id: 's', price: 1000, duration: 60 }], professionals: [], bookings: [], settings: { hours: Array(7).fill(day), maxAdvanceDays: 30, depositEnabled: true, depositPct: 30 } };
  let saved: any;
  globalThis.fetch = async (url, init) => {
    if (init?.method === 'PATCH') { saved = JSON.parse(String(init.body)); return Response.json({}); }
    return Response.json(String(url).includes('cupito_users') ? [{ id: 'owner', plan: 'crece' }] : [{ data }]);
  };
  const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const book = (time: string) => publicApi(new Request('http://localhost/api/public', { method: 'POST', body: JSON.stringify({ action: 'book', ownerId: 'owner', booking: { client: 'Prueba', phone: '1123456789', serviceId: 's', date, time, paidDeposit: true, status: 'confirmada' } }) }));
  try {
    expect((await book('12:30')).status).toBe(400);
    expect(saved).toBeUndefined();
    expect((await book('15:00')).status).toBe(200);
    expect(saved.data.bookings[0].paidDeposit).toBe(false);
    expect(saved.data.bookings[0].status).toBe('pendiente');
  } finally { globalThis.fetch = originalFetch; delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; }
});

test('registro tolera ausencia de columna recovery en cupito_users (PGRST204) y entrega sesión', async () => {
  const originalFetch = globalThis.fetch;
  process.env.SUPABASE_URL = 'https://example.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture';

  let postgrestPayload: any = null;
  let authPayload: any = null;
  let pgrstCallCount = 0;

  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('/auth/v1/admin/users')) {
      if (init?.method === 'POST') {
        authPayload = JSON.parse(String(init.body));
        return Response.json({ id: 'user-123', email: authPayload.email });
      }
    }
    if (u.includes('/rest/v1/cupito_users')) {
      if (init?.method === 'POST') {
        pgrstCallCount++;
        postgrestPayload = JSON.parse(String(init.body));
        // Primera llamada: simular error PGRST204 de Supabase si viene 'recovery'
        if ('recovery' in postgrestPayload) {
          return new Response(
            JSON.stringify({
              code: 'PGRST204',
              details: null,
              hint: null,
              message: "Could not find the 'recovery' column of 'cupito_users' in the schema cache",
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return Response.json([{ ...postgrestPayload }]);
      }
      return Response.json([]);
    }
    if (u.includes('/rest/v1/cupito_data')) {
      return Response.json({});
    }
    if (u.includes('/auth/v1/token?grant_type=password')) {
      return Response.json({ access_token: 'fake-jwt', refresh_token: 'fake-ref', expires_in: 3600, user: { id: 'user-123' } });
    }
    return Response.json([]);
  };

  try {
    const res = await accountApi(
      new Request('http://localhost/api/account', {
        method: 'POST',
        body: JSON.stringify({
          action: 'register',
          name: 'Felipe',
          business: 'Barbería Test',
          email: 'felipe@test.com',
          password: 'password123',
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.recovery).toBeTruthy();
    expect(body.session?.access_token).toBe('fake-jwt');
    // Verificamos que se reintentó quitando la columna faltante
    expect(pgrstCallCount).toBe(2);
    expect('recovery' in postgrestPayload).toBe(false);
    // Verificamos que user_metadata en Supabase Auth sí guardó recovery y nombre
    expect(authPayload.user_metadata.recovery).toBe(body.recovery);
    expect(authPayload.user_metadata.business).toBe('Barbería Test');
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
});

test('recuperación de contraseña funciona aun si cupito_users no tiene recovery (usando Auth metadata)', async () => {
  const originalFetch = globalThis.fetch;
  process.env.SUPABASE_URL = 'https://example.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture';

  const recoveryKey = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
  let updatedAuth: any = null;

  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('/rest/v1/cupito_users') && !init?.method) {
      // Fila sin recovery (simula base sin migrar)
      return Response.json([{ id: 'user-123', auth_id: 'user-123', email: 'felipe@test.com', deleted: false }]);
    }
    if (u.includes('/auth/v1/admin/users/user-123')) {
      if (init?.method === 'PUT') {
        updatedAuth = JSON.parse(String(init.body));
        return Response.json({ id: 'user-123' });
      }
      return Response.json({ id: 'user-123', user_metadata: { recovery: recoveryKey } });
    }
    if (u.includes('/rest/v1/cupito_data')) {
      return Response.json([]);
    }
    if (u.includes('/rest/v1/cupito_users') && init?.method === 'PATCH') {
      return Response.json({});
    }
    return Response.json([]);
  };

  try {
    const res = await accountApi(
      new Request('http://localhost/api/account', {
        method: 'POST',
        body: JSON.stringify({
          action: 'recover',
          email: 'felipe@test.com',
          recovery: recoveryKey,
          password: 'newpassword123',
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(updatedAuth.password).toBe('newpassword123');
    expect(updatedAuth.user_metadata.recovery).toBeTruthy();
    expect(updatedAuth.user_metadata.recovery).not.toBe(recoveryKey); // rotada
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
});
