import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { load } from './helpers/load-ts.mjs';

const require = createRequire(import.meta.url);
const redirect = (path) => { throw new Error(`REDIRECT:${path}`); };
const plans = load('src/lib/plans/plans.ts');

function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'tenantId_userId') return matches(row, value);
    if (value && typeof value === 'object' && 'gt' in value) return row[key] > value.gt;
    return row[key] === value;
  });
}

function fixture() {
  let state = {
    users: [
      { id: 'owner', name: 'Owner', email: 'owner@example.test', passwordHash: 'hash' },
      { id: 'helper', name: 'Helper', email: 'helper@example.test', passwordHash: 'hash' },
      { id: 'stranger', name: 'Stranger', email: 'stranger@example.test', passwordHash: 'hash' },
    ],
    tenants: ['a', 'b', 'c'].map((id) => ({ id, plan: 'TEAM', subscriptionStatus: 'ACTIVE', trialEndsAt: null })),
    memberships: [
      { id: 'owner-a', tenantId: 'a', userId: 'owner', role: 'OWNER', active: true, createdAt: new Date(1) },
      { id: 'helper-b', tenantId: 'b', userId: 'helper', role: 'OWNER', active: true, createdAt: new Date(2) },
      { id: 'stranger-c', tenantId: 'c', userId: 'stranger', role: 'OWNER', active: true, createdAt: new Date(3) },
    ],
    sessions: ['owner', 'helper', 'stranger'].map((userId, i) => ({
      id: `${userId}-session`, tokenHash: userId, userId, activeTenantId: ['a', 'b', 'c'][i], mfaPending: false,
      expiresAt: new Date(Date.now() + 600000),
    })),
    audits: [],
  };
  let cookie = 'owner';
  let failAudit = false;
  const refreshed = [];
  const withRelations = (m) => m ? { ...m, tenant: state.tenants.find((t) => t.id === m.tenantId), user: state.users.find((u) => u.id === m.userId) } : null;
  const prisma = {
    user: { async findUnique({ where }) { return state.users.find((u) => matches(u, where)) ?? null; } },
    tenant: { async findUniqueOrThrow({ where }) { return state.tenants.find((t) => matches(t, where)); } },
    membership: {
      async findUnique({ where }) { return withRelations(state.memberships.find((m) => matches(m, where))); },
      async findFirst({ where }) { return withRelations(state.memberships.find((m) => matches(m, where))); },
      async findMany({ where }) { return state.memberships.filter((m) => matches(m, where)).sort((a, b) => a.createdAt - b.createdAt).map(withRelations); },
      async count({ where }) { return state.memberships.filter((m) => matches(m, where)).length; },
      async create({ data }) {
        const m = { ...data, id: `member-${state.memberships.length}`, active: true, doesFieldwork: false, createdAt: new Date() };
        state.memberships.push(m); return m;
      },
      async update({ where, data }) {
        const m = state.memberships.find((m) => matches(m, where)); assert.ok(m); Object.assign(m, data); return m;
      },
    },
    session: {
      async findUnique({ where }) {
        const s = state.sessions.find((s) => matches(s, where));
        return s ? { ...s, user: state.users.find((u) => u.id === s.userId) } : null;
      },
      async updateMany({ where, data }) {
        const sessions = state.sessions.filter((s) => matches(s, where));
        sessions.forEach((s) => Object.assign(s, data)); return { count: sessions.length };
      },
      async deleteMany({ where }) { state.sessions = state.sessions.filter((s) => !matches(s, where)); },
    },
    auditLog: { async create({ data }) { if (failAudit) throw new Error('Database unavailable'); state.audits.push(data); } },
    async $transaction(fn, options) {
      assert.equal(options.isolationLevel, 'Serializable');
      const snapshot = structuredClone(state);
      try { return await fn(prisma); } catch (error) { state = snapshot; throw error; }
    },
  };
  const people = load('src/lib/plans/people.ts', { 'server-only': {}, '@/lib/prisma': { prisma }, './plans': plans });
  const auth = load('src/lib/auth/session.ts', {
    'server-only': {}, react: require('react'), 'next/navigation': { redirect },
    'next/headers': { cookies: async () => ({ get: () => cookie ? { value: cookie } : undefined, delete() { cookie = null; } }) },
    '@/lib/prisma': { prisma }, '@/lib/plans/people': people, './crypto': { sha256: (v) => v },
  });
  const actions = load('src/lib/auth/businessAccess.ts', {
    'next/cache': { revalidatePath: (...args) => refreshed.push(args) }, 'next/navigation': { redirect }, zod: require('zod'),
    '@/lib/prisma': { prisma }, '@/lib/auth/session': auth, '@/lib/plans/plans': plans, '@/lib/plans/people': people,
  });
  return { actions, auth, refreshed, get state() { return state; },
    signInAs(userId) { cookie = userId; }, failAudit() { failAudit = true; } };
}

