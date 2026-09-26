/**
 * ServiceKasi - South African Localization & Financial Utilities
 * Built specifically for RSA statutory requirements, tax rules, and local gateway mocks.
 */

import { DominoConflict, Job, JobCosting, QuoteLineItem, SouthAfricanProvince, User } from '../types';

export const SA_VAT_RATE = 0.15; // 15% standard South African VAT rate

export const SA_PROVINCES: { code: string; name: SouthAfricanProvince; capital: string }[] = [
  { code: 'GP', name: 'Gauteng', capital: 'Johannesburg' },
  { code: 'WC', name: 'Western Cape', capital: 'Cape Town' },
  { code: 'KZN', name: 'KwaZulu-Natal', capital: 'Pietermaritzburg' },
  { code: 'EC', name: 'Eastern Cape', capital: 'Bhisho' },
  { code: 'FS', name: 'Free State', capital: 'Bloemfontein' },
  { code: 'LP', name: 'Limpopo', capital: 'Polokwane' },
  { code: 'MP', name: 'Mpumalanga', capital: 'Mbombela' },
  { code: 'NW', name: 'North West', capital: 'Mahikeng' },
  { code: 'NC', name: 'Northern Cape', capital: 'Kimberley' },
];

/**
 * Calculates complete quotation totals including internal supplier costs,
 * client chargeout with markup, 15% VAT, and estimated gross margin.
 */
export function calculateQuoteTotals(items: QuoteLineItem[]) {
  let subtotalCostZAR = 0;
  let subtotalExclVat = 0;
  let vatTotal = 0;
  let totalInclVat = 0;

  items.forEach((item) => {
    const itemCost = item.quantity * item.unitCostZAR;
    const itemPriceExclVat = item.quantity * item.unitPriceExclVat;
    const itemVat = Math.round(itemPriceExclVat * SA_VAT_RATE * 100) / 100;
    const itemTotal = itemPriceExclVat + itemVat;

    subtotalCostZAR += itemCost;
    subtotalExclVat += itemPriceExclVat;
    vatTotal += itemVat;
    totalInclVat += itemTotal;
  });

  const estimatedGrossProfitZAR = subtotalExclVat - subtotalCostZAR;
  const estimatedMarginPercent =
    subtotalExclVat > 0 ? (estimatedGrossProfitZAR / subtotalExclVat) * 100 : 0;

  return {
    subtotalCostZAR: Math.round(subtotalCostZAR * 100) / 100,
    subtotalExclVat: Math.round(subtotalExclVat * 100) / 100,
    vatTotal: Math.round(vatTotal * 100) / 100,
    totalInclVat: Math.round(totalInclVat * 100) / 100,
    estimatedGrossProfitZAR: Math.round(estimatedGrossProfitZAR * 100) / 100,
    estimatedMarginPercent: Math.round(estimatedMarginPercent * 10) / 10,
  };
}

/**
 * Calculates Estimated vs. Actual Job Costing, P&L, Gross Profit (ZAR), and Margin %
 */
