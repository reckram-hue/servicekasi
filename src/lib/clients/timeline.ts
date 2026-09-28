import 'server-only';
import type { TenantDb } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { invoiceBalanceCents } from '@/lib/invoices/payments';

export type TimelineEvent = {
  id: string;
  at: Date;
  kind: 'request' | 'quote' | 'job' | 'visit' | 'invoice' | 'payment' | 'message';
  title: string;
  detail?: string;
  href?: string;
  tone?: 'good' | 'bad';
  /** The record only stores a day (e.g. a payment typed in by hand), so showing a clock time would be made up. */
  dateOnly?: boolean;
};

const SOURCE_LABEL: Record<string, string> = {
  MANUAL: 'added by hand',
  WEB_BOOKING: 'your booking page',
  WHATSAPP: 'WhatsApp',
  GOOGLE_BUSINESS: 'Google Business',
  PHONE: 'a phone call',
  VOICE_MEMO: 'a voice memo',
};

const METHOD_LABEL: Record<string, string> = {
  CASH: 'cash',
  EFT: 'EFT',
  CARD: 'card',
  PAYFAST: 'PayFast',
  YOCO: 'Yoco',
  OZOW: 'Ozow',
  PAYSTACK: 'Paystack',
  MOBILE_MONEY: 'mobile money',
  OTHER: 'other',
};

const MAX_EVENTS = 150;

function snippet(text: string, max = 90): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
}

/**
 * Everything that has happened with one client, newest first, worked out from the
 * records that already exist — nothing is stored separately, so it can't drift
 * from the truth (docs/plans/crm.md, decision 2). Still-to-come visits are left
 * out; the client page lists those separately.
 */