function form(values) { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; }
const grantForm = () => form({ email: '  HELPER@example.test ', acknowledge: 'on', tenantId: 'c', role: 'OWNER' });

test('owner grants scoped ADMIN access, helper switches with own login, owner revokes all helper sessions in that business', async () => {
  const f = fixture();
  assert.ok((await f.actions.grantBusinessAccessAction(undefined, grantForm())).ok);
  const member = f.state.memberships.find((m) => m.tenantId === 'a' && m.userId === 'helper');
  assert.equal(member.role, 'ADMIN');
  assert.equal(f.state.audits[0].tenantId, 'a');
  assert.equal(f.state.audits[0].userId, 'owner');
  f.signInAs('helper');
  await assert.rejects(f.actions.switchBusinessAction(undefined, form({ tenantId: 'a', userId: 'owner' })), /REDIRECT:\/$/);
  assert.equal((await f.auth.requireAuth()).tenant.id, 'a');
  assert.equal((await f.auth.requireRole(['ADMIN'])).user.id, 'helper');
  assert.ok(f.refreshed.some(([path, type]) => path === '/' && type === 'layout'));
  f.state.sessions.push({ ...f.state.sessions[1], id: 'helper-second-device' });
  f.state.sessions.push({ ...f.state.sessions[1], id: 'helper-other-business', activeTenantId: 'b' });
  f.signInAs('owner');
  assert.ok((await f.actions.revokeBusinessAccessAction(undefined, form({ membershipId: member.id, tenantId: 'c' }))).ok);
  assert.equal(member.active, false);
  assert.equal(f.state.sessions.find((s) => s.id === 'helper-session').activeTenantId, null);
  assert.equal(f.state.sessions.find((s) => s.id === 'helper-second-device').activeTenantId, null);
  assert.equal(f.state.sessions.find((s) => s.id === 'helper-other-business').activeTenantId, 'b');
  assert.equal(f.state.audits[1].action, 'access.revoked');
  f.signInAs('helper');
  await assert.rejects(f.auth.requireAuth(), /REDIRECT:\/switch-business/);
  assert.ok((await f.actions.switchBusinessAction(undefined, form({ tenantId: 'a' }))).error);
  await assert.rejects(f.actions.switchBusinessAction(undefined, form({ tenantId: 'b' })), /REDIRECT:\/$/);
  assert.equal((await f.auth.requireAuth()).tenant.id, 'b');
});

for (const role of ['ADMIN', 'DISPATCHER', 'TECHNICIAN']) {
  test(`${role} cannot grant or revoke access, including by forging form fields`, async () => {
    const f = fixture(); f.state.memberships[0].role = role;
    await assert.rejects(f.actions.grantBusinessAccessAction(undefined, grantForm()), /REDIRECT:\/$/);
    await assert.rejects(f.actions.revokeBusinessAccessAction(undefined, form({ membershipId: 'helper-b' })), /REDIRECT:\/$/);
    assert.equal(f.state.audits.length, 0); assert.equal(f.state.memberships.length, 3);
  });
}

for (const condition of ['signed-out', 'expired', 'mfa-pending', 'inactive', 'missing-membership']) {
  test(`${condition} owner cannot mutate helper access`, async () => {
    const f = fixture();
    if (condition === 'signed-out') f.signInAs(null);
    if (condition === 'expired') f.state.sessions[0].expiresAt = new Date(0);
    if (condition === 'mfa-pending') f.state.sessions[0].mfaPending = true;
    if (condition === 'inactive') f.state.memberships[0].active = false;
    if (condition === 'missing-membership') f.state.memberships.shift();
    const before = structuredClone(f.state);
    await assert.rejects(f.actions.grantBusinessAccessAction(undefined, grantForm()), /REDIRECT:/);
    await assert.rejects(f.actions.revokeBusinessAccessAction(undefined, form({ membershipId: 'helper-b' })), /REDIRECT:/);
    assert.deepEqual(f.state, before);
  });
}

