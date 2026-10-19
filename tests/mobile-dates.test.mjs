import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { load } from './helpers/load-ts.mjs';

const require = createRequire(import.meta.url);
const dates = load('src/lib/dates.ts');
const jsx = require('react/jsx-runtime');

test('calendar dates reject impossible days and preserve leap days', () => {
  for (const date of ['2026-02-30', '2026-02-29', 'invalid', '2026-13-01', '20-01-01']) assert.equal(dates.isCalendarDate(date), false);
  assert.equal(dates.isCalendarDate('2028-02-29'), true);
  assert.equal(dates.addDaysToDateStr('2028-02-28', 1), '2028-02-29');
  assert.equal(dates.localDateStr(new Date('2026-10-19T22:30:00Z'), 'Africa/Johannesburg'), '2026-10-20');
  assert.equal(dates.localTimeStr(dates.zonedDateTime('2026-10-20', '00:17'), 'Africa/Johannesburg'), '00:17');
});

test('date picker opens from a tap and tolerates unsupported native pickers', () => {
  const { DateInput } = load('src/components/ui/DateTimeInputs.tsx', { react: require('react'), 'react/jsx-runtime': jsx });
  const input = DateInput({ name: 'date' });
  let opens = 0;
  input.props.onClick({ currentTarget: { showPicker: () => opens++ } });
  assert.equal(opens, 1);
  assert.doesNotThrow(() => input.props.onClick({ currentTarget: { showPicker: () => { throw Error('unsupported'); } } }));
  input.props.onClick({ defaultPrevented: true, currentTarget: { showPicker: () => opens++ } });
  assert.equal(opens, 1);
});

test('scrolling times preserve midnight, exact minutes, form values and reset', () => {
  let state, reset;
  const fakeForm = { addEventListener: (_, callback) => { reset = callback; }, removeEventListener() {} };
  const { TimeInput } = load('src/components/ui/DateTimeInputs.tsx', {
    'react/jsx-runtime': jsx,
    react: { useState: (initial) => { state ??= initial(); return [state, (next) => { state = next; }]; }, useRef: () => ({ current: { form: fakeForm } }), useEffect: (fn) => fn() },
  });
  const props = { label: 'Start', name: 'startTime', required: true };
  const render = () => TimeInput(props);
  let tree = render();
  const controls = () => tree.props.children[2].props.children;
  controls()[0].props.onChange({ target: { value: '00' } });
  tree = render();
  assert.equal(tree.props.children[1].props.value, '00:00');
  controls()[2].props.onChange({ target: { value: '17' } });
  tree = render();
  assert.equal(tree.props.children[1].props.value, '00:17');
  assert.equal(controls()[0].props.required, true);
  reset(); tree = render();
  assert.equal(tree.props.children[1].props.value, '');
  tree = TimeInput({ ...props, value: '23:59', disabled: true });
  assert.equal(tree.props.children[1].props.value, '23:59');
  assert.equal(tree.props.disabled, true);
});

