import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { load } from './helpers/load-ts.mjs';

const require = createRequire(import.meta.url);
const React = require('react');
const jsx = require('react/jsx-runtime');
const icons = require('lucide-react');
const Link = require('next/link');
const { renderToStaticMarkup } = require('react-dom/server');
const client = require('@prisma/client');
const industries = load('src/lib/onboarding/industries.ts');
const starters = load('src/lib/onboarding/starterPriceList.ts', { 'server-only': {}, './industries': industries });
const ui = load('src/components/auth/ui.tsx', { react: React, 'react/jsx-runtime': jsx, 'lucide-react': icons });
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));

test('mobile car wash is accepted by the generated enum and has only inactive unpriced templates', () => {
  assert.equal(client.Industry.MOBILE_CAR_WASH, 'MOBILE_CAR_WASH');
  assert.equal(industries.INDUSTRY_LABELS.MOBILE_CAR_WASH, 'Mobile car wash & detailing');
  const rows = starters.starterItemRows('MOBILE_CAR_WASH');
  assert.equal(rows.length, 7);
  assert.ok(rows.every((r) => r.active === false && r.unitPriceCents === 0));
  assert.ok(rows.some((r) => /SUV/.test(r.name)));
  assert.ok(rows.some((r) => /Fleet/.test(r.name)));
  assert.ok(rows.some((r) => r.type === 'TRAVEL'));
});

test('existing trades retain their priced starter items and active defaults', () => {
  for (const industry of industries.INDUSTRIES.filter((i) => i !== 'MOBILE_CAR_WASH')) {
    const rows = starters.starterItemRows(industry);
    assert.ok(rows.length > 0);
    assert.ok(rows.every((r) => r.unitPriceCents > 0 && r.active === undefined));
  }
  assert.equal(starters.starterItemRows('PLUMBING')[0].unitPriceCents, 55000);
});

test('adding wash templates preserves existing names and prices and stays tenant scoped', async () => {
  const existing = [{ name: ' EXTERIOR WASH — CAR ', unitPriceCents: 12345, active: true }];
  const created = [];
  const db = { catalogItem: {
    findMany: async () => existing,
    createMany: async ({ data }) => { created.push(...data); existing.push(...data); },
  } };
  const result = await starters.addStarterPriceList(db, 'car-wash-tenant', 'MOBILE_CAR_WASH');
  assert.deepEqual(result, { added: 6, skipped: 1 });
  assert.ok(created.every((r) => r.tenantId === 'car-wash-tenant' && !r.active));
  assert.equal(existing[0].unitPriceCents, 12345);
  assert.deepEqual(await starters.addStarterPriceList(db, 'car-wash-tenant', 'MOBILE_CAR_WASH'), { added: 0, skipped: 7 });
});

function signupFixture() {
  const created = [], sessions = [];
  const actions = load('src/lib/auth/actions.ts', {
    'next/navigation': { redirect: (path) => { throw new Error(`REDIRECT:${path}`); } }, 'next/cache': { revalidatePath() {} }, zod: require('zod'), '@prisma/client': client,
    '@/lib/prisma': { prisma: { user: { findUnique: async () => null }, tenant: { create: async ({ data }) => { created.push(data); return { id: 'new-tenant', memberships: [{ userId: 'new-owner' }] }; } } } },
    '@/lib/southAfrica': {}, '@/lib/onboarding/starterPriceList': starters, '@/lib/storage': {}, '@/lib/plans/plans': {}, '@/lib/plans/people': {},
    './crypto': { hashSecret: async () => 'test-hash' }, './totp': {}, './session': { createSession: async (args) => sessions.push(args) },
  });
  return { actions, created, sessions };
}
function form(values) { const fd = new FormData(); Object.entries(values).forEach(([k, v]) => fd.set(k, v)); return fd; }

test('signup creates the selected car-wash tenant and owner who can do fieldwork', async () => {
  const f = signupFixture();
  await assert.rejects(f.actions.signupAction(undefined, form({ businessName: 'Example Wash', name: 'Example Owner', email: 'owner@example.test', password: 'test-only-password', industry: 'MOBILE_CAR_WASH', fieldwork: 'TEAM' })), /REDIRECT:\/settings\/security/);
  assert.equal(f.created[0].industry, 'MOBILE_CAR_WASH');
  assert.equal(f.created[0].memberships.create.role, 'OWNER');
  assert.equal(f.created[0].memberships.create.doesFieldwork, true);
  assert.ok(f.created[0].catalogItems.createMany.data.every((item) => item.active === false));
  assert.deepEqual(f.sessions, [{ userId: 'new-owner', tenantId: 'new-tenant' }]);
});

