import 'server-only';
import JSZip from 'jszip';
import type { TenantDb } from '@/lib/db';
import { localDateStr } from '@/lib/dates';
import { readPublicFile } from '@/lib/storage';
import { JOURNAL_SOURCE_LABEL } from '@/lib/bookkeeping/labels';

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Every journal entry in the period as a CSV an accountant can open in Excel — the full double-entry ledger with real account codes. */
export async function journalCsv(db: TenantDb, start: Date, end: Date): Promise<string> {
  const entries = await db.journalEntry.findMany({
    where: { date: { gte: start, lt: end } },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    select: {
      date: true,
      memo: true,
      sourceType: true,
      amountCents: true,
      debitAccount: { select: { code: true, name: true } },
      creditAccount: { select: { code: true, name: true } },
    },
  });

  const header = ['Date', 'Memo', 'Type', 'Debit code', 'Debit account', 'Credit code', 'Credit account', 'Amount'];
  const rows = entries.map((e) =>
    [
      localDateStr(e.date, 'UTC'),
      csvField(e.memo),
      JOURNAL_SOURCE_LABEL[e.sourceType],
      e.debitAccount.code,
      csvField(e.debitAccount.name),
      e.creditAccount.code,
      csvField(e.creditAccount.name),
      (e.amountCents / 100).toFixed(2),
    ].join(',')
  );
  return [header.join(','), ...rows].join('\r\n');
}

/** How many expense and bill slip photos fall in the period — shown on the export page so a zip download isn't a surprise empty file. */
export async function slipPhotoCount(db: TenantDb, start: Date, end: Date): Promise<number> {
  const [expenses, bills] = await Promise.all([
    db.expense.count({ where: { date: { gte: start, lt: end }, slipUrl: { not: null } } }),
    db.bill.count({ where: { billDate: { gte: start, lt: end }, slipUrl: { not: null } } }),
  ]);
  return expenses + bills;
}

/** Bundles every expense and bill slip photo in the period into a zip, named so each file is traceable back to what it's a receipt for. */
export async function slipPhotosZip(db: TenantDb, start: Date, end: Date): Promise<Buffer> {
  const [expenses, bills] = await Promise.all([
    db.expense.findMany({
      where: { date: { gte: start, lt: end }, slipUrl: { not: null } },
      select: { date: true, supplier: true, slipUrl: true, slipMimeType: true },
    }),
    db.bill.findMany({
      where: { billDate: { gte: start, lt: end }, slipUrl: { not: null } },
      select: { billDate: true, supplier: true, slipUrl: true, slipMimeType: true },
    }),
  ]);

  const zip = new JSZip();
  const usedNames = new Set<string>();
  function uniqueName(base: string): string {
    let name = base;
    let n = 2;
    while (usedNames.has(name)) name = `${base} (${n++})`;
    usedNames.add(name);
    return name;
  }

  for (const e of expenses) {
    if (!e.slipUrl) continue;
    const ext = e.slipMimeType === 'image/png' ? 'png' : 'jpg';
    const base = `${localDateStr(e.date, 'UTC')} - ${e.supplier || 'expense'}`.slice(0, 80);
    try {
      zip.file(`expenses/${uniqueName(base)}.${ext}`, await readPublicFile(e.slipUrl));
    } catch {
      // a missing or unreachable photo shouldn't block the rest of the export
    }
  }
  for (const b of bills) {
    if (!b.slipUrl) continue;
    const ext = b.slipMimeType === 'image/png' ? 'png' : 'jpg';
    const base = `${localDateStr(b.billDate, 'UTC')} - ${b.supplier}`.slice(0, 80);
    try {
      zip.file(`bills/${uniqueName(base)}.${ext}`, await readPublicFile(b.slipUrl));
    } catch {
      // a missing or unreachable photo shouldn't block the rest of the export
    }
  }

  return zip.generateAsync({ type: 'nodebuffer' });
}