for (const values of [{ email: 'bad', acknowledge: 'on' }, { email: 'helper@example.test' }, { email: 'missing@example.test', acknowledge: 'on' }, { email: 'owner@example.test', acknowledge: 'on' }]) {
  test(`invalid grant is rejected: ${JSON.stringify(values)}`, async () => {
    const f = fixture(); assert.ok((await f.actions.grantBusinessAccessAction(undefined, form(values))).error);
    assert.equal(f.state.memberships.length, 3); assert.equal(f.state.audits.length, 0);
  });
}

test('PIN-only accounts cannot be given administrator access', async () => {
  const f = fixture(); f.state.users[1].passwordHash = null;
  assert.ok((await f.actions.grantBusinessAccessAction(undefined, grantForm())).error);
  assert.equal(f.state.memberships.length, 3);
});

test('duplicate grants do not duplicate membership, and revoked ADMIN access can be granted again', async () => {
  const f = fixture(); await f.actions.grantBusinessAccessAction(undefined, grantForm());
  const member = f.state.memberships.at(-1);
  assert.ok((await f.actions.grantBusinessAccessAction(undefined, grantForm())).error);
  await f.actions.revokeBusinessAccessAction(undefined, form({ membershipId: member.id }));
  assert.ok((await f.actions.grantBusinessAccessAction(undefined, grantForm())).ok);
  assert.equal(f.state.memberships.length, 4); assert.equal(member.active, true); assert.equal(member.doesFieldwork, false);
});

test('grant does not replace another existing team role, including inactive memberships', async () => {
  for (const active of [true, false]) {
    const f = fixture();
    f.state.memberships.push({ id: 'tech-a', tenantId: 'a', userId: 'helper', role: 'TECHNICIAN', active });
    assert.ok((await f.actions.grantBusinessAccessAction(undefined, grantForm())).error);
    assert.equal(f.state.memberships.at(-1).role, 'TECHNICIAN');
    assert.equal(f.state.memberships.at(-1).active, active);
  }
});

test('full package blocks grant and reactivation', async () => {
  for (const reactivation of [true, false]) {
    const f = fixture(); f.state.tenants[0].plan = 'FREE_SOLO';
    if (reactivation) f.state.memberships.push({ id: 'old', tenantId: 'a', userId: 'helper', role: 'ADMIN', active: false });
    assert.match((await f.actions.grantBusinessAccessAction(undefined, grantForm())).error, /no spare seats/);
    assert.equal(f.state.audits.length, 0);
  }
});

test('owner cannot revoke another tenant, owner, or technician membership', async () => {
  const f = fixture(); f.state.memberships[1].role = 'ADMIN';
  f.state.memberships.push({ id: 'tech-a', tenantId: 'a', userId: 'stranger', role: 'TECHNICIAN', active: true });
  for (const id of ['helper-b', 'owner-a', 'tech-a', 'unknown']) {
    assert.ok((await f.actions.revokeBusinessAccessAction(undefined, form({ membershipId: id }))).error);
  }
  assert.ok(f.state.memberships.every((m) => m.active)); assert.equal(f.state.audits.length, 0);
});

test('audit failure rolls back both a grant and a revocation including open sessions', async () => {
  const f = fixture(); await f.actions.grantBusinessAccessAction(undefined, grantForm());
  const id = f.state.memberships.at(-1).id;
  f.state.sessions[1].activeTenantId = 'a'; f.failAudit();
  const before = structuredClone(f.state);
  assert.ok((await f.actions.revokeBusinessAccessAction(undefined, form({ membershipId: id }))).error);
  assert.deepEqual(f.state, before);
  assert.ok((await f.actions.grantBusinessAccessAction(undefined, form({ email: 'stranger@example.test', acknowledge: 'on' }))).error);
  assert.deepEqual(f.state, before);
});

