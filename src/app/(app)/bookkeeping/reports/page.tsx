import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { canUse, minimumPlanFor, PLAN_LABEL, type Feature } from '@/lib/plans/plans';
import { UpgradeBadge } from '@/components/plans/UpgradeBadge';

function ReportLink({ href, title, hint, unlocked, feature }: { href: string; title: string; hint: string; unlocked: boolean; feature: Feature }) {
  if (!unlocked) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4 opacity-70">
        <div>
          <div className="font-medium">{title}</div>
          <div className="text-sm text-slate-500">{hint}</div>
        </div>
        <UpgradeBadge plan={PLAN_LABEL[minimumPlanFor(feature)]} />
      </div>
    );
  }
  return (
    <Link href={href} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 p-4 hover:border-slate-600">
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-sm text-slate-500">{hint}</div>
      </div>
      <span className="text-slate-500">→</span>
    </Link>
  );
}

export default async function ReportsPage() {
  const { tenant } = await requireRole();

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

          {tenant.vatRegistered && (
            <ReportLink
              href="/bookkeeping/reports/vat"
              title="VAT summary"
              hint="Output and input VAT for your VAT201"
              unlocked={canUse(tenant, 'vatSummary')}
              feature="vatSummary"
            />
          )}

          <ReportLink
            href="/bookkeeping/reports/creditors-aged"
            title="Creditors aged"
            hint="Who you owe, by how overdue it is"
            unlocked={canUse(tenant, 'creditors')}
            feature="creditors"
          />

          <ReportLink
            href="/bookkeeping/reports/debtors-aged"
            title="Debtors aged"
            hint="Who owes you, by how overdue it is"
            unlocked={canUse(tenant, 'debtorsAged')}
            feature="debtorsAged"
          />
        </div>
      </div>
    </div>
  );
}
