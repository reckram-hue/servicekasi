import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { AdminDashboard } from "@/components/AdminDashboard";
import { GettingStartedCard } from "@/components/onboarding/GettingStartedCard";
import { VoiceMemoRecorder } from "@/components/requests/VoiceMemoRecorder";
import type { DashboardJob } from "@/lib/jobs/dashboard";
import type { ChecklistItem } from "@/lib/onboarding/checklist";

type AppShellProps = {
  moneyOwed?: { outstandingCents: number; overdueCents: number; overdueCount: number; currencyCode: string };
  checklist?: ChecklistItem[];
  jobs: DashboardJob[];
  technicianCount: number;
  technicians: { id: string; name: string }[];
  voiceMemoAllowed: boolean;
  currencyCode: string;
  finance: { collectedCents: number; collectedVatCents: number; outstandingCents: number };
  activeDispatches: number;
  unassignedCount: number;
};

/** The dashboard's own content — the sidebar and page chrome around it live in the shared (app) layout. */
export function AppShell({
  moneyOwed,
  checklist,
  jobs,
  technicianCount,
  technicians,
  voiceMemoAllowed,
  currencyCode,
  finance,
  activeDispatches,
  unassignedCount,
}: AppShellProps) {
  return (
    <div className="p-6">
      {checklist && <GettingStartedCard items={checklist} />}
      <div className="mb-6">
        <VoiceMemoRecorder technicians={technicians} allowed={voiceMemoAllowed} />
      </div>
      {moneyOwed && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between text-xs text-slate-500">Outstanding</div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-100">
              {formatMoney(moneyOwed.outstandingCents, moneyOwed.currencyCode)}
            </div>
          </div>
          <Link href="/invoices/overdue" className="rounded-xl border border-slate-800 bg-slate-900 p-5 hover:border-slate-700">
            <div className="flex items-center justify-between text-xs text-slate-500">Overdue</div>
            <div className={`mt-1 font-mono text-2xl font-bold tabular-nums ${moneyOwed.overdueCents > 0 ? 'text-red-400' : 'text-slate-100'}`}>
              {formatMoney(moneyOwed.overdueCents, moneyOwed.currencyCode)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {moneyOwed.overdueCount === 0
                ? 'Nothing overdue'
                : `${moneyOwed.overdueCount} invoice${moneyOwed.overdueCount === 1 ? '' : 's'} · Send reminders →`}
            </div>
          </Link>
        </div>
      )}
      <AdminDashboard
        jobs={jobs}
        technicianCount={technicianCount}
        currencyCode={currencyCode}
        finance={finance}
        activeDispatches={activeDispatches}
        unassignedCount={unassignedCount}
      />
    </div>
  );
}
