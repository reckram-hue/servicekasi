'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { JobPriority, type JobStatus, type Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { tenantDb, nextDocumentNumber, type TenantDb } from '@/lib/db';
import { requireRole } from '@/lib/auth/session';
import { zonedDateTime } from '@/lib/dates';

export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined>; ok?: string } | undefined;

const JobFormSchema = z.object({
  clientId: z.string().uuid({ error: 'Choose a client.' }),
  propertyId: z.union([z.string().uuid(), z.literal('')]).optional(),
  title: z.string().trim().min(1, { error: 'Enter a title.' }),
  description: z.string().trim().optional(),
  category: z.string().trim().optional(),
  priority: z.enum(JobPriority),
});

export async function createJobAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant } = await requireRole();
  const parsed = JobFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  const client = await prisma.client.findFirst({ where: { id: d.clientId, tenantId: tenant.id } });
  if (!client) return { error: 'Client not found.' };
  if (d.propertyId) {
    const property = await prisma.property.findFirst({ where: { id: d.propertyId, tenantId: tenant.id, clientId: d.clientId } });
    if (!property) return { error: 'Property not found for this client.' };
  }

  const job = await prisma.$transaction(async (tx) => {
    const number = await nextDocumentNumber(tx, tenant.id, 'JOB');
    return tx.job.create({
      data: {
        tenantId: tenant.id,
        number,
        clientId: d.clientId,
        propertyId: d.propertyId || undefined,
        title: d.title,
        description: d.description || undefined,
        category: d.category || undefined,
        priority: d.priority,
      },
    });
  });

  revalidatePath('/jobs');
  redirect(`/jobs/${job.id}`);
}

/** "Convert to job" on an approved quote: copies client, property and only the lines the client kept ticked. */
export async function convertQuoteToJobAction(formData: FormData): Promise<void> {
  const { tenant } = await requireRole();
  const quoteId = String(formData.get('quoteId') ?? '');

  const db = tenantDb(tenant.id);
  const quote = await db.quote.findUnique({ where: { id: quoteId }, include: { lines: true } });
  if (!quote || quote.status !== 'APPROVED') return;

  const selectedLines = quote.lines.filter((l) => l.selected);

  const job = await prisma.$transaction(async (tx) => {
    const number = await nextDocumentNumber(tx, tenant.id, 'JOB');
    const created = await tx.job.create({
      data: {
        tenantId: tenant.id,
        number,
        clientId: quote.clientId,
        propertyId: quote.propertyId,
        quoteId: quote.id,
        requestId: quote.requestId,
        title: quote.title,
        lines: {
          create: selectedLines.map((l, i) => ({
            catalogItemId: l.catalogItemId ?? undefined,
            type: l.type,
            description: l.description,
            quantity: l.quantity,
            unitCostCents: l.unitCostCents,
            unitPriceCents: l.unitPriceCents,
            taxRateBp: l.taxRateBp,
            sortOrder: i,
          })),
        },
      },
    });
    await tx.quote.update({ where: { id: quote.id }, data: { status: 'CONVERTED' } });
    return created;
  });

  revalidatePath('/quotes');
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath('/jobs');
  redirect(`/jobs/${job.id}`);
}

/**
 * Recomputes a job's status from its (non-cancelled) visits, per the rule:
 * any visit scheduled → SCHEDULED; any on site → IN_PROGRESS; all complete →
 * REQUIRES_INVOICING. Never touches a job that's already been cancelled or
 * fully completed (invoiced) by hand.
 */
async function syncJobStatus(tx: Prisma.TransactionClient, jobId: string): Promise<void> {
  const job = await tx.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job || job.status === 'CANCELLED' || job.status === 'COMPLETED') return;

  const visits = await tx.visit.findMany({ where: { jobId }, select: { status: true } });
  const active = visits.filter((v) => v.status !== 'CANCELLED');

  let status: JobStatus;
  if (active.length === 0) status = 'DRAFT';
  else if (active.every((v) => v.status === 'COMPLETED')) status = 'REQUIRES_INVOICING';
  else if (active.some((v) => v.status === 'ON_SITE')) status = 'IN_PROGRESS';
  else status = 'SCHEDULED';

  if (job.status !== status) await tx.job.update({ where: { id: jobId }, data: { status } });
}

const AddVisitFormSchema = z.object({
  jobId: z.string().uuid(),
  date: z.iso.date({ error: 'Choose a date.' }),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, { error: 'Choose a start time.' }),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, { error: 'Choose an end time.' }),
  instructions: z.string().trim().optional(),
  technicianIdsJson: z.string(),
});

