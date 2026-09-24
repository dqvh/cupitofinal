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

import { checkSlot, slotsFor, nextFreeDay } from '../src/lib/availability';

test('disponibilidad: duración combinada, pausa entre turnos, bloqueos y horario especial', () => {
  const date = '2030-06-10'; // lunes
  const biz = {
    settings: { hours: Array(7).fill({ open: true, from: '09:00', to: '13:00' }), bufferMinutes: 15, slotInterval: 30, specialHours: { '2030-06-11': { open: true, from: '15:00', to: '17:00' } } as Record<string, { open: boolean; from: string; to: string }> },
    services: [{ id: 'a', duration: 30 }, { id: 'b', duration: 60 }],
    professionals: [] as { id: string }[],
    bookings: [{ id: 'x', date, time: '10:00', status: 'confirmada', serviceId: 'b' }],
    blockedSlots: [{ date, time: '12:00', endTime: '12:30' }],
  };
  // 10:00-11:00 ocupado + 15 min de pausa: 11:00 no, 11:30 sí.
  expect(checkSlot(biz, { date, time: '11:00', serviceIds: ['a'] }).ok).toBe(false);
  expect(checkSlot(biz, { date, time: '11:30', serviceIds: ['a'] }).ok).toBe(true);
  // Servicios combinados (90 min) desde 11:30 pisan el bloqueo de las 12:00.
  const combo = checkSlot(biz, { date, time: '11:30', serviceIds: ['a', 'b'] });
  expect(combo.ok).toBe(false);
  // Horario especial del martes: 15 a 17.
  const special = slotsFor(biz, { date: '2030-06-11', serviceIds: ['b'] });
  expect(special.map((x) => x.time)).toEqual(['15:00', '15:30', '16:00']);
  // Feriado cargado: cerrado.
  const closed = { ...biz, settings: { ...biz.settings, closedDates: ['2030-06-12'] } };
  expect(checkSlot(closed, { date: '2030-06-12', time: '10:00', serviceIds: ['a'] }).ok).toBe(false);
  expect(nextFreeDay(closed, { from: '2030-06-12', serviceIds: ['a'] })?.date).toBe('2030-06-13');
});

test('disponibilidad: con equipo asigna al profesional libre y respeta su horario', () => {
  const date = '2030-06-10';
  const biz = {
    settings: { hours: Array(7).fill({ open: true, from: '09:00', to: '18:00' }), slotInterval: 30 },
    services: [{ id: 's', duration: 60 }],
    professionals: [
      { id: 'p1', hours: Array(7).fill({ open: true, from: '09:00', to: '12:00' }) },
      { id: 'p2' },
    ],
    bookings: [{ id: 'x', date, time: '10:00', status: 'confirmada', serviceId: 's', proId: 'p2' }],
  };
  const r = checkSlot(biz, { date, time: '10:00', serviceIds: ['s'] });
  expect(r.ok && r.proId).toBe('p1');
  expect(checkSlot(biz, { date, time: '14:00', serviceIds: ['s'], proId: 'p1' }).ok).toBe(false);
  expect(checkSlot(biz, { date, time: '14:00', serviceIds: ['s'] }).ok && true).toBe(true);
});

test('servidor: el cliente puede reprogramar su turno validando teléfono y disponibilidad', async () => {
  const originalFetch = globalThis.fetch;
  process.env.SUPABASE_URL = 'https://example.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture';
  const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const data = {
    services: [{ id: 's', price: 1000, duration: 60 }],
    professionals: [],
    bookings: [
      { id: 'b1', client: 'Ana', phone: '1123456789', serviceId: 's', date: day(3), time: '10:00', status: 'confirmada' },
      { id: 'b2', client: 'Otro', phone: '1199999999', serviceId: 's', date: day(4), time: '11:00', status: 'confirmada' },
    ],
    settings: { hours: Array(7).fill({ open: true, from: '09:00', to: '18:00' }), maxAdvanceDays: 30 },
  };
  let saved: any;
  globalThis.fetch = async (url, init) => {
    if (init?.method === 'PATCH') { saved = JSON.parse(String(init.body)); return Response.json({}); }
    return Response.json(String(url).includes('cupito_users') ? [{ id: 'owner', plan: 'crece' }] : [{ data }]);
  };
  const call = (body: object) => publicApi(new Request('http://localhost/api/public', { method: 'POST', body: JSON.stringify({ action: 'reschedule', ownerId: 'owner', bookingId: 'b1', ...body }) }));
  try {
    expect((await call({ date: day(4), time: '11:00', phone: '1123456789' })).status).toBe(409);
    expect((await call({ date: day(4), time: '15:00', phone: '1100000000' })).status).toBe(403);
    const ok = await call({ date: day(4), time: '15:00', phone: '11 2345-6789' });
    expect(ok.status).toBe(200);
    const moved = saved.data.bookings.find((b: any) => b.id === 'b1');
    expect(moved.date).toBe(day(4));
    expect(moved.time).toBe('15:00');
    expect(moved.events[0].type).toBe('reprogramada');
    const res = await ok.json();
    expect(JSON.stringify(res.data)).not.toContain('Otro');
  } finally { globalThis.fetch = originalFetch; delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; }
});
