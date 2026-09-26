'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { JobPriority } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { tenantDb, nextDocumentNumber, type TenantDb } from '@/lib/db';
import { requireRole } from '@/lib/auth/session';
import { todayDateStr, zonedDateTime } from '@/lib/dates';
import { buildRule } from '@/lib/recurrence';
import { syncJobStatus } from '@/lib/jobs/status';
import { generateVisitsForJob } from '@/lib/jobs/recurring';

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

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const AddVisitFormSchema = z.object({
  jobId: z.string().uuid(),
  date: z.iso.date({ error: 'Choose a date.' }),
  startTime: z.string().regex(TIME, { error: 'Choose a start time.' }),
  endTime: z.string().regex(TIME, { error: 'Choose an end time.' }),
  instructions: z.string().trim().max(2000).optional(),
  technicianIdsJson: z.string(),
});

/** Parses the form's technician list and checks every id is a technician in this business. */
async function validTechnicianIds(db: TenantDb, json: string): Promise<{ ids: string[] } | { error: string }> {
  let ids: string[];
  try {
    ids = [...new Set(z.array(z.string().uuid()).min(1).parse(JSON.parse(json)))];
  } catch {
    return { error: 'Assign at least one technician.' };
  }
  const found = await db.membership.count({ where: { id: { in: ids }, role: 'TECHNICIAN', active: true } });
  if (found !== ids.length) return { error: 'One or more technicians could not be found.' };
  return { ids };
}

export async function addVisitAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant } = await requireRole();
  const parsed = AddVisitFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  const db = tenantDb(tenant.id);
  const techs = await validTechnicianIds(db, d.technicianIdsJson);
  if ('error' in techs) return { error: techs.error };
  const technicianIds = techs.ids;

  const job = await db.job.findUnique({ where: { id: d.jobId } });
  if (!job) return { error: 'Job not found.' };

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

// ───────────────────── Editing visits & recurring jobs (Step 8) ─────────────────────

const UpdateVisitFormSchema = AddVisitFormSchema.omit({ jobId: true }).extend({ visitId: z.string().uuid() });

/** "This visit only": moves/reassigns one visit. A recurring visit keeps its occurrence date, so it isn't generated again. */
export async function updateVisitAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant } = await requireRole();
  const parsed = UpdateVisitFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  const db = tenantDb(tenant.id);
  const techs = await validTechnicianIds(db, d.technicianIdsJson);
  if ('error' in techs) return { error: techs.error };

  const visit = await db.visit.findUnique({ where: { id: d.visitId } });
  if (!visit) return { error: 'Visit not found.' };
  if (visit.status !== 'SCHEDULED') return { error: 'Only visits that haven’t started can be changed.' };

  const startsAt = zonedDateTime(d.date, d.startTime);
  const endsAt = zonedDateTime(d.date, d.endTime);
  if (endsAt <= startsAt) return { error: 'End time must be after the start time.' };

  await prisma.$transaction([
    prisma.visitAssignment.deleteMany({ where: { visitId: visit.id } }),
    prisma.visit.update({
      where: { id: visit.id },
      data: {
        startsAt,
        endsAt,
        instructions: d.instructions || null,
        assignments: { create: techs.ids.map((membershipId) => ({ membershipId })) },
      },
    }),
  ]);

  revalidateVisit(visit.jobId);
  return { ok: 'Visit updated.' };
}

const RecurrenceFormSchema = z.object({
  jobId: z.string().uuid(),
  pattern: z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY_DATE', 'MONTHLY_WEEKDAY'], { error: 'Choose how often.' }),
  firstDate: z.iso.date({ error: 'Choose the first visit date.' }),
  startTime: z.string().regex(TIME, { error: 'Choose a start time.' }),
  endTime: z.string().regex(TIME, { error: 'Choose an end time.' }),
  endsOn: z.union([z.iso.date(), z.literal('')]).optional(),
  instructions: z.string().trim().max(2000).optional(),
  technicianIdsJson: z.string(),
});

/**
 * Makes a job recurring, or changes "all future visits" of one that already is.
 *
 * - If the repeat pattern or first date changes, future visits that haven't
 *   started (including skipped ones) are removed and regenerated from the new rule.
 * - If only the time, technicians or instructions change, future visits are
 *   updated in place, so skipped dates stay skipped.
 * Visits from before today, and any already under way, are never touched.
 */
