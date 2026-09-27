import 'server-only';
import { prisma } from '@/lib/prisma';

export type TrialEndSummary = {
  technicianCount: number;
  onlinePaymentsEnabled: boolean;
  onlinePaymentsReceived: number;
};

/** What the business used during the trial that's about to be locked — the "you'll miss this" moment. */
export async function trialEndSummary(tenantId: string): Promise<TrialEndSummary> {
  const [technicianCount, account, onlinePaymentsReceived] = await Promise.all([
    prisma.membership.count({ where: { tenantId, role: 'TECHNICIAN', active: true } }),
    prisma.paymentAccount.findFirst({ where: { tenantId, enabled: true } }),
    prisma.payment.count({ where: { tenantId, status: 'SUCCEEDED', method: { in: ['PAYFAST', 'YOCO', 'OZOW', 'PAYSTACK'] } } }),
  ]);
  return { technicianCount, onlinePaymentsEnabled: !!account, onlinePaymentsReceived };
}
