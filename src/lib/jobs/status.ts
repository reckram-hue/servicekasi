import 'server-only';
import type { JobStatus, Prisma } from '@prisma/client';

/**
 * Recomputes a job's status from its (non-cancelled) visits, per the rule:
 * any visit scheduled → SCHEDULED; any on site → IN_PROGRESS; all complete →
 * REQUIRES_INVOICING. Never touches a job that's already been cancelled or
 * fully completed (invoiced) by hand.
 */
export async function syncJobStatus(tx: Prisma.TransactionClient, jobId: string): Promise<void> {
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

/**
 * Recomputes a job's status from its invoices, per decision: once all visits
 * are done and every issued invoice is paid, the job is COMPLETED; if a
 * payment is later reversed, it goes back to REQUIRES_INVOICING. Only touches
 * a job already in one of those two states — a job still being worked on (or
 * a deposit invoice paid mid-job) never jumps to COMPLETED early, and a
 * cancelled job is never touched.
 */
export async function syncJobInvoicingStatus(tx: Prisma.TransactionClient, jobId: string): Promise<void> {
  const job = await tx.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job || (job.status !== 'REQUIRES_INVOICING' && job.status !== 'COMPLETED')) return;

  const invoices = await tx.invoice.findMany({ where: { jobId, status: { not: 'VOID' } }, select: { status: true } });
  const issued = invoices.filter((i) => i.status !== 'DRAFT');
  const allPaid = issued.length > 0 && issued.every((i) => i.status === 'PAID');

  const status: JobStatus = allPaid ? 'COMPLETED' : 'REQUIRES_INVOICING';
  if (job.status !== status) await tx.job.update({ where: { id: jobId }, data: { status } });
}
