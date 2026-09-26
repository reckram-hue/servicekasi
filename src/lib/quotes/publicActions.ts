'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { documentTotals } from '@/lib/money';
import { isValidUntilPassed } from '@/lib/dates';

export type PublicFormState = { error?: string; ok?: boolean } | undefined;

const TokenSchema = z.string().uuid();
const RESPONDABLE = ['SENT', 'CHANGES_REQUESTED'] as const;
const NAME_MAX = 100;
const MESSAGE_MAX = 2000;
const STALE_ERROR = 'This quote has been updated since you opened it. Please reload the page to see the latest version.';

class StaleQuoteError extends Error {}

async function clientIp(): Promise<string | undefined> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || undefined;
  return ip?.slice(0, 64);
}

/**
 * Loads a quote by its public token and checks a client may still respond to
 * it. There is no session here, only the unguessable token, so every action
 * re-checks status and expiry itself rather than trusting the rendered page.
 */
async function loadActionableQuote(token: string) {
  const quote = await prisma.quote.findUnique({
    where: { publicToken: token },
    include: { lines: true },
  });
  if (!quote) return { error: 'Quote not found.' } as const;
  if (!(RESPONDABLE as readonly string[]).includes(quote.status)) {
    return { error: 'This quote is no longer available to respond to.' } as const;
  }
  if (isValidUntilPassed(quote.validUntil)) {
    return { error: 'This quote has expired. Please contact us for an updated quote.' } as const;
  }
  return { quote } as const;
}

export async function approveQuoteAction(_: PublicFormState, formData: FormData): Promise<PublicFormState> {
  const token = TokenSchema.safeParse(formData.get('token'));
  if (!token.success) return { error: 'Invalid quote link.' };

  const name = String(formData.get('name') ?? '').trim();
  const accepted = formData.get('accepted') === 'on';
  if (name.length < 2) return { error: 'Please enter your name.' };
  if (name.length > NAME_MAX) return { error: `Please keep your name under ${NAME_MAX} characters.` };
  if (!accepted) return { error: 'Please tick to confirm you accept this quote.' };

  const result = await loadActionableQuote(token.data);
  if ('error' in result) return { error: result.error };
  const { quote } = result;

  // The client must be approving exactly the version they were shown. If the
  // business edited or re-sent the quote since the page loaded, refuse.
  if (String(formData.get('version') ?? '') !== quote.updatedAt.toISOString()) return { error: STALE_ERROR };

  let selectedIds: string[] = [];
  try {
    selectedIds = z.array(z.string().uuid()).max(500).parse(JSON.parse(String(formData.get('selectedLineIds') ?? '[]')));
  } catch {
    return { error: 'Something went wrong reading your selection. Please try again.' };
  }
  const selectedSet = new Set(selectedIds);

  // Non-optional lines are always included, no matter what the client submits.
  const updatedLines = quote.lines.map((line) => ({
    ...line,
    selected: line.optional ? selectedSet.has(line.id) : true,
  }));

  const totals = documentTotals(
    updatedLines.map((l) => ({
      quantity: Number(l.quantity),
      unitPriceCents: l.unitPriceCents,
      taxRateBp: l.taxRateBp,
      optional: l.optional,
      selected: l.selected,
    }))
  );

  const ip = await clientIp();

  try {
    await prisma.$transaction(async (tx) => {
      // Conditional on status AND version, so a double-click, a simultaneous
      // decline, or an edit landing mid-request can never produce two outcomes.
      const res = await tx.quote.updateMany({
        where: { id: quote.id, status: { in: [...RESPONDABLE] }, updatedAt: quote.updatedAt },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedByName: name,
          approvedIp: ip,
          subtotalCents: totals.subtotalCents,
          taxCents: totals.taxCents,
          totalCents: totals.totalCents,
          depositCents: quote.depositPercent ? Math.round((totals.totalCents * quote.depositPercent) / 100) : quote.depositCents,
        },
      });
      if (res.count !== 1) throw new StaleQuoteError();

      for (const l of updatedLines) {
        await tx.lineItem.updateMany({ where: { id: l.id, quoteId: quote.id }, data: { selected: l.selected } });
      }
    });
  } catch (err) {
    if (err instanceof StaleQuoteError) return { error: STALE_ERROR };
    throw err;
  }

  return { ok: true };
}

export async function requestQuoteChangesAction(_: PublicFormState, formData: FormData): Promise<PublicFormState> {
  const token = TokenSchema.safeParse(formData.get('token'));
  if (!token.success) return { error: 'Invalid quote link.' };

  const message = String(formData.get('message') ?? '').trim();
  if (message.length < 3) return { error: 'Please describe what you would like changed.' };
  if (message.length > MESSAGE_MAX) return { error: `Please keep your message under ${MESSAGE_MAX} characters.` };

  const result = await loadActionableQuote(token.data);
  if ('error' in result) return { error: result.error };

  const res = await prisma.quote.updateMany({
    where: { id: result.quote.id, status: { in: [...RESPONDABLE] } },
    data: { status: 'CHANGES_REQUESTED', clientMessage: message },
  });
  if (res.count !== 1) return { error: 'This quote is no longer available to respond to.' };

  return { ok: true };
}

export async function declineQuoteAction(_: PublicFormState, formData: FormData): Promise<PublicFormState> {
  const token = TokenSchema.safeParse(formData.get('token'));
  if (!token.success) return { error: 'Invalid quote link.' };

  const message = String(formData.get('message') ?? '').trim();
  if (message.length > MESSAGE_MAX) return { error: `Please keep your message under ${MESSAGE_MAX} characters.` };

  const result = await loadActionableQuote(token.data);
  if ('error' in result) return { error: result.error };

  const res = await prisma.quote.updateMany({
    where: { id: result.quote.id, status: { in: [...RESPONDABLE] } },
    data: { status: 'DECLINED', clientMessage: message || null },
  });
  if (res.count !== 1) return { error: 'This quote is no longer available to respond to.' };

  return { ok: true };
}
