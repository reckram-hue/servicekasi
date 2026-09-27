import 'server-only';
import { Prisma, type Job } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { tenantDb } from '@/lib/db';
import { addDaysToDateStr, todayDateStr, zonedDateTime } from '@/lib/dates';
import { occurrences } from '@/lib/recurrence';
import { syncJobStatus } from '@/lib/jobs/status';

/** How far ahead recurring visits are put on the calendar. */
export const GENERATE_AHEAD_DAYS = 56;

type RecurringFields = Pick<
  Job,
  | 'id'
  | 'tenantId'
  | 'status'
  | 'recurrenceRule'
  | 'recurrenceStart'
  | 'recurrenceEnds'
  | 'recurrenceStartTime'
  | 'recurrenceEndTime'
  | 'recurrenceTechnicianIds'
  | 'recurrenceInstructions'
  | 'recurrenceGeneratedUntil'
>;

/** The contract's last date as "YYYY-MM-DD" (stored as UTC midnight of that date), or null if open-ended. */
export function recurrenceEndsStr(job: Pick<Job, 'recurrenceEnds'>): string | null {
  return job.recurrenceEnds ? job.recurrenceEnds.toISOString().slice(0, 10) : null;
}

/**
 * Creates any missing visits for one recurring job, from today up to
 * GENERATE_AHEAD_DAYS ahead (or the contract end). Safe to call as often as
 * you like, including twice at once: each visit remembers the date the rule
 * produced (`occurrenceDate`, unique per job), so a date that already has a
 * visit — even one that was moved or skipped — is never generated again.
 * Past dates are never back-filled.
 */
export async function generateVisitsForJob(job: RecurringFields, today: string): Promise<number> {
  const { recurrenceRule: rule, recurrenceStart: start, recurrenceStartTime: startTime, recurrenceEndTime: endTime } = job;
  if (!rule || !start || !startTime || !endTime) return 0;
  if (job.status === 'CANCELLED' || job.status === 'COMPLETED' || job.status === 'ON_HOLD') return 0;

  const horizon = addDaysToDateStr(today, GENERATE_AHEAD_DAYS);
  const ends = recurrenceEndsStr(job);
  const to = ends && ends < horizon ? ends : horizon;
  const resumeFrom = job.recurrenceGeneratedUntil ? addDaysToDateStr(job.recurrenceGeneratedUntil, 1) : start;
  const from = resumeFrom > today ? resumeFrom : today;

  let created = 0;
  const dates = from <= to ? occurrences(rule, start, from, to) : [];
  if (dates.length > 0) {
    // Someone may have left since the contract was set up; don't assign visits to them.
    const technicians = await prisma.membership.findMany({
      where: { tenantId: job.tenantId, id: { in: job.recurrenceTechnicianIds }, OR: [{ role: 'TECHNICIAN' }, { doesFieldwork: true }], active: true },
      select: { id: true },
    });

    for (const date of dates) {
      try {
        await prisma.visit.create({
          data: {
            tenantId: job.tenantId,
            jobId: job.id,
            occurrenceDate: date,
            startsAt: zonedDateTime(date, startTime),
            endsAt: zonedDateTime(date, endTime),
            instructions: job.recurrenceInstructions || undefined,
            assignments: { create: technicians.map((t) => ({ membershipId: t.id })) },
          },
        });
        created++;
      } catch (err) {
        // Another request generated this date a moment ago — that's fine.
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
      }
    }
  }

  if (!job.recurrenceGeneratedUntil || to > job.recurrenceGeneratedUntil) {
    await prisma.job.update({ where: { id: job.id }, data: { recurrenceGeneratedUntil: to } });
  }
  if (created > 0) await prisma.$transaction((tx) => syncJobStatus(tx, job.id));
  return created;
}

/**
 * Tops up every recurring job in a business. Called when the schedule, a job
 * or a technician's day is opened, so the calendar stays filled without a
 * background worker. Cheap when nothing is due: one query.
 */
export async function topUpRecurringVisits(tenantId: string, timeZone: string): Promise<void> {
  const today = todayDateStr(timeZone);
  const horizon = addDaysToDateStr(today, GENERATE_AHEAD_DAYS);

  const jobs = await tenantDb(tenantId).job.findMany({
    where: {
      recurrenceRule: { not: null },
      status: { notIn: ['CANCELLED', 'COMPLETED'] },
      OR: [{ recurrenceGeneratedUntil: null }, { recurrenceGeneratedUntil: { lt: horizon } }],
    },
  });
  for (const job of jobs) await generateVisitsForJob(job, today);
}