for (const condition of ['foreign-business', 'paused', 'revoked', 'mfa-pending', 'expired', 'signed-out']) {
  test(`switch denies ${condition} without changing any session`, async () => {
    const f = fixture(); await f.actions.grantBusinessAccessAction(undefined, grantForm()); f.signInAs('helper');
    if (condition === 'paused') f.state.tenants[0].plan = 'FREE_SOLO';
    if (condition === 'revoked') f.state.memberships.at(-1).active = false;
    if (condition === 'mfa-pending') f.state.sessions[1].mfaPending = true;
    if (condition === 'expired') f.state.sessions[1].expiresAt = new Date(0);
    if (condition === 'signed-out') f.signInAs(null);
    const before = structuredClone(f.state.sessions);
    const promise = f.actions.switchBusinessAction(undefined, form({ tenantId: condition === 'foreign-business' ? 'c' : 'a' }));
    if (['mfa-pending', 'expired', 'signed-out'].includes(condition)) await assert.rejects(promise, /REDIRECT:/);
    else assert.ok((await promise).error);
    assert.deepEqual(f.state.sessions, before);
  });
}

test('membership recheck denies a stale session still pointing at a revoked business', async () => {
  const f = fixture(); await f.actions.grantBusinessAccessAction(undefined, grantForm());
  f.signInAs('helper'); f.state.sessions[1].activeTenantId = 'a'; f.state.memberships.at(-1).active = false;
  await assert.rejects(f.auth.requireRole(['ADMIN']), /REDIRECT:\/switch-business/);
});

const React = require('react');
const jsx = require('react/jsx-runtime');
const { renderToStaticMarkup } = require('react-dom/server');
const dateInputs = load('src/components/ui/DateTimeInputs.tsx', { react: React, 'react/jsx-runtime': jsx });
const controls = load('src/components/auth/ui.tsx', { react: React, 'react/jsx-runtime': jsx, 'lucide-react': require('lucide-react'), '@/components/ui/DateTimeInputs': dateInputs });
const forms = load('src/components/auth/BusinessAccessForms.tsx', {
  react: React, 'react/jsx-runtime': jsx, '@/components/auth/ui': controls,
  '@/lib/auth/businessAccess': { grantBusinessAccessAction: async () => {}, revokeBusinessAccessAction: async () => {}, switchBusinessAction: async () => {} },
});

test('grant form explains administrator access and requires both email and acknowledgement', () => {
  const html = renderToStaticMarkup(React.createElement(forms.GrantBusinessAccessForm));
  assert.match(html, /type="email"[^>]*required/);
  assert.match(html, /type="checkbox"[^>]*required/);
  assert.match(html, /customers, jobs, finances and team as an administrator/);
  assert.match(html, /aria-live="polite"/);
});

test('revoke form initially offers confirmation without submitting a revocation', () => {
  const html = renderToStaticMarkup(React.createElement(forms.RevokeBusinessAccessForm, { membershipId: 'member-a', name: 'Helper' }));
  assert.match(html, /type="button"/);
  assert.match(html, /Revoke access for Helper/);
  assert.doesNotMatch(html, /<form/);
});

test('business switcher renders names and roles and handles a revoked current selection', () => {
  const html = renderToStaticMarkup(React.createElement(forms.SwitchBusinessForm, {
    businesses: [{ id: 'b', name: 'Helper business', role: 'Owner' }], activeTenantId: 'a',
  }));
  assert.match(html, /<select name="tenantId"/);
  assert.match(html, /value="b" selected=""/);
  assert.match(html, /Helper business — Owner/);
  assert.doesNotMatch(html, /value="a"/);
});

test('switch page lists only memberships belonging to the signed-in user even with no active business', async () => {
  const page = load('src/app/switch-business/page.tsx', {
    'react/jsx-runtime': jsx, '@/components/auth/ui': controls, '@/components/auth/BusinessAccessForms': forms,
    '@/lib/auth/session': { requireSignedIn: async () => ({ userId: 'helper', activeTenantId: null, user: { name: 'Helper' } }) },
    '@/lib/auth/actions': { logoutAction: async () => {} },
    '@/lib/prisma': { prisma: { membership: { async findMany({ where, select }) {
      assert.deepEqual(where, { userId: 'helper', active: true });
      assert.deepEqual(select, { role: true, tenant: { select: { id: true, businessName: true } } });
      return [{ role: 'OWNER', tenant: { id: 'b', businessName: 'My business' } }];
    } } } },
  });
  const html = renderToStaticMarkup(await page.default());
  assert.match(html, /My business — Owner/);
  assert.match(html, /Signed in as Helper/);
});