test('invalid business type cannot create an account', async () => {
  const f = signupFixture();
  const result = await f.actions.signupAction(undefined, form({ businessName: 'Test', name: 'Owner', email: 'owner@example.test', password: 'test-only-password', industry: 'MADE_UP', fieldwork: 'TEAM' }));
  assert.ok(result.fieldErrors.industry);
  assert.equal(f.created.length, 0);
});

for (const role of ['OWNER', 'ADMIN', 'TECHNICIAN', 'DISPATCHER']) {
  test(`${role} business-type update respects authorization and tenant isolation`, async () => {
    const writes = [], refreshed = [];
    const actions = load('src/lib/settings/businessTypeActions.ts', {
      '@prisma/client': client, zod: require('zod'), 'next/cache': { revalidatePath: (...args) => refreshed.push(args) },
      '@/lib/auth/session': { requireRole: async (allowed) => { if (!allowed.includes(role)) throw new Error('denied'); return { tenant: { id: 'own-tenant', slug: 'own-wash' } }; } },
      '@/lib/prisma': { prisma: { tenant: { update: async (args) => writes.push(args) } } },
    });
    const call = actions.updateBusinessTypeAction(undefined, form({ industry: 'MOBILE_CAR_WASH', tenantId: 'other-tenant' }));
    if (['OWNER', 'ADMIN'].includes(role)) {
      assert.ok((await call).ok);
      assert.deepEqual(writes, [{ where: { id: 'own-tenant' }, data: { industry: 'MOBILE_CAR_WASH' } }]);
      assert.deepEqual(refreshed, [['/', 'layout'], ['/book/own-wash']]);
      assert.ok((await actions.updateBusinessTypeAction(undefined, form({ industry: 'unknown' }))).error);
      assert.equal(writes.length, 1);
    } else { await assert.rejects(call, /denied/); assert.equal(writes.length, 0); }
  });
}

async function checklist(industry, priced = false) {
  const calls = [];
  const db = Object.fromEntries(['catalogItem', 'client', 'quote', 'invoice', 'visit', 'membership', 'expense'].map((name) => [name, { count: async (args) => {
    calls.push([name, args]); return name === 'catalogItem' ? (priced ? 1 : 0) : 0;
  } }]));
  const module = load('src/lib/onboarding/checklist.ts', { 'server-only': {}, '@/lib/prisma': { prisma: { paymentAccount: { findUnique: async () => null } } } });
  const items = await module.getOnboardingChecklist(db, { id: 'a', industry, phone: '0830000000', city: 'Cape Town' }, { totpEnabled: false });
  return { items, calls };
}

test('wash onboarding requires priced active services and a scheduled wash, with optional team and costs', async () => {
  const { items, calls } = await checklist('MOBILE_CAR_WASH');
  assert.deepEqual(calls.find(([name]) => name === 'catalogItem')[1], { where: { active: true, unitPriceCents: { gt: 0 }, type: 'SERVICE' } });
  assert.equal(items.find((i) => i.key === 'price-list').done, false);
  assert.equal(items.find((i) => i.key === 'business-details').done, true);
  assert.equal(items.find((i) => i.key === 'first-wash').done, false);
  assert.equal(items.find((i) => i.key === 'first-quote').optional, true);
  for (const key of ['wash-team', 'business-logo', 'first-cost']) assert.equal(items.find((i) => i.key === key).optional, true);
  assert.equal((await checklist('MOBILE_CAR_WASH', true)).items.find((i) => i.key === 'price-list').done, true);
});

test('other trades keep the existing onboarding path', async () => {
  const { items, calls } = await checklist('PLUMBING');
  assert.equal(items.length, 8);
  assert.equal(items.find((i) => i.key === 'first-quote').optional, undefined);
  assert.equal(items.find((i) => i.key === 'business-details').done, false);
  assert.deepEqual(calls.map(([name]) => name), ['catalogItem', 'client', 'quote', 'invoice']);
});

test('new wash expense categories use familiar names and existing categories are preserved', async () => {
  const { ensureDefaultExpenseCategories } = load('src/lib/bookkeeping/categories.ts', { 'server-only': {} });
  for (const industry of ['MOBILE_CAR_WASH', 'PLUMBING']) {
    const rows = [], accounts = [];
    const db = {
      expenseCategory: { count: async () => rows.length, create: async ({ data }) => rows.push(data) },
      ledgerAccount: { create: async ({ data }) => { accounts.push(data); return { id: data.code }; } },
    };
    await ensureDefaultExpenseCategories(db, 'own-tenant', industry);
    assert.ok(rows.every((r) => r.tenantId === 'own-tenant'));
    assert.ok(rows.some((r) => r.name === (industry === 'MOBILE_CAR_WASH' ? 'Detergents & consumables' : 'Materials')));
    assert.ok(rows.some((r) => r.name === 'Fuel'));
    assert.equal(accounts.length, rows.length);
    const before = structuredClone(rows);
    await ensureDefaultExpenseCategories(db, 'own-tenant', 'MOBILE_CAR_WASH');
    assert.deepEqual(rows, before);
  }
});

