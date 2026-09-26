import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const DEFAULT_INVOICE_PREFIX = 'INV-';
export const INVOICE_PREFIX_RE = /^[A-Za-z0-9/-]{0,10}$/;
export const MAX_INVOICE_NUMBER = 9_999_999;

export type InvoiceNumbering = { prefix: string; next: number; locked: boolean };

/** The business's invoice prefix and next number, and whether they're locked (an invoice has been issued). */
export async function getInvoiceNumbering(tenantId: string): Promise<InvoiceNumbering> {
  const [seq, issued] = await Promise.all([
    prisma.documentSequence.findUnique({ where: { tenantId_docType: { tenantId, docType: 'INVOICE' } } }),
    prisma.invoice.count({ where: { tenantId, number: { not: null } } }),
  ]);
  return { prefix: seq?.prefix ?? DEFAULT_INVOICE_PREFIX, next: seq?.next ?? 1, locked: issued > 0 };
}

/**
 * Sets the prefix and next number, but only while no invoice has been issued.
 * Locks the sequence row first: issuing an invoice takes the same lock, so a
 * settings save and an issue happening at the same moment can't interleave
 * and produce a duplicate or out-of-order number.
 */
export async function setInvoiceNumbering(
  tx: Prisma.TransactionClient,
  tenantId: string,
  prefix: string,
  next: number
): Promise<{ error: string } | null> {
  await tx.$executeRaw`
    INSERT INTO "DocumentSequence" ("tenantId", "docType", "prefix", "next")
    VALUES (${tenantId}, 'INVOICE', ${DEFAULT_INVOICE_PREFIX}, 1)
    ON CONFLICT DO NOTHING`;
  const [current] = await tx.$queryRaw<{ prefix: string; next: number }[]>`
    SELECT "prefix", "next" FROM "DocumentSequence"
    WHERE "tenantId" = ${tenantId} AND "docType" = 'INVOICE'
    FOR UPDATE`;

  if (current.prefix === prefix && current.next === next) return null;

  const issued = await tx.invoice.count({ where: { tenantId, number: { not: null } } });
  if (issued > 0) return { error: 'Invoice numbering can’t be changed once an invoice has been issued.' };

  await tx.documentSequence.update({
    where: { tenantId_docType: { tenantId, docType: 'INVOICE' } },
    data: { prefix, next },
  });
  return null;
}
