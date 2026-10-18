import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { load } from './helpers/load-ts.mjs';

const require = createRequire(import.meta.url);
const { NextRequest } = require('next/server');
// This installed Next build still exports the matcher helper under its former name.
const { unstable_doesMiddlewareMatch: doesProxyMatch } = require('next/experimental/testing/server');

const { proxy, config } = load('src/proxy.ts', { 'next/server': require('next/server') });
for (const path of ['/book/mobile-car-wash', '/book/mobile-car-wash/', '/q/test-token', '/i/test-token']) {
  test(`logged-out customers can reach ${path}`, () => {
    assert.equal(doesProxyMatch({ config, nextConfig: {}, url: path }), true);
    for (const method of ['GET', 'POST']) {
      const response = proxy(new NextRequest(`https://servicekasi.test${path}`, { method }));
      assert.equal(response.headers.get('location'), null);
      assert.equal(response.headers.get('x-middleware-next'), '1');
    }
  });
}
for (const path of ['/bookkeeping', '/bookkeeping/expenses/new', '/my-day', '/jobs', '/book-other', '/settings/access', '/switch-business']) {
  test(`logged-out visitors still cannot reach ${path}`, () => {
    const response = proxy(new NextRequest(`https://servicekasi.test${path}`));
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('location'), 'https://servicekasi.test/login');
  });
}

function fixture({ role = 'OWNER', doesFieldwork = true, assigned = true, foreignTenant = false, signedIn = true, active = true, paused = false, mfaPending = false, expired = false } = {}) {
  const tenant = { id: 'tenant-a' };
  const membership = { id: 'member-a', tenantId: tenant.id, role, doesFieldwork, active, tenant };
  const visit = {
    id: 'visit-a', jobId: 'job-a', tenantId: foreignTenant ? 'tenant-b' : tenant.id,
    status: 'SCHEDULED', assignments: [{ membershipId: assigned ? membership.id : 'member-b' }],
  };
  const writes = [], uploads = [], refreshed = [], attachments = [];
  const cookieStore = { get: () => signedIn ? { value: 'test-token' } : undefined, delete() {} };
  const rawVisit = {
    async findUnique({ where }) {
      // The real tenantDb extension below must supply this tenant constraint.
      assert.equal(where.tenantId, tenant.id);
      return where.id === visit.id && where.tenantId === visit.tenantId ? visit : null;
    },
    async update({ where, data }) {
      assert.equal(where.id, visit.id);
      writes.push(data);
      Object.assign(visit, data);
      return visit;
    },
  };
  const prisma = {
    session: {
      async findUnique() { return { userId: 'user-a', user: { id: 'user-a' }, activeTenantId: tenant.id, mfaPending, expiresAt: new Date(Date.now() + (expired ? -60000 : 60000)) }; },
      async deleteMany() {},
    },
    membership: { async findUnique() { return membership; } },
    visit: rawVisit,
    attachment: {
      async findUnique() { return null; },
      async create({ data }) { writes.push(data); attachments.push(data); return data; },
    },
    async $transaction(fn) { return fn(prisma); },
    $extends(extension) {
      return Object.fromEntries(['visit', 'attachment'].map((name) => [name,
        Object.fromEntries(Object.keys(prisma[name]).map((operation) => [operation, (args) =>
          extension.query.$allModels.$allOperations({
            model: name[0].toUpperCase() + name.slice(1), operation, args,
            query: (scopedArgs) => prisma[name][operation](scopedArgs),
          }),
        ])),
      ]));
    },
  };
  const auth = load('src/lib/auth/session.ts', {
    'server-only': {}, react: require('react'),
    'next/headers': { cookies: async () => cookieStore },
    'next/navigation': require('next/navigation'),
    '@/lib/prisma': { prisma },
    '@/lib/plans/people': { pausedMembershipIds: async () => new Set(paused ? [membership.id] : []) },
    './crypto': { sha256: (value) => value },
  });
  const db = load('src/lib/db.ts', { './prisma': { prisma } });
  const actions = load('src/lib/jobs/actions.ts', {
    'next/cache': { revalidatePath: (path) => refreshed.push(path) },
    'next/navigation': require('next/navigation'), zod: require('zod'),
    '@prisma/client': require('@prisma/client'),
    '@/lib/prisma': { prisma }, '@/lib/db': db, '@/lib/auth/session': auth,
    '@/lib/dates': {}, '@/lib/recurrence': {}, '@/lib/jobs/recurring': {},
    '@/lib/jobs/status': { syncJobStatus: async () => {} },
    '@/lib/storage': {
      async uploadPublicFile(tenantId, buffer, contentType) {
        uploads.push({ tenantId, buffer, contentType });
        return '/test-upload.jpg';
      },
    },
  });
  return { actions, visit, writes, uploads, refreshed, attachments };
}

