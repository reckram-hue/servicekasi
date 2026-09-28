'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { ClientSchema } from './schema';
import { createClient, normalizePhone } from './create';

export type ImportFormState = { error?: string; ok?: string } | undefined;

// A row that's clearly wrong (unreadable file, pasted the wrong thing) is one
// thing; a genuinely huge file is another — split it rather than time out.
const MAX_ROWS = 500;

/**
 * Imports clients parsed from a CSV on the client side (docs/plans/onboarding.md,
 * "Later: CSV client import"). Each row goes through the same ClientSchema and
 * createClient used by the single "Add client" form, so an imported client is
 * indistinguishable from a hand-typed one. A row matching an existing client's
 * phone or email is skipped rather than creating a duplicate.
 */
export async function importClientsAction(_: ImportFormState, formData: FormData): Promise<ImportFormState> {
  const { tenant } = await requireRole();

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get('rows') ?? '[]'));
  } catch {
    return { error: 'Something went wrong reading that file. Please choose it again.' };
  }
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'No rows to import.' };
  if (raw.length > MAX_ROWS) return { error: `That's more than ${MAX_ROWS} rows — split the file and import in batches.` };

  const db = tenantDb(tenant.id);
  let imported = 0;
  let skippedDuplicates = 0;
  let skippedInvalid = 0;

  for (const row of raw) {
    const parsed = ClientSchema.safeParse({ ...(row as object), preferredLanguage: 'en' });
    if (!parsed.success) {
      skippedInvalid++;
      continue;
    }
    const d = parsed.data;

    const normalizedPhone = normalizePhone(d.phone);
    const conditions = [normalizedPhone ? { phone: normalizedPhone } : null, d.email ? { email: d.email } : null].filter(
      (c): c is { phone: string } | { email: string } => c !== null
    );
    const existing = conditions.length > 0 ? await db.client.findFirst({ where: { OR: conditions } }) : null;
    if (existing) {
      skippedDuplicates++;
      continue;
    }

    await createClient(db, tenant, d);
    imported++;
  }

  revalidatePath('/clients');

  const parts = [`Imported ${imported} client${imported === 1 ? '' : 's'}.`];
  if (skippedDuplicates) parts.push(`Skipped ${skippedDuplicates} already in your clients.`);
  if (skippedInvalid) parts.push(`${skippedInvalid} row${skippedInvalid === 1 ? '' : 's'} couldn't be read and ${skippedInvalid === 1 ? 'was' : 'were'} skipped.`);
  return { ok: parts.join(' ') };
}
