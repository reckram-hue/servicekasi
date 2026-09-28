'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { createClient } from '@/lib/clients/create';

/** A lead that isn't going anywhere — no client created, no note kept beyond the request itself. */
export async function dismissRequestAction(formData: FormData): Promise<void> {
  const { tenant } = await requireRole();
  const id = String(formData.get('id') ?? '');

  await tenantDb(tenant.id).serviceRequest.updateMany({ where: { id, status: 'NEW' }, data: { status: 'DISMISSED' } });
  revalidatePath('/requests');
}

/**
 * Turns a lead into a real client, using the name and phone they gave when
 * requesting a quote — so the owner never has to retype them. From there,
 * the existing "New quote" / "New job" buttons on the client take over.
 */
export async function addRequestAsClientAction(formData: FormData): Promise<void> {
  const { tenant } = await requireRole();
  const id = String(formData.get('id') ?? '');

  const db = tenantDb(tenant.id);
  const request = await db.serviceRequest.findUnique({ where: { id } });
  if (!request || request.status !== 'NEW') return;

  const [firstName, ...rest] = (request.contactName || 'New client').trim().split(/\s+/);
  const client = await createClient(db, tenant, {
    firstName,
    lastName: rest.join(' ') || undefined,
    phone: request.contactPhone || undefined,
    preferredLanguage: 'en',
    notes: request.description,
  });

  await db.serviceRequest.updateMany({ where: { id, status: 'NEW' }, data: { status: 'CONVERTED', clientId: client.id } });
  revalidatePath('/requests');
  // Straight to the new client, where "New quote" / "New job" are one click away.
  redirect(`/clients?q=${encodeURIComponent(client.phone ?? client.firstName)}`);
}