export function calculateJobProfitability(
  estimatedHours: number,
  actualHours: number,
  techCostPerHour: number,
  estimatedMaterialsCost: number,
  actualMaterialsCost: number,
  revenueBilledExclVat: number,
  calloutCost = 350
): JobCosting {
  const estimatedLaborCostZAR = estimatedHours * techCostPerHour;
  const actualLaborCostZAR = actualHours * techCostPerHour;

  const estimatedTotalCostZAR = estimatedLaborCostZAR + estimatedMaterialsCost + calloutCost;
  const actualTotalCostZAR = actualLaborCostZAR + actualMaterialsCost + calloutCost;

  const estimatedProfitZAR = revenueBilledExclVat - estimatedTotalCostZAR;
  const estimatedMarginPercent =
    revenueBilledExclVat > 0 ? (estimatedProfitZAR / revenueBilledExclVat) * 100 : 0;

  const actualProfitZAR = revenueBilledExclVat - actualTotalCostZAR;
  const actualMarginPercent =
    revenueBilledExclVat > 0 ? (actualProfitZAR / revenueBilledExclVat) * 100 : 0;

  const laborHoursVariance = actualHours - estimatedHours;
  const profitVarianceZAR = actualProfitZAR - estimatedProfitZAR;

  let status: JobCosting['status'] = 'OPTIMAL';
  if (actualProfitZAR < 0) {
    status = 'LOSS_ALERT'; // Job operated at a direct loss
  } else if (actualMarginPercent < 20 || laborHoursVariance > 2) {
    status = 'EROSION_WARNING'; // Severe margin erosion
  } else if (actualMarginPercent < 35) {
    status = 'ACCEPTABLE';
  }

  return {
    estimatedLaborHours: estimatedHours,
    estimatedLaborCostZAR: Math.round(estimatedLaborCostZAR * 100) / 100,
    estimatedMaterialCostZAR: Math.round(estimatedMaterialsCost * 100) / 100,
    estimatedCalloutZAR: calloutCost,
    estimatedTotalCostZAR: Math.round(estimatedTotalCostZAR * 100) / 100,
    estimatedRevenueExclVat: revenueBilledExclVat,
    estimatedProfitZAR: Math.round(estimatedProfitZAR * 100) / 100,
    estimatedMarginPercent: Math.round(estimatedMarginPercent * 10) / 10,

    actualLaborHours: actualHours,
    actualLaborCostZAR: Math.round(actualLaborCostZAR * 100) / 100,
    actualMaterialCostZAR: Math.round(actualMaterialsCost * 100) / 100,
    actualCalloutZAR: calloutCost,
    actualTotalCostZAR: Math.round(actualTotalCostZAR * 100) / 100,
    actualRevenueExclVat: revenueBilledExclVat,
    actualProfitZAR: Math.round(actualProfitZAR * 100) / 100,
    actualMarginPercent: Math.round(actualMarginPercent * 10) / 10,

    laborHoursVariance: Math.round(laborHoursVariance * 10) / 10,
    profitVarianceZAR: Math.round(profitVarianceZAR * 100) / 100,
    status,
  };
}

/**
 * Parses time string like "09:00" into total minutes from midnight.
 */
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Formats total minutes into "HH:MM" 24h format.
 */
export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(minutes, 23 * 60 + 59));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Detects cascading "Domino Effect" scheduling conflicts.
 * If a job overruns (e.g. takes 6 hours instead of 2), checks all subsequent appointments
 * assigned to that technician on the same day.
 */
export function detectDominoConflicts(jobs: Job[], technicians: User[]): DominoConflict[] {
  const conflicts: DominoConflict[] = [];

  technicians.forEach((tech) => {
    // Get all scheduled jobs for this tech sorted by start time
    const techJobs = jobs
      .filter(
        (j) =>
          j.assignedTechId === tech.id &&
          j.status !== 'CANCELLED' &&
          j.status !== 'INVOICED'
      )
      .sort((a, b) => timeToMinutes(a.scheduledStartTime) - timeToMinutes(b.scheduledStartTime));

    for (let i = 0; i < techJobs.length; i++) {
      const currentJob = techJobs[i];
      const overrun = currentJob.overrunMinutes || 0;

      if (overrun > 0) {
        const currentStartMin = timeToMinutes(currentJob.scheduledStartTime);
        const plannedDurationMin = (currentJob.estimatedDurationHours || 2) * 60;
        const actualEndMin = currentStartMin + plannedDurationMin + overrun;

        // Check if actualEndMin extends into any following appointments
        const affectedJobIds: string[] = [];
        for (let j = i + 1; j < techJobs.length; j++) {
          const nextJob = techJobs[j];
          const nextStartMin = timeToMinutes(nextJob.scheduledStartTime);

          if (actualEndMin > nextStartMin) {
            affectedJobIds.push(nextJob.id);
          }
        }

        if (affectedJobIds.length > 0) {
          conflicts.push({
            delayedJobId: currentJob.id,
            technicianId: tech.id,
            technicianName: tech.name,
            overrunMinutes: overrun,
            affectedJobIds,
            suggestedAction: overrun > 120 ? 'REASSIGN' : 'AUTO_SHIFT',
          });
        }
      }
    }
  });

  return conflicts;
}

/**
 * Automatically cascades/pushes downstream appointments forward by overrun delta.
 */
