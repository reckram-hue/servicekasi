import 'server-only';
import type { JobStatus, Prisma, VisitStatus } from '@prisma/client';
import { depositsCoverJob } from '@/lib/invoices/deposits';

/** Any visit scheduled → SCHEDULED; any on site → IN_PROGRESS; all complete → REQUIRES_INVOICING; none active → DRAFT. */
export function computeStatusFromVisits(visits: { status: VisitStatus }[]): JobStatus {
  const active = visits.filter((v) => v.status !== 'CANCELLED');
  if (active.length === 0) return 'DRAFT';
  if (active.every((v) => v.status === 'COMPLETED')) return 'REQUIRES_INVOICING';
  if (active.some((v) => v.status === 'ON_SITE')) return 'IN_PROGRESS';
  return 'SCHEDULED';
}

/**
 * Recomputes a job's status from its (non-cancelled) visits. Never touches a
 * job that's been cancelled or completed (invoiced) by hand, or paused —
 * a paused job stays put until it's explicitly resumed.
 */
export async function syncJobStatus(tx: Prisma.TransactionClient, jobId: string): Promise<void> {
  const job = await tx.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job || job.status === 'CANCELLED' || job.status === 'COMPLETED' || job.status === 'ON_HOLD') return;

  const visits = await tx.visit.findMany({ where: { jobId }, select: { status: true } });
  const status = computeStatusFromVisits(visits);
  if (job.status !== status) await tx.job.update({ where: { id: jobId }, data: { status } });
}

/**
 * Recomputes a job's status from its invoices, per decision: once all visits
 * are done and every issued invoice is paid, the job is COMPLETED; if a
 * payment is later reversed, it goes back to REQUIRES_INVOICING. Only touches
 * a job already in one of those two states — a job still being worked on (or
 * a deposit invoice paid mid-job) never jumps to COMPLETED early, and a
 * cancelled job is never touched.
 */
export async function syncJobInvoicingStatus(tx: Prisma.TransactionClient, jobId: string): Promise<void> {
  const job = await tx.job.findUnique({ where: { id: jobId }, select: { status: true, tenantId: true } });
  if (!job || (job.status !== 'REQUIRES_INVOICING' && job.status !== 'COMPLETED')) return;

  const invoices = await tx.invoice.findMany({
    where: { jobId, status: { not: 'VOID' }, kind: { not: 'CREDIT_NOTE' } },
    select: { status: true, isDeposit: true },
  });
  const issued = invoices.filter((i) => i.status !== 'DRAFT');
  // A paid deposit alone isn't the job invoiced: the final invoice must be issued and paid too,
  // unless the deposit covers all the work (e.g. 100%), when there's nothing left to bill.
  const invoiced = issued.some((i) => !i.isDeposit) || (issued.length > 0 && (await depositsCoverJob(tx, job.tenantId, jobId)));
  const allPaid = invoiced && issued.every((i) => i.status === 'PAID');

  const status: JobStatus = allPaid ? 'COMPLETED' : 'REQUIRES_INVOICING';
  if (job.status !== status) await tx.job.update({ where: { id: jobId }, data: { status } });
}