export async function setRecurrenceAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant } = await requireRole();
  const parsed = RecurrenceFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  const db = tenantDb(tenant.id);
  const techs = await validTechnicianIds(db, d.technicianIdsJson);
  if ('error' in techs) return { error: techs.error };

  const job = await db.job.findUnique({ where: { id: d.jobId } });
  if (!job) return { error: 'Job not found.' };
  if (job.status === 'CANCELLED' || job.status === 'COMPLETED') return { error: 'This job is closed.' };
  if (d.endTime <= d.startTime) return { error: 'End time must be after the start time.' };

  const built = buildRule(d.pattern, d.firstDate);
  if ('error' in built) return { error: built.error };

  const today = todayDateStr(tenant.timezone);
  const scheduleChanged = built.rule !== job.recurrenceRule || d.firstDate !== job.recurrenceStart;
  if (scheduleChanged && d.firstDate < today) return { error: 'The first visit can’t be in the past.' };
  const endsOn = d.endsOn || null;
  if (endsOn && endsOn < d.firstDate) return { error: 'The last date must be on or after the first visit.' };

  const NOT_STARTED = ['SCHEDULED', 'CANCELLED'] as const;

  await prisma.$transaction(async (tx) => {
    if (scheduleChanged) {
      await tx.visit.deleteMany({
        where: { jobId: job.id, occurrenceDate: { gte: today }, status: { in: [...NOT_STARTED] } },
      });
    } else {
      const future = await tx.visit.findMany({
        where: { jobId: job.id, occurrenceDate: { gte: today }, status: 'SCHEDULED' },
        select: { id: true, occurrenceDate: true },
      });
      for (const v of future) {
        await tx.visitAssignment.deleteMany({ where: { visitId: v.id } });
        await tx.visit.update({
          where: { id: v.id },
          data: {
            startsAt: zonedDateTime(v.occurrenceDate!, d.startTime),
            endsAt: zonedDateTime(v.occurrenceDate!, d.endTime),
            instructions: d.instructions || null,
            assignments: { create: techs.ids.map((membershipId) => ({ membershipId })) },
          },
        });
      }
    }

    if (endsOn) {
      await tx.visit.deleteMany({
        where: { jobId: job.id, occurrenceDate: { gt: endsOn }, status: { in: [...NOT_STARTED] } },
      });
    }

    await tx.job.update({
      where: { id: job.id },
      data: {
        recurrenceRule: built.rule,
        recurrenceStart: d.firstDate,
        recurrenceEnds: endsOn ? new Date(endsOn) : null,
        recurrenceStartTime: d.startTime,
        recurrenceEndTime: d.endTime,
        recurrenceTechnicianIds: techs.ids,
        recurrenceInstructions: d.instructions || null,
        // Wind the marker back to wherever visits were just removed, so they're regenerated if the dates come back.
        recurrenceGeneratedUntil: scheduleChanged ? null : earlierOf(job.recurrenceGeneratedUntil, endsOn),
      },
    });
    await syncJobStatus(tx, job.id);
  });

  const updated = await db.job.findUnique({ where: { id: job.id } });
  if (updated) await generateVisitsForJob(updated, today);

  revalidateVisit(job.id);
  return { ok: job.recurrenceRule ? 'Future visits updated.' : 'Repeat schedule saved — visits are on the calendar.' };
}

/** Winds a "generated until" marker back to a cut-off date, if it's past it. Null (nothing generated yet) stays null. */
function earlierOf(generatedUntil: string | null, cutOff: string | null): string | null {
  if (!generatedUntil || !cutOff) return generatedUntil;
  return cutOff < generatedUntil ? cutOff : generatedUntil;
}

/** Ends a recurring contract: keeps today's and past visits, removes later ones that haven't started. */
export async function stopRecurrenceAction(formData: FormData): Promise<void> {
  const { tenant } = await requireRole();
  const jobId = String(formData.get('jobId') ?? '');

  const db = tenantDb(tenant.id);
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job || !job.recurrenceRule) return;

  const today = todayDateStr(tenant.timezone);
  await prisma.$transaction(async (tx) => {
    await tx.visit.deleteMany({
      where: { jobId: job.id, occurrenceDate: { gt: today }, status: { in: ['SCHEDULED', 'CANCELLED'] } },
    });
    await tx.job.update({
      where: { id: job.id },
      data: { recurrenceEnds: new Date(today), recurrenceGeneratedUntil: earlierOf(job.recurrenceGeneratedUntil, today) },
    });
    await syncJobStatus(tx, job.id);
  });

  revalidateVisit(job.id);
}