export async function clientTimeline(db: TenantDb, clientId: string, currencyCode: string) {
  const money = (cents: number) => formatMoney(cents, currencyCode);
  const now = new Date();

  const [requests, quotes, jobs, visits, invoices, payments, recipients] = await Promise.all([
    db.serviceRequest.findMany({ where: { clientId } }),
    db.quote.findMany({ where: { clientId } }),
    db.job.findMany({ where: { clientId } }),
    db.visit.findMany({
      where: { job: { clientId }, status: { in: ['COMPLETED', 'NO_ACCESS'] } },
      include: { job: { select: { id: true, number: true, title: true } } },
    }),
    db.invoice.findMany({ where: { clientId, status: { not: 'DRAFT' } } }),
    db.payment.findMany({
      where: { invoice: { clientId }, OR: [{ status: 'SUCCEEDED' }, { reversedAt: { not: null } }] },
      include: { invoice: { select: { id: true, number: true } } },
    }),
    db.broadcastRecipient.findMany({
      where: { clientId, status: 'SENT', sentAt: { not: null } },
      include: { broadcast: { select: { id: true, kind: true, channel: true, body: true } } },
    }),
  ]);

  const events: TimelineEvent[] = [];

  for (const r of requests) {
    events.push({
      id: `request-${r.id}`,
      at: r.createdAt,
      kind: 'request',
      title: `Request came in via ${SOURCE_LABEL[r.source] ?? r.source}`,
      detail: snippet(r.description),
    });
  }

  for (const q of quotes) {
    const href = `/quotes/${q.id}`;
    events.push({ id: `quote-created-${q.id}`, at: q.createdAt, kind: 'quote', title: `Quote ${q.number} started: ${q.title}`, href });
    if (q.sentAt) {
      events.push({ id: `quote-sent-${q.id}`, at: q.sentAt, kind: 'quote', title: `Quote ${q.number} sent, ${money(q.totalCents)}`, href });
    }
    if (q.approvedAt) {
      events.push({
        id: `quote-approved-${q.id}`,
        at: q.approvedAt,
        kind: 'quote',
        title: `Quote ${q.number} approved${q.approvedByName ? ` by ${q.approvedByName}` : ''}`,
        href,
        tone: 'good',
      });
    }
    // No dedicated timestamp for these, so the quote's last change stands in.
    if (q.status === 'DECLINED') {
      events.push({
        id: `quote-declined-${q.id}`,
        at: q.updatedAt,
        kind: 'quote',
        title: `Quote ${q.number} declined`,
        detail: q.clientMessage ? snippet(q.clientMessage) : undefined,
        href,
        tone: 'bad',
      });
    }
    if (q.status === 'CHANGES_REQUESTED') {
      events.push({
        id: `quote-changes-${q.id}`,
        at: q.updatedAt,
        kind: 'quote',
        title: `Asked for changes to quote ${q.number}`,
        detail: q.clientMessage ? snippet(q.clientMessage) : undefined,
        href,
      });
    }
  }

  for (const j of jobs) {
    const href = `/jobs/${j.id}`;
    events.push({ id: `job-created-${j.id}`, at: j.createdAt, kind: 'job', title: `Job ${j.number} created: ${j.title}`, href });
    if (j.status === 'COMPLETED') {
      events.push({ id: `job-done-${j.id}`, at: j.completedAt ?? j.updatedAt, kind: 'job', title: `Job ${j.number} completed`, href, tone: 'good' });
    }
    if (j.status === 'CANCELLED') {
      events.push({
        id: `job-cancelled-${j.id}`,
        at: j.updatedAt,
        kind: 'job',
        title: `Job ${j.number} cancelled`,
        detail: j.cancelReason ?? undefined,
        href,
        tone: 'bad',
      });
    }
  }

  for (const v of visits) {
    const href = `/jobs/${v.job.id}`;
    if (v.status === 'COMPLETED') {
      const notes = [v.signedByName ? `Signed off by ${v.signedByName}` : null, v.completionNotes ? snippet(v.completionNotes) : null].filter(Boolean).join(' · ');
      events.push({
        id: `visit-${v.id}`,
        at: v.updatedAt,
        kind: 'visit',
        title: `Visit done for ${v.job.number}: ${v.job.title}`,
        detail: notes || undefined,
        href,
        tone: 'good',
      });
    } else {
      events.push({
        id: `visit-${v.id}`,
        at: v.updatedAt,
        kind: 'visit',
        title: `No access for the visit on ${v.job.number}`,
        detail: v.completionNotes ? snippet(v.completionNotes) : undefined,
        href,
        tone: 'bad',
      });
    }
  }

  for (const inv of invoices) {
    const href = `/invoices/${inv.id}`;
    const label = inv.number ?? 'Invoice';
    if (inv.kind === 'CREDIT_NOTE') {
      if (inv.issuedAt) events.push({ id: `inv-${inv.id}`, at: inv.issuedAt, kind: 'invoice', title: `Credit note ${label} issued, ${money(inv.totalCents)}`, href });
      continue;
    }
    if (inv.issuedAt) {
      events.push({
        id: `inv-${inv.id}`,
        at: inv.issuedAt,
        kind: 'invoice',
        title: `${inv.isDeposit ? 'Deposit invoice' : 'Invoice'} ${label} issued, ${money(inv.totalCents)}`,
        href,
      });
    }
    if (inv.status === 'VOID') {
      events.push({ id: `inv-void-${inv.id}`, at: inv.updatedAt, kind: 'invoice', title: `Invoice ${label} voided`, href, tone: 'bad' });
    }
    const owing = invoiceBalanceCents(inv);
    if ((inv.status === 'SENT' || inv.status === 'PARTIALLY_PAID') && inv.dueAt && inv.dueAt < now && owing > 0) {
      events.push({ id: `inv-overdue-${inv.id}`, at: inv.dueAt, kind: 'invoice', title: `Invoice ${label} became overdue, ${money(owing)} still owing`, href, tone: 'bad' });
    }
  }

  for (const p of payments) {
    const href = `/invoices/${p.invoice.id}`;
    const method = METHOD_LABEL[p.method] ?? p.method;
    const on = p.invoice.number ? ` on ${p.invoice.number}` : '';
    const paidAt = p.receivedAt ?? p.createdAt;
    // Hand-entered payments are stored as midnight UTC of the day typed in; online ones carry a real time.
    const dateOnly = paidAt.getUTCHours() === 0 && paidAt.getUTCMinutes() === 0 && paidAt.getUTCSeconds() === 0 && paidAt.getUTCMilliseconds() === 0;
    const refund = p.amountCents < 0;
    events.push({
      id: `pay-${p.id}`,
      at: paidAt,
      kind: 'payment',
      title: refund ? `Refunded ${money(-p.amountCents)} by ${method}${on}` : `Paid ${money(p.amountCents)} by ${method}${on}`,
      detail: p.reference ? `Ref: ${p.reference}` : undefined,
      href,
      tone: refund ? undefined : 'good',
      dateOnly,
    });
    if (p.reversedAt) {
      // A reversal can't come before the payment it undoes, even when the payment only has a date.
      const clamped = p.reversedAt <= paidAt;
      events.push({
        id: `pay-rev-${p.id}`,
        at: clamped ? new Date(paidAt.getTime() + 1) : p.reversedAt, // +1ms keeps it sorted just after the payment
        kind: 'payment',
        title: `Payment of ${money(Math.abs(p.amountCents))}${on} reversed`,
        href,
        tone: 'bad',
        dateOnly: dateOnly && clamped,
      });
    }
  }

  for (const r of recipients) {
    const b = r.broadcast;
    events.push({
      id: `broadcast-${r.id}`,
      at: r.sentAt!,
      kind: 'message',
      title: `${b.kind === 'PROMOTION' ? 'Promotion' : 'Service notice'} sent by ${b.channel === 'EMAIL' ? 'email' : 'WhatsApp'}`,
      detail: `“${snippet(b.body)}”`,
      href: `/messages/${b.id}`,
    });
  }

  const past = events.filter((e) => e.at <= now).sort((a, b) => b.at.getTime() - a.at.getTime());
  return { events: past.slice(0, MAX_EVENTS), truncated: past.length > MAX_EVENTS };
}

/** Scheduled visits still to come, soonest first — shown above the timeline, not in it. */
export async function upcomingVisits(db: TenantDb, clientId: string) {
  return db.visit.findMany({
    where: { job: { clientId }, status: { in: ['SCHEDULED', 'EN_ROUTE', 'ON_SITE'] }, endsAt: { gte: new Date() } },
    include: { job: { select: { id: true, number: true, title: true } } },
    orderBy: { startsAt: 'asc' },
    take: 5,
  });
}
