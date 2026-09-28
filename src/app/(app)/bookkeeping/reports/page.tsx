import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { canUse, minimumPlanFor, PLAN_LABEL } from '@/lib/plans/plans';
import { UpgradeBadge } from '@/components/plans/UpgradeBadge';

export default async function ReportsPage() {
  const { tenant } = await requireRole();
  const vatUnlocked = canUse(tenant, 'vatSummary');

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-md">
        <Link href="/bookkeeping" className="text-sm text-amber-400 hover:underline">
          ← Bookkeeping
        </Link>
        <h1 className="mt-2 mb-6 text-2xl font-bold">Reports</h1>

        <div className="space-y-3">
          <Link
            href="/bookkeeping/reports/profit-loss"
            className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4 hover:border-slate-600"
          >
            <div>
              <div className="font-medium">Profit &amp; loss</div>
              <div className="text-sm text-slate-500">Money in vs money out, by category</div>
            </div>
            <span className="text-slate-500">→</span>
          </Link>

          {tenant.vatRegistered &&
            (vatUnlocked ? (
              <Link
                href="/bookkeeping/reports/vat"
                className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4 hover:border-slate-600"
              >
                <div>
                  <div className="font-medium">VAT summary</div>
                  <div className="text-sm text-slate-500">Output and input VAT for your VAT201</div>
                </div>
                <span className="text-slate-500">→</span>
              </Link>
            ) : (
              <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4 opacity-70">
                <div>
                  <div className="font-medium">VAT summary</div>
                  <div className="text-sm text-slate-500">Output and input VAT for your VAT201</div>
                </div>
                <UpgradeBadge plan={PLAN_LABEL[minimumPlanFor('vatSummary')]} />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
