import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { templateSetup } from '@/lib/messaging/templates';
import { WhatsAppTemplatesForm } from '@/components/messaging/WhatsAppTemplatesForm';

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ preset?: string }> }) {
  const { tenant } = await requireRole(['OWNER', 'ADMIN']);
  const { preset } = await searchParams;
  const setup = templateSetup(tenant, preset);
  return <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100"><div className="mx-auto max-w-2xl">
    <Link href="/messages" className="text-sm text-amber-400 hover:underline">← Messages</Link>
    <h1 className="mt-3 mb-2 text-2xl font-bold">WhatsApp templates</h1>
    <p className="mb-6 text-sm text-slate-400">Four shared messages for {tenant.businessName}. Choose one from a customer’s profile, personalise it, then copy it or open WhatsApp. Available on every ServiceKasi package.</p>
    <WhatsAppTemplatesForm initialTemplates={setup.templates} initialReviewUrl={setup.reviewUrl} business={tenant.tradingName || tenant.businessName} ecoDraft={setup.ecoDraft} />
  </div></div>;
}
