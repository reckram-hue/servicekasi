import 'server-only';
import type { Industry } from '@prisma/client';
import type { TenantDb } from '@/lib/db';
import { STARTER_PRICE_LISTS } from './industries';

/** Rows ready for `catalogItem.createMany`, minus `tenantId`. */
export function starterItemRows(industry: Industry, skipNames: Iterable<string> = []) {
  const skip = new Set([...skipNames].map((n) => n.trim().toLowerCase()));
  return STARTER_PRICE_LISTS[industry]
    .filter((item) => !skip.has(item.name.toLowerCase()))
    .map((item) => ({
      type: item.type,
      name: item.name,
      unitPriceCents: Math.round(item.priceRands * 100),
      taxable: true,
    }));
}

/**
 * Adds a trade's starter items to a business's price list. Anything whose name
 * the business already has — including items it switched off — is left alone.
 */
export async function addStarterPriceList(db: TenantDb, tenantId: string, industry: Industry) {
  const existing = await db.catalogItem.findMany({ select: { name: true } });
  const rows = starterItemRows(
    industry,
    existing.map((i) => i.name)
  );
  if (rows.length > 0) {
    await db.catalogItem.createMany({ data: rows.map((r) => ({ ...r, tenantId })) });
  }
  return { added: rows.length, skipped: STARTER_PRICE_LISTS[industry].length - rows.length };
}