export async function addVisitAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant } = await requireRole();
  const parsed = AddVisitFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  let technicianIds: string[] = [];
  try {
    technicianIds = z.array(z.string().uuid()).min(1).parse(JSON.parse(d.technicianIdsJson));
  } catch {
    return { error: 'Assign at least one technician.' };
  }

  const db = tenantDb(tenant.id);
  const [job, technicians] = await Promise.all([
    db.job.findUnique({ where: { id: d.jobId } }),
    db.membership.findMany({ where: { id: { in: technicianIds }, role: 'TECHNICIAN' } }),
  ]);
  if (!job) return { error: 'Job not found.' };
  if (technicians.length !== technicianIds.length) return { error: 'One or more technicians could not be found.' };

  const startsAt = zonedDateTime(d.date, d.startTime);
  const endsAt = zonedDateTime(d.date, d.endTime);
  if (endsAt <= startsAt) return { error: 'End time must be after the start time.' };

  await prisma.$transaction(async (tx) => {
    await tx.visit.create({
      data: {
        tenantId: tenant.id,
        jobId: d.jobId,
        startsAt,
        endsAt,
        instructions: d.instructions || undefined,
        assignments: { create: technicianIds.map((membershipId) => ({ membershipId })) },
      },
    });
    await syncJobStatus(tx, d.jobId);
  });

  revalidatePath(`/jobs/${d.jobId}`);
  revalidatePath('/jobs');
  revalidatePath('/schedule');
  return { ok: 'Visit scheduled.' };
}

export async function cancelVisitAction(formData: FormData): Promise<void> {
  const { tenant } = await requireRole();
  const visitId = String(formData.get('visitId') ?? '');
  const jobId = String(formData.get('jobId') ?? '');

  const db = tenantDb(tenant.id);
  const visit = await db.visit.findUnique({ where: { id: visitId } });
  if (!visit || visit.jobId !== jobId) return;

  await prisma.$transaction(async (tx) => {
    await tx.visit.update({ where: { id: visitId }, data: { status: 'CANCELLED' } });
    await syncJobStatus(tx, jobId);
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/jobs');
  revalidatePath('/schedule');
}

// ───────────────────── Technician's day (Step 7) ─────────────────────

const NOTES_MAX = 2000;

/** A visit the calling technician is actually assigned to, or null (wrong visit, not theirs, or gone). */
async function loadOwnVisit(db: TenantDb, visitId: string, membershipId: string) {
  const visit = await db.visit.findUnique({ where: { id: visitId }, include: { assignments: true } });
  if (!visit || !visit.assignments.some((a) => a.membershipId === membershipId)) return null;
  return visit;
}

function revalidateVisit(jobId: string) {
  revalidatePath('/');
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/jobs');
  revalidatePath('/schedule');
}

export async function startTravelAction(formData: FormData): Promise<void> {
  const { tenant, membership } = await requireRole(['TECHNICIAN']);
  const visitId = String(formData.get('visitId') ?? '');

  const db = tenantDb(tenant.id);
  const visit = await loadOwnVisit(db, visitId, membership.id);
  if (!visit || (visit.status !== 'SCHEDULED' && visit.status !== 'EN_ROUTE')) return;

  await db.visit.update({ where: { id: visitId }, data: { status: 'EN_ROUTE' } });
  revalidateVisit(visit.jobId);
}

export async function arriveAction(formData: FormData): Promise<void> {
  const { tenant, membership } = await requireRole(['TECHNICIAN']);
  const visitId = String(formData.get('visitId') ?? '');

  const db = tenantDb(tenant.id);
  const visit = await loadOwnVisit(db, visitId, membership.id);
  if (!visit || (visit.status !== 'SCHEDULED' && visit.status !== 'EN_ROUTE')) return;

  await prisma.$transaction(async (tx) => {
    await tx.visit.update({ where: { id: visitId }, data: { status: 'ON_SITE' } });
    await syncJobStatus(tx, visit.jobId);
  });
  revalidateVisit(visit.jobId);
}

export async function completeVisitAction(formData: FormData): Promise<void> {
  const { tenant, membership } = await requireRole(['TECHNICIAN']);
  const visitId = String(formData.get('visitId') ?? '');
  const notes = String(formData.get('notes') ?? '').trim().slice(0, NOTES_MAX);

  const db = tenantDb(tenant.id);
  const visit = await loadOwnVisit(db, visitId, membership.id);
  if (!visit || visit.status === 'COMPLETED' || visit.status === 'CANCELLED') return;

  await prisma.$transaction(async (tx) => {
    await tx.visit.update({ where: { id: visitId }, data: { status: 'COMPLETED', completionNotes: notes || undefined } });
    await syncJobStatus(tx, visit.jobId);
  });
  revalidateVisit(visit.jobId);
}

export async function markNoAccessAction(formData: FormData): Promise<void> {
  const { tenant, membership } = await requireRole(['TECHNICIAN']);
  const visitId = String(formData.get('visitId') ?? '');
  const notes = String(formData.get('notes') ?? '').trim().slice(0, NOTES_MAX);

  const db = tenantDb(tenant.id);
  const visit = await loadOwnVisit(db, visitId, membership.id);
  if (!visit || visit.status === 'COMPLETED' || visit.status === 'CANCELLED') return;

  await prisma.$transaction(async (tx) => {
    await tx.visit.update({ where: { id: visitId }, data: { status: 'NO_ACCESS', completionNotes: notes || undefined } });
    await syncJobStatus(tx, visit.jobId);
  });
  revalidateVisit(visit.jobId);
}
