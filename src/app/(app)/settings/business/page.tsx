import { headers } from 'next/headers';
import { requireRole } from '@/lib/auth/session';
import { BusinessSettingsForm } from '@/components/settings/BusinessSettingsForm';
import { BookingPageLink } from '@/components/settings/BookingPageLink';
import { getInvoiceNumbering } from '@/lib/invoices/numbering';

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const protocol = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

export default async function BusinessSettingsPage() {
  const { tenant } = await requireRole(['OWNER', 'ADMIN']);
  const [numbering, origin] = await Promise.all([getInvoiceNumbering(tenant.id), siteOrigin()]);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold">Business settings</h1>
        <BookingPageLink url={`${origin}/book/${tenant.slug}`} />
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
            invoiceTerms: tenant.invoiceTerms,
            defaultPaymentTermsDays: tenant.defaultPaymentTermsDays,
          }}
          invoiceNumbering={numbering}
        />
      </div>
    </div>
  );
}
