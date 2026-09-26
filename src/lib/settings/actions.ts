'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth/session';
import { isValidCipcRegNumber, isValidSarsVatNumber } from '@/lib/southAfrica';
import { INVOICE_PREFIX_RE, MAX_INVOICE_NUMBER, setInvoiceNumbering } from '@/lib/invoices/numbering';

export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined>; ok?: string } | undefined;

const optionalText = (max = 200) => z.string().trim().max(max).optional().or(z.literal('').transform(() => undefined));

const BusinessSettingsSchema = z
  .object({
    businessName: z.string().trim().min(2, { error: 'Enter your business name.' }),
    tradingName: optionalText(),
    vatRegistered: z.union([z.literal('on'), z.literal('')]).optional(),
    vatNumber: optionalText(20),
    vatRatePercent: z.coerce.number().min(0).max(100).default(15),
    companyRegNumber: optionalText(20),
    phone: optionalText(30),
    email: z.union([z.email({ error: 'Enter a valid email address.' }), z.literal('')]).optional(),
    addressLine1: optionalText(),
    addressLine2: optionalText(),
    city: optionalText(),
    region: optionalText(),
    postalCode: optionalText(20),
    bankName: optionalText(),
    bankAccountHolder: optionalText(),
    bankAccountNumber: optionalText(30),
    bankBranchCode: optionalText(10),
    quoteTerms: optionalText(4000),
    defaultQuoteValidDays: z.coerce.number().int().min(1).max(365).default(30),
    invoiceTerms: optionalText(4000),
    defaultPaymentTermsDays: z.coerce
      .number({ error: 'Enter a number of days.' })
      .int({ error: 'Enter a whole number of days.' })
      .min(0)
      .max(365, { error: 'Use 365 days or fewer.' })
      .default(7),
    // Only sent while numbering is still editable (no invoice issued yet).
    invoicePrefix: z
      .string()
      .trim()
      .regex(INVOICE_PREFIX_RE, { error: 'Use up to 10 letters, numbers, "-" or "/".' })
      .optional(),
    invoiceNextNumber: z.coerce
      .number({ error: 'Enter a number.' })
      .int({ error: 'Enter a whole number.' })
      .min(1, { error: 'Start from 1 or higher.' })
      .max(MAX_INVOICE_NUMBER, { error: 'That number is too large.' })
      .optional(),
  })
  .transform((d) => ({ ...d, vatRegistered: d.vatRegistered === 'on' }))
  .refine((d) => !d.vatRegistered || (d.vatNumber && isValidSarsVatNumber(d.vatNumber)), {
    error: 'Enter a valid 10-digit SARS VAT number (starts with 4).',
    path: ['vatNumber'],
  })
  .refine((d) => !d.companyRegNumber || isValidCipcRegNumber(d.companyRegNumber), {
    error: 'Use the CIPC format, e.g. 2019/123456/07.',
    path: ['companyRegNumber'],
  });

export async function updateBusinessSettingsAction(_: FormState, formData: FormData): Promise<FormState> {
  const { tenant } = await requireRole(['OWNER', 'ADMIN']);
  const parsed = BusinessSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  const numberingError = await prisma.$transaction(async (tx) => {
    if (d.invoicePrefix !== undefined && d.invoiceNextNumber !== undefined) {
      const result = await setInvoiceNumbering(tx, tenant.id, d.invoicePrefix, d.invoiceNextNumber);
      if (result) return result.error;
    }
    await tx.tenant.update({
      where: { id: tenant.id },
      data: {
        businessName: d.businessName,
        tradingName: d.tradingName ?? null,
        vatRegistered: d.vatRegistered,
        vatNumber: d.vatRegistered ? d.vatNumber : null,
        defaultTaxRateBp: d.vatRegistered ? Math.round(d.vatRatePercent * 100) : 0,
        companyRegNumber: d.companyRegNumber ?? null,
        phone: d.phone ?? null,
        email: d.email || null,
        addressLine1: d.addressLine1 ?? null,
        addressLine2: d.addressLine2 ?? null,
        city: d.city ?? null,
        region: d.region ?? null,
        postalCode: d.postalCode ?? null,
        bankName: d.bankName ?? null,
        bankAccountHolder: d.bankAccountHolder ?? null,
        bankAccountNumber: d.bankAccountNumber ?? null,
        bankBranchCode: d.bankBranchCode ?? null,
        quoteTerms: d.quoteTerms ?? null,
        defaultQuoteValidDays: d.defaultQuoteValidDays,
        invoiceTerms: d.invoiceTerms ?? null,
        defaultPaymentTermsDays: d.defaultPaymentTermsDays,
      },
    });
    return null;
  });
  if (numberingError) return { error: numberingError };

  revalidatePath('/settings/business');
  return { ok: 'Saved.' };
}
