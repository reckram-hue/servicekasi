import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { load } from './helpers/load-ts.mjs';

const require = createRequire(import.meta.url);
const validation = load('src/lib/settings/logo.ts');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');

function fixture({ role = 'OWNER', uploadFails = false, saveFails = false } = {}) {
  const saved = [], uploaded = [], removed = [], refreshed = [];
  let logoUrl = '/existing-logo.png';
  const { uploadBusinessLogoAction } = load('src/lib/settings/logoActions.ts', {
    'next/cache': { revalidatePath: (...args) => refreshed.push(args) },
    '@/lib/auth/session': { requireRole: async (roles) => {
      assert.deepEqual(roles, ['OWNER', 'ADMIN']);
      if (!roles.includes(role)) throw new Error('Unauthorized');
      return { tenant: { id: 'eco4-tenant', slug: 'eco4-wash', logoUrl } };
    } },
    '@/lib/prisma': { prisma: { tenant: { update: async (args) => {
      if (saveFails) throw new Error('Database unavailable');
      saved.push(args);
      logoUrl = args.data.logoUrl;
    } } } },
    '@/lib/storage': {
      uploadPublicFile: async (...args) => {
        if (uploadFails) throw new Error('Storage unavailable');
        uploaded.push(args);
        return `/uploads/eco4-tenant/logo-${uploaded.length}.png`;
      },
      deletePublicFile: async (url) => removed.push(url),
    },
    './logo': validation,
  });
  return { upload: uploadBusinessLogoAction, saved, uploaded, removed, refreshed, logo: () => logoUrl };
}

function form(bytes = png, type = 'image/png') {
  const data = new FormData();
  data.set('logo', new Blob([bytes], { type }), 'logo.png');
  return data;
}

for (const role of ['OWNER', 'ADMIN']) {
  test(`${role} can upload and replace only their own business logo`, async () => {
    const f = fixture({ role });
    const data = form();
    data.set('tenantId', 'other-business');
    data.set('logoUrl', 'https://untrusted.test/not-the-upload.png');
    assert.deepEqual(await f.upload(data), { ok: 'Logo saved.' });
    assert.deepEqual(f.saved[0], { where: { id: 'eco4-tenant' }, data: { logoUrl: '/uploads/eco4-tenant/logo-1.png' } });
    assert.equal(f.uploaded[0][0], 'eco4-tenant');
    assert.deepEqual(f.uploaded[0][1], png, 'preserve image bytes, including PNG transparency');
    assert.equal(f.uploaded[0][2], 'image/png');
    await f.upload(data);
    assert.equal(f.logo(), '/uploads/eco4-tenant/logo-2.png');
    assert.deepEqual(f.removed, [], 'keep previous URLs valid for already-open documents');
    assert.ok(f.refreshed.some(([path]) => path === '/settings/business'));
    assert.ok(f.refreshed.some(([path]) => path === '/book/eco4-wash'));
    for (const path of ['/q/[token]', '/i/[token]', '/eta/[token]', '/invoices/[id]']) {
      assert.ok(f.refreshed.some(([p, type]) => p === path && type === 'page'));
    }
  });
}

for (const role of ['TECHNICIAN', 'DISPATCHER', null]) {
  test(`${role ?? 'anonymous user'} cannot upload a logo`, async () => {
    const f = fixture({ role });
    await assert.rejects(f.upload(form()), /Unauthorized/);
    assert.equal(f.uploaded.length, 0);
    assert.equal(f.saved.length, 0);
  });
}

for (const [label, data] of [
  ['missing file', new FormData()],
  ['text instead of a file', new URLSearchParams({ logo: '/arbitrary-file.png' })],
  ['empty image', form(Buffer.alloc(0))],
  ['oversized image', form(Buffer.alloc(validation.MAX_LOGO_BYTES + 1))],
  ['SVG file', form('<svg></svg>', 'image/svg+xml')],
  ['HTML disguised as PNG', form('<html>not an image</html>')],
  ['PNG disguised as JPEG', form(png, 'image/jpeg')],
]) {
  test(`reject ${label} without changing the saved logo`, async () => {
    const f = fixture();
    assert.ok((await f.upload(data)).error);
    assert.equal(f.logo(), '/existing-logo.png');
    assert.equal(f.uploaded.length, 0);
    assert.equal(f.saved.length, 0);
  });
}

test('storage failure leaves the existing logo unchanged', async () => {
  const f = fixture({ uploadFails: true });
  assert.match((await f.upload(form())).error, /upload/);
  assert.equal(f.logo(), '/existing-logo.png');
  assert.equal(f.saved.length, 0);
  assert.equal(f.refreshed.length, 0);
});

test('database failure cleans up the new upload and leaves the previous logo', async () => {
  const f = fixture({ saveFails: true });
  assert.match((await f.upload(form())).error, /save/);
  assert.equal(f.logo(), '/existing-logo.png');
  assert.deepEqual(f.removed, ['/uploads/eco4-tenant/logo-1.png']);
  assert.equal(f.refreshed.length, 0);
});

test('logo form renders an accessible file picker and saved-logo preview', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { BusinessLogoForm } = load('src/components/settings/BusinessLogoForm.tsx', {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
    '@/lib/settings/logo': validation,
    '@/lib/settings/logoActions': {},
  });
  const html = renderToStaticMarkup(React.createElement(BusinessLogoForm, { logoUrl: '/eco4.png', businessName: 'Eco4 Wash' }));
  assert.match(html, /alt="Eco4 Wash logo"/);
  assert.match(html, /src="\/eco4.png"/);
  assert.match(html, /for="business-logo"/);
  assert.match(html, /accept="image\/jpeg,image\/png"/);
  assert.match(html, /type="submit" disabled=""/);
  const empty = renderToStaticMarkup(React.createElement(BusinessLogoForm, { logoUrl: null, businessName: 'Eco4 Wash' }));
  assert.match(empty, /No logo uploaded/);
});
