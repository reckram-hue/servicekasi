import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { load } from './helpers/load-ts.mjs';

const require = createRequire(import.meta.url);
test('opening WhatsApp does not mark a broadcast recipient sent', () => {
  const React = require('react');
  const { SendListItem } = load('src/components/messaging/SendListItem.tsx', {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'), '@/lib/messaging/actions': { markRecipientSentAction: async () => { throw Error('must require explicit submit'); } },
  });
  const html = require('react-dom/server').renderToStaticMarkup(React.createElement(SendListItem, {
    recipientId: 'r1', broadcastId: 'b1', name: 'Customer', phone: '+27835550101', message: 'Hello', status: 'PENDING', skipReason: null, sentAt: null,
  }));
  assert.match(html, /href="https:\/\/wa.me\/27835550101\?text=Hello"/);
  assert.match(html, /Open WhatsApp/);
  assert.match(html, /Mark sent/);
  assert.match(html, /Mark sent after you send/);
});

test('manual sent confirmation requires the matching broadcast and an unsent recipient', async () => {
  const calls = [];
  const schema = load('src/lib/messaging/schema.ts', { zod: require('zod') });
  const { markRecipientSentAction } = load('src/lib/messaging/actions.ts', {
    zod: require('zod'), 'next/navigation': {}, 'next/cache': { revalidatePath() { calls.push('refresh'); } },
    '@/lib/auth/session': { requireRole: async () => ({ tenant: { id: 'tenant-a' } }) },
    '@/lib/db': { tenantDb: (tenantId) => {
      assert.equal(tenantId, 'tenant-a');
      return { broadcastRecipient: { updateMany: async (args) => { calls.push(args); return { count: 0 }; }, count: async () => { throw Error('wrong recipient must not update broadcast'); } } };
    } },
    '@/lib/plans/plans': {}, './schema': schema, './audience': {},
  });
  const form = new FormData(); form.set('recipientId', 'r1'); form.set('broadcastId', 'b1');
  await markRecipientSentAction(form);
  assert.deepEqual(calls[0].where, { id: 'r1', broadcastId: 'b1', status: { in: ['PENDING', 'FAILED'] } });
  assert.equal(calls.length, 1);
});
