import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { load } from './helpers/load-ts.mjs';

const require = createRequire(import.meta.url);
const React = require('react');
const jsx = require('react/jsx-runtime');
const Link = require('next/link');
const { renderToStaticMarkup } = require('react-dom/server');
const dateInputs = load('src/components/ui/DateTimeInputs.tsx', { react: React, 'react/jsx-runtime': jsx });
const ui = load('src/components/auth/ui.tsx', { react: React, 'react/jsx-runtime': jsx, 'lucide-react': require('lucide-react'), '@/components/ui/DateTimeInputs': dateInputs });
const fields = load('src/components/clients/ClientFormFields.tsx', { 'react/jsx-runtime': jsx, '@/components/auth/ui': ui });
const sourceAction = async () => {};

function formComponent(state) {
  return load('src/components/clients/NewClientForm.tsx', {
    react: state === undefined ? React : { useActionState: () => [state, sourceAction, false] },
    'react/jsx-runtime': jsx, 'next/link': Link,
    '@/lib/clients/actions': { createClientAction: sourceAction },
    '@/components/auth/ui': ui, './ClientFormFields': fields,
  });
}

for (const industry of ['MOBILE_CAR_WASH', 'PLUMBING']) {
  test(`/clients/new renders the real creation form for ${industry} without a customer lookup`, async () => {
    let authenticated = false;
    const { default: Page } = load('src/app/(app)/clients/new/page.tsx', {
      'react/jsx-runtime': jsx, 'next/link': Link,
      '@/lib/auth/session': { requireRole: async () => { authenticated = true; return { tenant: { businessName: 'Test Business', industry } }; } },
      '@/components/clients/NewClientForm': formComponent(),
    });
    const html = renderToStaticMarkup(await Page());
    assert.equal(authenticated, true);
    assert.match(html, /name="firstName"/);
    assert.match(html, /name="phone"/);
    assert.match(html, /Test Business/);
    assert.match(html, new RegExp(industry === 'MOBILE_CAR_WASH' ? 'Add customer' : 'Add client'));
  });
}

test('new-client page requires office access', async () => {
  const { default: Page } = load('src/app/(app)/clients/new/page.tsx', {
    'react/jsx-runtime': jsx, 'next/link': Link,
    '@/lib/auth/session': { requireRole: async () => { throw new Error('access denied'); } },
    '@/components/clients/NewClientForm': formComponent(),
  });
  await assert.rejects(Page(), /access denied/);
});

test('successful creation shows a planner link and removes the form to avoid a second submission', () => {
  const { NewClientForm } = formComponent({ ok: 'Sarah was added.' });
  const html = renderToStaticMarkup(React.createElement(NewClientForm, { mobileCarWash: true }));
  assert.match(html, /Sarah was added/);
  assert.match(html, /href="\/jobs"/);
  assert.match(html, /Schedule a wash/);
  assert.doesNotMatch(html, /<form/);
});

test('validation errors are shown on the creation form', () => {
  const { NewClientForm } = formComponent({ fieldErrors: { phone: ['Enter a phone number or an email address.'] } });
  const html = renderToStaticMarkup(React.createElement(NewClientForm));
  assert.match(html, /Enter a phone number or an email address/);
  assert.match(html, /<form/);
});

test('the new-page action saves a customer and address only in the signed-in business', async () => {
  const records = [], refreshes = [];
  const tenant = { id: 'business-a', countryCode: 'ZA' };
  const schema = load('src/lib/clients/schema.ts', { zod: require('zod') });
  const create = load('src/lib/clients/create.ts', { 'server-only': {}, '@/lib/southAfrica': load('src/lib/southAfrica.ts') });
  const { createClientAction } = load('src/lib/clients/actions.ts', {
    'next/navigation': {}, 'next/cache': { revalidatePath: (path) => refreshes.push(path) }, zod: require('zod'),
    '@/lib/db': { tenantDb: (id) => { assert.equal(id, tenant.id); return { client: { create: async ({ data }) => { records.push(data); return { id: 'customer-a', ...data }; } } }; } },
    '@/lib/auth/session': { requireRole: async () => ({ tenant }) }, './schema': schema, './create': create,
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({ firstName: 'Sarah', phone: '083 555 0101', street: '1 Test Street', city: 'Cape Town', tenantId: 'business-b' })) form.set(key, value);
  assert.ok((await createClientAction(undefined, form)).ok);
  assert.equal(records.length, 1);
  assert.equal(records[0].tenantId, tenant.id);
  assert.equal(records[0].properties.create.tenantId, tenant.id);
  assert.equal(records[0].phone, '+27835550101');
  assert.deepEqual(refreshes, ['/clients']);
  form.set('firstName', '');
  assert.ok((await createClientAction(undefined, form)).fieldErrors.firstName);
  assert.equal(records.length, 1);
});