export function cascadePushAppointments(
  jobs: Job[],
  conflict: DominoConflict
): Job[] {
  const pushMinutes = conflict.overrunMinutes;

  return jobs.map((job) => {
    if (conflict.affectedJobIds.includes(job.id)) {
      const currentStart = timeToMinutes(job.scheduledStartTime);
      const currentEnd = timeToMinutes(job.scheduledEndTime);
      const newStart = minutesToTime(currentStart + pushMinutes);
      const newEnd = minutesToTime(currentEnd + pushMinutes);

      return {
        ...job,
        scheduledStartTime: newStart,
        scheduledEndTime: newEnd,
        scheduledTime: `${newStart} - ${newEnd}`,
        dominoWarning: `Pushed by +${Math.round(pushMinutes / 60)}h due to prior delay on ${
          conflict.delayedJobId
        }`,
      };
    }
    if (job.id === conflict.delayedJobId) {
      return {
        ...job,
        hasDominoConflict: false,
      };
    }
    return job;
  });
}

/**
 * Formats a numeric value into South African Rand (ZAR).
 * Uses standard "R 1,250.00" formatting.
 */
export function formatZAR(amount: number, includeCents = true): string {
  const safeAmount = isNaN(amount) ? 0 : amount;
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: includeCents ? 2 : 0,
    maximumFractionDigits: includeCents ? 2 : 0,
  })
    .format(safeAmount)
    .replace('ZAR', 'R'); // Guarantee standard "R 1,250.00" format across all browsers
}

/**
 * Calculates 15% South African VAT from an exclusive subtotal.
 */
export function calculateVat(subtotalExclVat: number, rate = SA_VAT_RATE) {
  const vatAmount = Math.round(subtotalExclVat * rate * 100) / 100;
  const totalInclVat = Math.round((subtotalExclVat + vatAmount) * 100) / 100;
  return {
    subtotalExclVat,
    vatAmount,
    totalInclVat,
    ratePercent: `${Math.round(rate * 100)}%`,
  };
}

/**
 * Extracts the 15% South African VAT from a gross amount inclusive of VAT.
 */
export function extractVatFromInclusive(totalInclVat: number, rate = SA_VAT_RATE) {
  const subtotalExclVat = Math.round((totalInclVat / (1 + rate)) * 100) / 100;
  const vatAmount = Math.round((totalInclVat - subtotalExclVat) * 100) / 100;
  return {
    subtotalExclVat,
    vatAmount,
    totalInclVat,
  };
}

/**
 * Validates a South African CIPC registration number (e.g. 2023/182930/07).
 */
export function isValidCipcRegNumber(reg: string): boolean {
  // Format: YYYY/NNNNNN/NN (e.g., 2019/123456/07 for (Pty) Ltd, 23 for Close Corp)
  const regex = /^\d{4}\/\d{6}\/\d{2}$/;
  return regex.test(reg.trim());
}

/**
 * Validates a South African Revenue Service (SARS) 10-digit VAT number.
 */
export function isValidSarsVatNumber(vat: string): boolean {
  const cleaned = vat.replace(/\s+/g, '');
  return /^\d{10}$/.test(cleaned) && cleaned.startsWith('4'); // SARS VAT registration numbers are 10 digits and traditionally start with 4
}

/**
 * Normalizes a South African mobile number into standard international format (+27...)
 * e.g., "082 123 4567" -> "+27821234567"
 */
export function normalizeSaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) {
    return `+27${digits.slice(1)}`;
  }
  if (digits.startsWith('27') && digits.length === 11) {
    return `+${digits}`;
  }
  return phone;
}

/**
 * Generates a WhatsApp dispatch link with prefilled South African message.
 */