function voiceAction({ failVisit = false } = {}) {
  const saved = [], pending = [];
  const tenant = { id: 'tenant-a' };
  const tx = Object.fromEntries(['client', 'serviceRequest', 'job', 'visit'].map((model) => [model, {
    findFirst: async ({ where }) => { assert.equal(where.tenantId, tenant.id); return null; },
    create: async ({ data }) => { if (model === 'visit' && failVisit) throw Error('visit failed'); pending.push([model, data]); return { id: `${model}-1`, ...data }; },
  }]));
  const { createVoiceRequestAction: action } = load('src/lib/requests/actions.ts', {
    'next/cache': { revalidatePath() {} }, 'next/navigation': { redirect: (path) => { throw Error(`redirect:${path}`); } },
    zod: require('zod'), '@/lib/auth/session': { requireRole: async () => ({ tenant }) },
    '@/lib/prisma': { prisma: { $transaction: async (fn) => { const result = await fn(tx); saved.push(...pending); return result; } } },
    '@/lib/db': { tenantDb: () => ({ membership: { count: async () => 1 }, serviceRequest: { create: async () => { throw Error('unexpected lead write'); } } }), nextDocumentNumber: async () => 'J-1' },
    '@/lib/clients/create': { createClient: async (db, business) => { assert.equal(db, tx); return db.client.create({ data: { tenantId: business.id } }); } },
    '@/lib/southAfrica': { normalizeSaPhone: (phone) => phone }, '@/lib/dates': dates,
    '@/lib/jobs/status': { syncJobStatus: async () => {} }, '@/lib/plans/plans': { canUse: () => true },
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({ contactName: 'Test', description: 'Wash the car', schedule: 'yes', visitDate: '2026-10-20', visitStartTime: '09:17', technicianIdsJson: '["00000000-0000-4000-8000-000000000001"]' })) form.set(key, value);
  return { action, form, saved };
}

test('incomplete and malformed voice bookings return errors before saving', async () => {
  for (const [key, value] of [['visitDate', ''], ['visitDate', '2026-02-30'], ['visitStartTime', '25:00'], ['technicianIdsJson', '"not-an-array"']]) {
    const { action, form, saved } = voiceAction(); form.set(key, value);
    assert.ok((await action(undefined, form)).error); assert.equal(saved.length, 0);
  }
});

test('voice booking writes customer, request, job and exact appointment together', async () => {
  const { action, form, saved } = voiceAction();
  await assert.rejects(action(undefined, form), /redirect:\/jobs\/job-1/);
  assert.deepEqual(saved.map(([model]) => model), ['client', 'serviceRequest', 'job', 'visit']);
  for (const [, data] of saved) assert.equal(data.tenantId, 'tenant-a');
  assert.equal(saved[3][1].startsAt.toISOString(), '2026-10-20T07:17:00.000Z');
});

test('failed voice booking does not commit an orphan customer or request', async () => {
  const { action, form, saved } = voiceAction({ failVisit: true });
  await assert.rejects(action(undefined, form), /visit failed/);
  assert.equal(saved.length, 0);
});

test('planner falls back from impossible dates and retains visits without an active team', async () => {
  const React = require('react');
  let query;
  const { default: Page } = load('src/app/(app)/schedule/page.tsx', {
    'react/jsx-runtime': jsx, 'next/link': require('next/link'),
    '@/lib/auth/session': { requireRole: async () => ({ tenant: { id: 'tenant-a', timezone: 'Africa/Johannesburg', industry: 'MOBILE_CAR_WASH' } }) },
    '@/lib/dates': { ...dates, todayDateStr: () => '2026-10-20' }, '@/lib/holidays': { publicHolidayName: () => null },
    '@/lib/jobs/recurring': { topUpRecurringVisits: async () => {} },
    '@/components/ui/DateTimeInputs': load('src/components/ui/DateTimeInputs.tsx', { react: React, 'react/jsx-runtime': jsx }),
    '@/lib/db': { tenantDb: () => ({ membership: { findMany: async () => [] }, visit: { findMany: async (args) => {
      query = args;
      return [{ id: 'visit-1', startsAt: dates.zonedDateTime('2026-10-20', '09:00'), endsAt: dates.zonedDateTime('2026-10-20', '10:00'), status: 'SCHEDULED', assignments: [{ membershipId: 'inactive-team-member' }], job: { id: 'job-1', number: 'J-1', title: 'Do not lose this wash', client: { firstName: 'Customer' } } }];
    } } }) },
  });
  const html = require('react-dom/server').renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ date: '2026-99-99' }) }));
  assert.equal(query.where.startsAt.gte.toISOString(), '2026-10-19T22:00:00.000Z');
  assert.match(html, /Needs assignment/);
  assert.match(html, /Do not lose this wash/);
  assert.match(html, /Go to date/);
});
