import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { load } from './helpers/load-ts.mjs';

const require = createRequire(import.meta.url);
const React = require('react');
const jsx = require('react/jsx-runtime');
const { renderToStaticMarkup } = require('react-dom/server');
const templates = load('src/lib/messaging/templates.ts', { zod: require('zod'), '@/lib/southAfrica': load('src/lib/southAfrica.ts') });
const { defaultTemplates, getTemplates, renderTemplate, unresolvedTokens, whatsAppMessageUrl, TemplatesSchema, templateSetup, ECO4_REVIEW_URL } = templates;

test('four defaults are valid and personalised without recursively interpreting customer data', () => {
  const defaults = defaultTemplates(true);
  assert.equal(defaults.length, 4);
  assert.equal(TemplatesSchema.safeParse(defaults).success, true);
  const message = renderTemplate(defaults[3].body, { customer: 'Sarah', business: 'Eco4 Wash', reviewLink: ECO4_REVIEW_URL });
  assert.match(message, /^Hi Sarah,/);
  assert.match(message, /Eco4 Wash/);
  assert.ok(message.includes(ECO4_REVIEW_URL));
  assert.deepEqual(unresolvedTokens(message), []);
  assert.equal(renderTemplate('Hi [customer], [business]', { customer: 'Name [business]', business: 'Company' }), 'Hi Name [business], Company');
  assert.equal(renderTemplate('Hi [customer]', { customer: ' ', business: 'Company' }), 'Hi there');
});

test('saved wording wins; malformed settings fall back to defaults and cannot omit slots', () => {
  const saved = defaultTemplates(); saved[3].body = 'Thanks [customer]!';
  assert.equal(getTemplates(saved, true)[3].body, 'Thanks [customer]!');
  assert.deepEqual(getTemplates({ bad: true }, true), defaultTemplates(true));
  assert.equal(TemplatesSchema.safeParse(saved.slice(1)).success, false);
  assert.equal(TemplatesSchema.safeParse([saved[0], saved[0], saved[2], saved[3]]).success, false);
});

test('Jeremy review link is an explicit unsaved preset, never a global default or an overwrite', () => {
  const tenant = { whatsappTemplates: null, googleReviewUrl: null, industry: 'MOBILE_CAR_WASH' };
  assert.equal(templateSetup(tenant).reviewUrl, '');
  assert.equal(templateSetup(tenant, 'eco4wash').reviewUrl, ECO4_REVIEW_URL);
  assert.equal(templateSetup(tenant, 'unknown').reviewUrl, '');
  assert.equal(templateSetup({ ...tenant, googleReviewUrl: 'https://example.test/review' }, 'eco4wash').reviewUrl, 'https://example.test/review');
  assert.equal(templateSetup({ ...tenant, whatsappTemplates: defaultTemplates() }, 'eco4wash').ecoDraft, false);
});

test('WhatsApp links normalize local SA numbers and preserve Unicode, newlines and punctuation', () => {
  const message = 'Hi Zoë & Sarah!\nThanks 😊 https://example.test/?a=1&b=2';
  for (const phone of ['083 212 1665', '+27 (83) 212-1665', '27832121665']) {
    const url = new URL(whatsAppMessageUrl(phone, message));
    assert.equal(url.pathname, '/27832121665');
    assert.equal(url.searchParams.get('text'), message);
    assert.equal([...url.searchParams.keys()].length, 1);
  }
  for (const phone of [null, '', '123', 'not-a-phone', '+27&text=evil']) assert.equal(whatsAppMessageUrl(phone, message), null);
  assert.equal(whatsAppMessageUrl('0832121665', ''), null);
});

test('missing appointment details and review link block incomplete messages', () => {
  const message = renderTemplate(defaultTemplates()[0].body, { customer: 'Sarah', business: 'Eco4 Wash' });
  assert.deepEqual(unresolvedTokens(message), ['[date]', '[time]']);
  assert.equal(whatsAppMessageUrl('0832121665', message), null);
  const thanks = renderTemplate(defaultTemplates()[3].body, { customer: 'Sarah', business: 'Eco4 Wash' });
  assert.deepEqual(unresolvedTokens(thanks), ['[review_link]']);
});

function settingsForm(items = defaultTemplates(), review = ECO4_REVIEW_URL) {
  const form = new FormData();
  for (const item of items) { form.set(`${item.id}_title`, item.title); form.set(`${item.id}_body`, item.body); }
  form.set('reviewUrl', review); form.set('tenantId', 'someone-else'); return form;
}
function actionFixture(role = 'OWNER') {
  const writes = [], refreshed = [];
  const module = load('src/lib/messaging/templateActions.ts', {
    'next/cache': { revalidatePath: (...args) => refreshed.push(args) },
    '@/lib/auth/session': { requireRole: async (roles) => { if (!roles.includes(role)) throw new Error('denied'); return { tenant: { id: 'own-business', plan: 'FREE_SOLO' } }; } },
    '@/lib/prisma': { prisma: { tenant: { update: async (args) => { writes.push(args); return args.data; } } } },
    './templates': templates,
  });
  return { ...module, writes, refreshed };
}
for (const role of ['OWNER', 'ADMIN', 'DISPATCHER', 'TECHNICIAN']) {
  test(`${role} template settings permissions and tenant isolation`, async () => {
    const f = actionFixture(role);
    if (!['OWNER', 'ADMIN'].includes(role)) {
      await assert.rejects(f.saveWhatsAppTemplatesAction(undefined, settingsForm()), /denied/);
      assert.equal(f.writes.length, 0); return;
    }
    assert.ok((await f.saveWhatsAppTemplatesAction(undefined, settingsForm())).ok);
    assert.deepEqual(f.writes[0].where, { id: 'own-business' });
    assert.equal(f.writes[0].data.googleReviewUrl, ECO4_REVIEW_URL);
    assert.deepEqual(getTemplates(f.writes[0].data.whatsappTemplates), defaultTemplates());
    assert.ok(f.refreshed.some(([path]) => path === '/messages/templates'));
  });
}