export function createWhatsAppDispatchLink(
  phone: string,
  clientName: string,
  technicianName: string,
  timeSlot: string
): string {
  const cleanPhone = normalizeSaPhone(phone).replace('+', '');
  const message = `Sawubona / Dumela / Hello ${clientName}! This is ${technicianName} from ServiceKasi Field Team. I am scheduled to arrive for your service between ${timeSlot}. Please ensure access to the property. Enkosi / Baie dankie!`;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Builds Google Maps navigation link from South African address fields.
 */
export function createGoogleMapsLink(address: {
  streetAddress: string;
  suburb: string;
  city: string;
  postalCode: string;
  province: string;
}): string {
  const query = `${address.streetAddress}, ${address.suburb}, ${address.city}, ${address.province}, ${address.postalCode}, South Africa`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Mock PayFast Integration (South Africa's premier payment gateway)
 * Simulates PayFast checkout form generation and ITN webhook signature
 */
export interface PayFastCheckoutConfig {
  merchantId: string;
  merchantKey: string;
  passPhrase?: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}

export const DEFAULT_PAYFAST_CONFIG: PayFastCheckoutConfig = {
  merchantId: '10000100', // PayFast Sandbox Merchant ID
  merchantKey: '46f0cd694581a', // PayFast Sandbox Merchant Key
  passPhrase: 'servicekasi_sandbox_secret',
  returnUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/invoices?payment=success`,
  cancelUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/invoices?payment=cancelled`,
  notifyUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/payfast`,
};

export function generatePayFastPayload(
  invoiceNumber: string,
  amountInclVat: number,
  clientName: string,
  clientEmail: string,
  clientPhone: string,
  config: PayFastCheckoutConfig = DEFAULT_PAYFAST_CONFIG
) {
  const [firstName, ...rest] = clientName.split(' ');
  const lastName = rest.join(' ') || 'Customer';

  return {
    merchant_id: config.merchantId,
    merchant_key: config.merchantKey,
    return_url: config.returnUrl,
    cancel_url: config.cancelUrl,
    notify_url: config.notifyUrl,
    name_first: firstName,
    name_last: lastName,
    email_address: clientEmail,
    cell_number: normalizeSaPhone(clientPhone),
    m_payment_id: invoiceNumber,
    amount: amountInclVat.toFixed(2),
    item_name: `ServiceKasi Invoice ${invoiceNumber}`,
    item_description: `Payment for field service work order ${invoiceNumber}`,
    payment_method: 'cc,dc,eft', // Credit Card, Debit Card, Instant EFT (Capitec, FNB, Standard Bank, Absa, Nedbank)
  };
}

/**
 * Mock Yoco Integration (Popular South African SME card payment provider)
 */
export function generateYocoPaymentLink(
  invoiceNumber: string,
  amountInclVat: number,
  clientEmail: string
) {
  const amountInCents = Math.round(amountInclVat * 100);
  return {
    yocoPublicKey: 'pk_test_ed3c54a6g829140f8a92',
    checkoutUrl: `https://pay.yoco.com/servicekasi/${invoiceNumber.toLowerCase()}?amount=${amountInCents}`,
    metadata: {
      invoiceId: invoiceNumber,
      currency: 'ZAR',
      amountInCents,
      customerEmail: clientEmail,
    },
  };
}

/**
 * Mock Accounting Sync for South African platforms:
 * - Sage Accounting South Africa (formerly Sage One)
 * - Xero South Africa (with SARS VAT report codes)
 */
export function buildSageAccountingPayload(invoice: {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  clientName: string;
  clientVatNumber?: string;
  subtotalExclVat: number;
  vatTotal: number;
  totalInclVat: number;
  items: Array<{ description: string; quantity: number; unitPriceExclVat: number; totalInclVat: number }>;
}) {
  return {
    sageTenant: 'ZA-JHB-TAX-01',
    documentType: 'TaxInvoice',
    invoiceNumber: invoice.invoiceNumber,
    date: invoice.issueDate,
    dueDate: invoice.dueDate,
    customer: {
      name: invoice.clientName,
      vatNumber: invoice.clientVatNumber || 'UNREGISTERED',
      countryCode: 'ZA',
    },
    taxScheme: 'Standard 15% VAT (South Africa)',
    lines: invoice.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPriceExclTax: item.unitPriceExclVat,
      taxRate: 15.0,
      taxType: 'Standard Rated Output VAT',
      accountCode: '4000/000 - Sales & Field Services',
    })),
    totals: {
      exclusive: invoice.subtotalExclVat,
      vat: invoice.vatTotal,
      inclusive: invoice.totalInclVat,
    },
  };
}
