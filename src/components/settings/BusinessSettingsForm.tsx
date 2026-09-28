'use client';

import { useActionState, useState } from 'react';
import { Checkbox, Field, FormMessage, SubmitButton, TextArea } from '@/components/auth/ui';
import { updateBusinessSettingsAction, type FormState } from '@/lib/settings/actions';
import type { InvoiceNumbering } from '@/lib/invoices/numbering';

export type BusinessDefaults = {
  businessName: string;
  tradingName: string | null;
  vatRegistered: boolean;
  vatNumber: string | null;
  vatRatePercent: number;
  companyRegNumber: string | null;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  bankName: string | null;
  bankAccountHolder: string | null;
  bankAccountNumber: string | null;
  bankBranchCode: string | null;
  quoteTerms: string | null;
  defaultQuoteValidDays: number;
  invoiceTerms: string | null;
  defaultPaymentTermsDays: number;
  googleReviewUrl: string | null;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mb-6 rounded-xl border border-slate-800 p-4">
      <legend className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">{title}</legend>
      {children}
    </fieldset>
  );
}

export function BusinessSettingsForm({
  tenant,
  invoiceNumbering,
}: {
  tenant: BusinessDefaults;
  invoiceNumbering: InvoiceNumbering;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateBusinessSettingsAction, undefined);
  const [vatRegistered, setVatRegistered] = useState(tenant.vatRegistered);
  const [prefix, setPrefix] = useState(invoiceNumbering.prefix);
  const [nextNumber, setNextNumber] = useState(String(invoiceNumbering.next));
  const previewNumber = /^\d+$/.test(nextNumber) ? `${prefix.trim()}${nextNumber.padStart(4, '0')}` : '—';
  const e = state?.fieldErrors;

  return (
    <form action={action}>
      <FormMessage error={state?.error} ok={state?.ok} />

      <Section title="Business">
        <Field label="Business name" name="businessName" required defaultValue={tenant.businessName} errors={e?.businessName} />
        <Field label="Trading name (optional)" name="tradingName" defaultValue={tenant.tradingName ?? ''} errors={e?.tradingName} />
        <Field
          label="Company registration number (optional)"
          name="companyRegNumber"
          placeholder="2019/123456/07"
          defaultValue={tenant.companyRegNumber ?? ''}
          errors={e?.companyRegNumber}
        />
        <div className="grid grid-cols-2 gap-x-3">
          <Field label="Phone" name="phone" type="tel" defaultValue={tenant.phone ?? ''} errors={e?.phone} />
          <Field label="Email" name="email" type="email" defaultValue={tenant.email ?? ''} errors={e?.email} />
        </div>
      </Section>

      <Section title="Address">
        <Field label="Address line 1" name="addressLine1" defaultValue={tenant.addressLine1 ?? ''} errors={e?.addressLine1} />
        <Field label="Address line 2" name="addressLine2" defaultValue={tenant.addressLine2 ?? ''} errors={e?.addressLine2} />
        <div className="grid grid-cols-3 gap-x-3">
          <Field label="City" name="city" defaultValue={tenant.city ?? ''} errors={e?.city} />
          <Field label="Province" name="region" defaultValue={tenant.region ?? ''} errors={e?.region} />
          <Field label="Postal code" name="postalCode" defaultValue={tenant.postalCode ?? ''} errors={e?.postalCode} />
        </div>
      </Section>

      <Section title="Tax">
        <Checkbox
          label="This business is registered for VAT"
          name="vatRegistered"
          defaultChecked={tenant.vatRegistered}
          onChange={(ev) => setVatRegistered(ev.target.checked)}
        />
        {vatRegistered && (
          <>
            <Field
              label="VAT number"
              name="vatNumber"
              placeholder="4123456789"
              defaultValue={tenant.vatNumber ?? ''}
              errors={e?.vatNumber}
            />
            <Field
              label="VAT rate (%)"
              name="vatRatePercent"
              type="number"
              step="0.1"
              min={0}
              max={100}
              defaultValue={tenant.vatRatePercent}
              errors={e?.vatRatePercent}
              hint="15% is the standard South African rate."
            />
          </>
        )}
        {!vatRegistered && (
          <p className="mb-4 text-xs text-slate-500">
            Not VAT registered: your quotes and invoices will show no VAT, as required.
          </p>
        )}
        {/* Keep the rate submitted even when the VAT section is hidden, so re-enabling VAT later remembers it. */}
        {!vatRegistered && <input type="hidden" name="vatRatePercent" value={tenant.vatRatePercent} />}
      </Section>

      <Section title="Banking (shown on invoices for EFT payment)">
        <Field label="Bank name" name="bankName" defaultValue={tenant.bankName ?? ''} errors={e?.bankName} />
        <Field
          label="Account holder"
          name="bankAccountHolder"
          defaultValue={tenant.bankAccountHolder ?? ''}
          errors={e?.bankAccountHolder}
        />
        <div className="grid grid-cols-2 gap-x-3">
          <Field
            label="Account number"
            name="bankAccountNumber"
            defaultValue={tenant.bankAccountNumber ?? ''}
            errors={e?.bankAccountNumber}
          />
          <Field label="Branch code" name="bankBranchCode" defaultValue={tenant.bankBranchCode ?? ''} errors={e?.bankBranchCode} />
        </div>
      </Section>

      <Section title="Quotes">
        <TextArea
          label="Standard terms (printed on every quote)"
          name="quoteTerms"
          defaultValue={tenant.quoteTerms ?? ''}
          errors={e?.quoteTerms}
        />
        <Field
          label="Quotes are valid for (days)"
          name="defaultQuoteValidDays"
          type="number"
          min={1}
          max={365}
          defaultValue={tenant.defaultQuoteValidDays}
          errors={e?.defaultQuoteValidDays}
        />
      </Section>

      <Section title="Invoices">
        <Field
          label="Payment due after (days)"
          name="defaultPaymentTermsDays"
          type="number"
          min={0}
          max={365}
          defaultValue={tenant.defaultPaymentTermsDays}
          errors={e?.defaultPaymentTermsDays}
          hint="0 means payment is due on receipt."
        />
        <TextArea
          label="Standard terms (printed on every invoice)"
          name="invoiceTerms"
          defaultValue={tenant.invoiceTerms ?? ''}
          errors={e?.invoiceTerms}
        />
        {invoiceNumbering.locked ? (
          <p className="text-sm text-slate-400">
            Invoice numbering: <span className="text-slate-200">{invoiceNumbering.prefix}…</span>, next number{' '}
            <span className="text-slate-200">{invoiceNumbering.next}</span>. Locked because invoices have been issued, so
            the sequence can’t be broken.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-3">
              <Field
                label="Number prefix"
                name="invoicePrefix"
                value={prefix}
                onChange={(ev) => setPrefix(ev.target.value)}
                maxLength={10}
                errors={e?.invoicePrefix}
              />
              <Field
                label="Next invoice number"
                name="invoiceNextNumber"
                type="number"
                min={1}
                value={nextNumber}
                onChange={(ev) => setNextNumber(ev.target.value)}
                errors={e?.invoiceNextNumber}
              />
            </div>
            <p className="-mt-2 mb-2 text-xs text-slate-500">
              Your first invoice will be <span className="text-slate-300">{previewNumber}</span>. Moving from another
              system? Continue from your last number. This locks once your first invoice is issued.
            </p>
          </>
        )}
      </Section>

      <Section title="Reviews">
        <Field
          label="Google review link (optional)"
          name="googleReviewUrl"
          type="url"
          placeholder="https://g.page/r/.../review"
          defaultValue={tenant.googleReviewUrl ?? ''}
          errors={e?.googleReviewUrl}
          hint="Find this in your Google Business Profile under 'Get more reviews'. Once set, a paid invoice offers a one-tap WhatsApp review request."
        />
      </Section>

      <SubmitButton pending={pending}>Save settings</SubmitButton>
    </form>
  );
}