test('invalid or oversized templates and unsafe links never write, while empty review link can be saved', async () => {
  const f = actionFixture();
  for (const [field, value] of [['thank_you_body', ''], ['thank_you_body', 'x'.repeat(2001)], ['thank_you_body', 'Hi [unknown]'], ['confirmation_title', 'x'.repeat(61)], ['reviewUrl', 'javascript:alert(1)'], ['reviewUrl', 'https://user:pass@example.test']]) {
    const form = settingsForm(); form.set(field, value);
    assert.ok((await f.saveWhatsAppTemplatesAction(undefined, form)).error);
  }
  assert.equal(f.writes.length, 0);
  assert.ok((await f.saveWhatsAppTemplatesAction(undefined, settingsForm(defaultTemplates(), ''))).ok);
  assert.equal(f.writes[0].data.googleReviewUrl, null);
});

function composerHarness(extra = {}) {
  const slots = []; let cursor = 0; const selected = { focused: false, selected: false };
  const hooks = {
    useState: (initial) => { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef: () => ({ current: { focus() { selected.focused = true; }, select() { selected.selected = true; } } }),
  };
  const { WhatsAppComposer } = load('src/components/messaging/WhatsAppComposer.tsx', {
    '@/components/ui/DateTimeInputs': load('src/components/ui/DateTimeInputs.tsx', { react: React, 'react/jsx-runtime': jsx }), '@/lib/dates': load('src/lib/dates.ts'),
    react: hooks, 'react/jsx-runtime': jsx, 'next/link': require('next/link'), '@/lib/messaging/templates': templates,
  });
  function render() { cursor = 0; return WhatsAppComposer({ templates: defaultTemplates(true), customer: 'Sarah', business: 'Eco4 Wash', reviewLink: ECO4_REVIEW_URL, phone: '0832121665', canEditTemplates: true, ...extra }); }
  function find(tree, predicate) {
    if (!tree || typeof tree !== 'object') return null;
    if (predicate(tree)) return tree;
    for (const child of React.Children.toArray(tree.props?.children)) { const found = find(child, predicate); if (found) return found; }
    return null;
  }
  return { render, find, selected };
}

test('composer fills names, keeps per-message edits and builds link from the exact edited draft', () => {
  const h = composerHarness(); let view = h.render();
  assert.match(h.find(view, (n) => n.type === 'textarea').props.value, /^Hi Sarah,/);
  assert.equal(h.find(view, (n) => n.type === 'button' && n.props.children === 'Copy message').props.disabled, true);
  h.find(view, (n) => n.type === 'select').props.onChange({ target: { value: 'thank_you' } }); view = h.render();
  const draft = h.find(view, (n) => n.type === 'textarea').props.value;
  assert.ok(draft.includes(ECO4_REVIEW_URL));
  h.find(view, (n) => n.type === 'textarea').props.onChange({ target: { value: `${draft}\nJeremy` } }); view = h.render();
  const url = new URL(h.find(view, (n) => n.type === 'a' && n.props.children === 'Open WhatsApp').props.href);
  assert.equal(url.searchParams.get('text'), `${draft}\nJeremy`);
  h.find(view, (n) => n.type === 'select').props.onChange({ target: { value: 'on_the_way' } }); view = h.render();
  h.find(view, (n) => n.type === 'select').props.onChange({ target: { value: 'thank_you' } }); view = h.render();
  assert.equal(h.find(view, (n) => n.type === 'textarea').props.value, `${draft}\nJeremy`);
});

test('copy writes the personalised message; clipboard failure selects text for manual copying', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    for (const blocked of [false, true]) {
      const copied = [];
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async (text) => { if (blocked) throw new Error('blocked'); copied.push(text); } } } });
      const h = composerHarness(); let view = h.render();
      h.find(view, (n) => n.type === 'select').props.onChange({ target: { value: 'thank_you' } }); view = h.render();
      await h.find(view, (n) => n.type === 'button' && n.props.children === 'Copy message').props.onClick(); view = h.render();
      if (blocked) { assert.deepEqual(h.selected, { focused: true, selected: true }); assert.match(h.find(view, (n) => n.props.role === 'status').props.children, /blocked/); }
      else { assert.equal(copied[0], h.find(view, (n) => n.type === 'textarea').props.value); assert.match(copied[0], /^Hi Sarah,/); }
    }
  } finally { if (original) Object.defineProperty(globalThis, 'navigator', original); else delete globalThis.navigator; }
});

test('staff can use messages without admin controls and missing phone still allows copy', () => {
  const h = composerHarness({ phone: null, canEditTemplates: false }); let view = h.render();
  h.find(view, (n) => n.type === 'select').props.onChange({ target: { value: 'thank_you' } }); view = h.render();
  const html = renderToStaticMarkup(view);
  assert.doesNotMatch(html, /Edit shared templates/);
  assert.equal(h.find(view, (n) => n.type === 'button' && n.props.children === 'Copy message').props.disabled, false);
  assert.equal(h.find(view, (n) => n.type === 'button' && n.props.children === 'Open WhatsApp').props.disabled, true);
});