test('public booking only adds the safe industry field to public tenant data', async () => {
  const { getTenantForBooking } = load('src/lib/requests/publicQuery.ts', {
    'server-only': {}, '@/lib/prisma': { prisma: { tenant: { findUnique: async ({ where, select }) => {
      assert.deepEqual(where, { slug: 'wash-slug' });
      assert.equal(select.industry, true);
      for (const privateField of ['bankAccountNumber', 'vatNumber', 'memberships']) assert.equal(select[privateField], undefined);
      return { industry: 'MOBILE_CAR_WASH' };
    } } } },
  });
  assert.equal((await getTenantForBooking('wash-slug')).industry, 'MOBILE_CAR_WASH');
});

test('wash and generic booking forms use their respective prompts without changing submitted field names', () => {
  const { PublicBookingForm } = load('src/components/booking/PublicBookingForm.tsx', {
    react: React, 'react/jsx-runtime': jsx, '@/lib/requests/publicActions': { submitServiceRequestAction: async () => {} },
  });
  const wash = render(PublicBookingForm, { slug: 'wash', businessName: 'Example Wash', mobileCarWash: true });
  assert.match(wash, /Vehicle, wash service and location/); assert.match(wash, /Request a wash/);
  assert.match(wash, /name="description"/); assert.match(wash, /name="slug" value="wash"/);
  assert.doesNotMatch(wash, /Geyser/);
  assert.match(render(PublicBookingForm, { slug: 'plumber', businessName: 'Plumber' }), /Geyser/);
});

test('dedicated signup link preselects car wash and unknown values fall back to ordinary signup', async () => {
  const { SignupForm } = load('src/components/auth/SignupForm.tsx', {
    react: React, 'react/jsx-runtime': jsx, 'next/link': Link, '@/lib/auth/actions': { signupAction: async () => {} },
    '@/lib/onboarding/industries': industries, './ui': ui,
  });
  const { default: SignupPage } = load('src/app/signup/page.tsx', {
    'react/jsx-runtime': jsx, '@/components/auth/ui': ui, '@/components/auth/SignupForm': { SignupForm }, '@/lib/onboarding/industries': industries,
  });
  const mobile = renderToStaticMarkup(await SignupPage({ searchParams: Promise.resolve({ industry: 'MOBILE_CAR_WASH' }) }));
  assert.match(mobile, /Start your mobile car wash workspace/);
  assert.match(mobile, /value="MOBILE_CAR_WASH" selected=""/);
  assert.match(mobile, /Add your own prices before activating/);
  const generic = renderToStaticMarkup(await SignupPage({ searchParams: Promise.resolve({ industry: 'NOT_REAL' }) }));
  assert.match(generic, /Start your free trial/);
  assert.doesNotMatch(generic, /value="MOBILE_CAR_WASH" selected/);
});

test('car-wash dashboard displays the business branding and working planner/cost links', () => {
  const { CarWashWelcome } = load('src/components/CarWashWelcome.tsx', { 'react/jsx-runtime': jsx, 'next/link': Link, 'lucide-react': icons });
  const html = render(CarWashWelcome, { businessName: 'Example Wash', logoUrl: '/example-logo.png' });
  assert.match(html, /Example Wash/); assert.match(html, /src="\/example-logo.png"/);
  assert.match(html, /href="\/schedule"/); assert.match(html, /href="\/bookkeeping\/expenses\/new"/);
});

test('navigation changes wash labels only for the selected business type', () => {
  const { Sidebar } = load('src/components/Sidebar.tsx', {
    react: React, 'react/jsx-runtime': jsx, 'next/link': Link, 'next/navigation': { usePathname: () => '/jobs' }, 'lucide-react': icons,
  });
  const props = { userName: 'Owner', businessName: 'Example', role: 'OWNER', logout: async () => {}, isCollapsed: false, onToggleCollapse() {}, showGettingStarted: true, showMyDay: true, isPlatformAdmin: false, isMobileOpen: false, onCloseMobile() {} };
  const mobile = render(Sidebar, { ...props, mobileCarWash: true });
  assert.match(mobile, /Wash planner/); assert.match(mobile, /Wash services &amp; prices/); assert.match(mobile, /Wash team/);
  const generic = render(Sidebar, props);
  assert.match(generic, /Schedule/); assert.doesNotMatch(generic, /Wash planner/);
});
