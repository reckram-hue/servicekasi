import 'server-only';
import type { TenantDb } from '@/lib/db';

export async function openServiceRequests(db: TenantDb) {
  return db.serviceRequest.findMany({
    where: { status: 'NEW' },
    orderBy: { createdAt: 'desc' },
  });
}
