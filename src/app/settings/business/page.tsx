import Link from 'next/link';
import { requireRole } from '@/lib/auth/session';
import { BusinessSettingsForm } from '@/components/settings/BusinessSettingsForm';

export default async function BusinessSettingsPage() {
  const { tenant } = await requireRole(['OWNER', 'ADMIN']);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-amber-400 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 mb-6 text-2xl font-bold">Business settings</h1>
        <BusinessSettingsForm
          tenant={{
            businessName: tenant.businessName,
            tradingName: tenant.tradingName,
            vatRegistered: tenant.vatRegistered,
            vatNumber: tenant.vatNumber,
            // Default to the standard 15% rate when it's never been set, rather than showing 0%.
            vatRatePercent: tenant.defaultTaxRateBp > 0 ? tenant.defaultTaxRateBp / 100 : 15,
            companyRegNumber: tenant.companyRegNumber,
            phone: tenant.phone,
            email: tenant.email,
            addressLine1: tenant.addressLine1,
            addressLine2: tenant.addressLine2,
            city: tenant.city,
            region: tenant.region,
            postalCode: tenant.postalCode,
            bankName: tenant.bankName,
            bankAccountHolder: tenant.bankAccountHolder,
            bankAccountNumber: tenant.bankAccountNumber,
            bankBranchCode: tenant.bankBranchCode,
            quoteTerms: tenant.quoteTerms,
            defaultQuoteValidDays: tenant.defaultQuoteValidDays,
          }}
        />
      </div>
    </div>
  );
}
