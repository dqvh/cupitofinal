import { test, expect } from '@playwright/test';
import { fitsWorkingDay, validateHours, validateTransfer } from '../src/lib/scheduling';
import { checkoutAmount, PLAN_AMOUNTS } from '../src/lib/plans';
import subscription from '../api/create-subscription';
import publicApi from '../api/public';

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