function visitForm() {
  const data = new FormData();
  data.set('visitId', 'visit-a');
  data.set('notes', 'Full wash completed');
  data.set('signedByName', 'Test Customer');
  data.set('signatureDataUrl', 'data:image/png;base64,aGVsbG8=');
  data.set('kind', 'AFTER');
  data.set('clientGeneratedId', 'photo-test');
  data.set('photo', new Blob(['test photo'], { type: 'image/jpeg' }), 'wash.jpg');
  return data;
}

for (const role of ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN']) {
  test(`${role} fieldworker can progress an assigned visit, upload a photo and sign off`, async () => {
    const f = fixture({ role, doesFieldwork: role !== 'TECHNICIAN' });
    const data = visitForm();
    await f.actions.startTravelAction(data);
    assert.equal(f.visit.status, 'EN_ROUTE');
    await f.actions.arriveAction(data);
    assert.equal(f.visit.status, 'ON_SITE');
    assert.equal(await f.actions.addVisitPhotoAction(data), undefined);
    assert.equal(f.attachments.length, 1);
    assert.equal(f.attachments[0].uploadedByMembershipId, 'member-a');
    await f.actions.completeVisitAction(data);
    assert.equal(f.visit.status, 'COMPLETED');
    assert.equal(f.visit.completionNotes, 'Full wash completed');
    assert.equal(f.visit.signedByName, 'Test Customer');
    assert.equal(f.uploads.length, 2);
    assert.ok(f.uploads.every((upload) => upload.tenantId === 'tenant-a'));
    assert.equal(f.refreshed.filter((path) => path === '/my-day').length, 4);
  });
  test(`${role} fieldworker can record no access`, async () => {
    const f = fixture({ role, doesFieldwork: role !== 'TECHNICIAN' });
    await f.actions.markNoAccessAction(visitForm());
    assert.equal(f.visit.status, 'NO_ACCESS');
    assert.ok(f.refreshed.includes('/my-day'));
  });
}

const fieldActions = ['startTravelAction', 'arriveAction', 'completeVisitAction', 'addVisitPhotoAction', 'markNoAccessAction'];
for (const [label, options] of [
  ['owner without fieldwork', { doesFieldwork: false }],
  ['admin without fieldwork', { role: 'ADMIN', doesFieldwork: false }],
  ['dispatcher without fieldwork', { role: 'DISPATCHER', doesFieldwork: false }],
  ['logged-out visitor', { signedIn: false }],
  ['inactive member', { active: false }],
  ['paused member', { paused: true }],
  ['MFA-pending session', { mfaPending: true }],
  ['expired session', { expired: true }],
]) {
  test(`${label} cannot perform any field action`, async () => {
    const f = fixture(options);
    for (const action of fieldActions) {
      await assert.rejects(f.actions[action](visitForm()), /NEXT_REDIRECT/);
    }
    assert.equal(f.writes.length, 0);
    assert.equal(f.uploads.length, 0);
  });
}

for (const role of ['OWNER', 'TECHNICIAN']) {
  for (const [label, options] of [['unassigned visit', { assigned: false }], ['another tenant', { foreignTenant: true }]]) {
    test(`${role} cannot change a visit outside their assignment (${label})`, async () => {
      const f = fixture({ role, ...options });
      f.visit.status = 'ON_SITE';
      for (const action of fieldActions) await f.actions[action](visitForm());
      assert.equal(f.writes.length, 0);
      assert.equal(f.uploads.length, 0);
      assert.equal(f.refreshed.length, 0);
    });
  }
}

test('completed visits cannot be restarted and photos still require being on site', async () => {
  const f = fixture();
  f.visit.status = 'COMPLETED';
  for (const action of fieldActions) await f.actions[action](visitForm());
  assert.equal(f.writes.length, 0);
  assert.equal(f.uploads.length, 0);
});

test('public booking submits a request to the business selected by its slug without authentication', async () => {
  const created = [];
  const { submitServiceRequestAction } = load('src/lib/requests/publicActions.ts', {
    '@/lib/prisma': { prisma: {
      tenant: { findUnique: async ({ where }) => where.slug === 'mobile-car-wash' ? { id: 'wash-tenant' } : null },
      serviceRequest: { create: async ({ data }) => created.push(data) },
    } },
    '@/lib/southAfrica': load('src/lib/southAfrica.ts'),
  });
  const form = new FormData();
  form.set('slug', 'mobile-car-wash');
  form.set('contactName', 'Test Customer');
  form.set('contactPhone', '0821234567');
  form.set('description', 'Please wash my car at my office.');
  form.set('tenantId', 'attacker-selected-tenant');
  assert.deepEqual(await submitServiceRequestAction(undefined, form), { ok: true });
  assert.equal(created.length, 1);
  assert.equal(created[0].tenantId, 'wash-tenant');
  assert.equal(created[0].source, 'WEB_BOOKING');
  assert.equal(created[0].contactPhone, '+27821234567');
  form.set('slug', 'unknown-business');
  assert.ok((await submitServiceRequestAction(undefined, form)).error);
  assert.equal(created.length, 1);
});
