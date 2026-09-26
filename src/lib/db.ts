import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Models that belong to a single business (Tenant). Every query against these
 * is forced to include `tenantId`, so a bug in a page or API route can never
 * leak one business's data to another.
 *
 * LineItem, VisitAssignment and MessageTranslation are reached only through
 * their tenant-scoped parent, so they are not listed here.
 */
const TENANT_MODELS = new Set<Prisma.ModelName>([
  'Membership',
  'Client',
  'Property',
  'CatalogItem',
  'ServiceRequest',
  'Quote',
  'Job',
  'Visit',
  'TimeEntry',
  'Attachment',
  'Invoice',
  'Payment',
  'DocumentSequence',
  'Conversation',
  'Message',
  'AuditLog',
]);

const WHERE_OPS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

/**
 * Returns a Prisma client locked to one tenant. Use this everywhere in app
 * code; the raw `prisma` client is only for platform-admin and auth code.
 *
 *   const db = tenantDb(session.tenantId);
 *   const clients = await db.client.findMany(); // only this tenant's clients
 */
export function tenantDb(tenantId: string) {
  if (!tenantId) throw new Error('tenantDb: tenantId is required');

  return prisma.$extends({
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model as Prisma.ModelName)) return query(args);

          const a = (args ?? {}) as Record<string, any>;

          if (WHERE_OPS.has(operation)) {
            a.where = { ...a.where, tenantId };
          } else if (operation === 'create') {
            a.data = { ...a.data, tenantId };
          } else if (operation === 'createMany') {
            const rows = Array.isArray(a.data) ? a.data : [a.data];
            a.data = rows.map((d: object) => ({ ...d, tenantId }));
          } else if (operation === 'upsert') {
            a.where = { ...a.where, tenantId };
            a.create = { ...a.create, tenantId };
          }

          return query(a);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof tenantDb>;

/**
 * Allocates the next gap-free document number ("INV-0042") inside a
 * transaction. Pass the transaction client so the number is rolled back if
 * the invoice/quote/job insert fails.
 */
export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  docType: 'QUOTE' | 'JOB' | 'INVOICE' | 'CREDIT_NOTE'
): Promise<string> {
  const defaults = { QUOTE: 'Q-', JOB: 'J-', INVOICE: 'INV-', CREDIT_NOTE: 'CN-' };
  const seq = await tx.documentSequence.upsert({
    where: { tenantId_docType: { tenantId, docType } },
    create: { tenantId, docType, prefix: defaults[docType], next: 2 },
    update: { next: { increment: 1 } },
  });
  return formatDocumentNumber(seq.prefix, seq.next - 1);
}

/** "INV-" + 458 → "INV-0458". */
export function formatDocumentNumber(prefix: string, n: number): string {
  return `${prefix}${String(n).padStart(4, '0')}`;
}
