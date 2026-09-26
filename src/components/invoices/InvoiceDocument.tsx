import type { InvoiceKind } from '@prisma/client';
import { formatMoney, lineTotals } from '@/lib/money';
import type { BuyerSnapshot, SellerSnapshot } from '@/lib/invoices/snapshot';

export type InvoiceDocumentProps = {
  kind: InvoiceKind;
  number: string;
  issuedAt: Date;
  dueAt: Date | null;
  timeZone: string;
  currencyCode: string;
  seller: SellerSnapshot;
  buyer: BuyerSnapshot;
  logoUrl: string | null;
  lines: { id: string; description: string; quantity: number; unitPriceCents: number; taxRateBp: number }[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  notes: string | null;
  bank: { bankName: string | null; bankAccountHolder: string | null; bankAccountNumber: string | null; bankBranchCode: string | null } | null;
};

const LONG_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

/** The invoice as a printable page. Shows only what the client may see — never costs or margins. */
export function InvoiceDocument(p: InvoiceDocumentProps) {
  const money = (cents: number) => formatMoney(cents, p.currencyCode);
  const isTaxInvoice = p.kind === 'TAX_INVOICE';
  const issuedDay = p.issuedAt.toLocaleDateString('en-CA', { timeZone: p.timeZone });
  // dueAt is stored as UTC midnight of the chosen date, so format it in UTC.
  const dueDay = p.dueAt?.toISOString().slice(0, 10);
  const balanceCents = p.totalCents - p.paidCents;
  const rates = [...new Set(p.lines.map((l) => l.taxRateBp).filter((r) => r > 0))];
  const hasUntaxedLines = isTaxInvoice && p.lines.some((l) => l.taxRateBp === 0);
  const bank = p.bank?.bankAccountNumber ? p.bank : null;

  return (
    <div className="rounded-xl bg-white p-6 text-sm text-slate-800 shadow-sm print:rounded-none print:p-0 print:shadow-none sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          {p.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.logoUrl} alt="" className="mb-2 h-12 w-auto" />
          )}
          <div className="text-base font-bold text-slate-900">{p.seller.tradingName || p.seller.name}</div>
          {p.seller.tradingName && <div className="text-xs text-slate-500">{p.seller.name}</div>}
          {p.seller.addressLines.map((line, i) => (
            <div key={i} className="text-slate-600">
              {line}
            </div>
          ))}
          {p.seller.phone && <div className="text-slate-600">{p.seller.phone}</div>}
          {p.seller.email && <div className="text-slate-600">{p.seller.email}</div>}
          {p.seller.vatNumber && <div className="mt-1 text-slate-600">VAT No. {p.seller.vatNumber}</div>}
          {p.seller.companyRegNumber && <div className="text-slate-600">Reg. No. {p.seller.companyRegNumber}</div>}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tracking-wide text-slate-900">{isTaxInvoice ? 'TAX INVOICE' : 'INVOICE'}</div>
          <dl className="mt-2 grid grid-cols-[auto_auto] justify-end gap-x-3 gap-y-0.5 text-slate-600">
            <dt>Number</dt>
            <dd className="font-medium text-slate-900">{p.number}</dd>
            <dt>Date</dt>
            <dd className="text-slate-900">{formatDay(issuedDay)}</dd>
            {dueDay && (
              <>
                <dt>Due</dt>
                <dd className="text-slate-900">{dueDay <= issuedDay ? 'On receipt' : formatDay(dueDay)}</dd>
              </>
            )}
          </dl>
        </div>
      </div>

      <div className="border-b border-slate-200 py-4">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Bill to</div>
        <div className="font-medium text-slate-900">{p.buyer.name}</div>
        {p.buyer.companyName && <div className="text-slate-700">{p.buyer.companyName}</div>}
        {p.buyer.addressLines.map((line, i) => (
          <div key={i} className="text-slate-600">
            {line}
          </div>
        ))}
        {p.buyer.vatNumber && <div className="mt-1 text-slate-600">VAT No. {p.buyer.vatNumber}</div>}
      </div>

      <table className="mt-4 w-full">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-2 font-medium">Description</th>
            <th className="py-2 pr-2 text-right font-medium">Qty</th>
            <th className="py-2 pr-2 text-right font-medium">Unit price</th>
            <th className="py-2 text-right font-medium">{isTaxInvoice ? 'Amount excl. VAT' : 'Amount'}</th>
          </tr>
        </thead>
        <tbody>
          {p.lines.map((l) => (
            <tr key={l.id} className="border-b border-slate-100 align-top">
              <td className="py-2 pr-2 text-slate-900">
                {l.description}
                {hasUntaxedLines && l.taxRateBp === 0 && <span className="text-slate-500"> *</span>}
              </td>
              <td className="py-2 pr-2 text-right tabular-nums">{l.quantity}</td>
              <td className="py-2 pr-2 text-right tabular-nums">{money(l.unitPriceCents)}</td>
              <td className="py-2 text-right tabular-nums">{money(lineTotals(l).subtotalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 ml-auto max-w-xs space-y-1 tabular-nums">
        {isTaxInvoice && (
          <>
            <Row label="Subtotal excl. VAT" value={money(p.subtotalCents)} />
            <Row label={rates.length === 1 ? `VAT (${rates[0] / 100}%)` : 'VAT'} value={money(p.taxCents)} />
          </>
        )}
        <Row label={isTaxInvoice ? 'Total incl. VAT' : 'Total'} value={money(p.totalCents)} strong />
        {p.paidCents > 0 && (
          <>
            <Row label="Paid" value={`− ${money(p.paidCents)}`} />
            <Row label="Balance due" value={money(balanceCents)} strong />
          </>
        )}
      </div>
      {hasUntaxedLines && <p className="mt-2 text-right text-xs text-slate-500">* No VAT charged on this line.</p>}

      {bank && balanceCents > 0 && (
        <div className="mt-6 rounded-lg border border-slate-200 p-4 print:break-inside-avoid">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Pay by EFT</div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-slate-700">
            {bank.bankName && (
              <>
                <dt className="text-slate-500">Bank</dt>
                <dd>{bank.bankName}</dd>
              </>
            )}
            {bank.bankAccountHolder && (
              <>
                <dt className="text-slate-500">Account holder</dt>
                <dd>{bank.bankAccountHolder}</dd>
              </>
            )}
            <dt className="text-slate-500">Account number</dt>
            <dd className="font-medium text-slate-900">{bank.bankAccountNumber}</dd>
            {bank.bankBranchCode && (
              <>
                <dt className="text-slate-500">Branch code</dt>
                <dd>{bank.bankBranchCode}</dd>
              </>
            )}
            <dt className="text-slate-500">Reference</dt>
            <dd className="font-semibold text-slate-900">{p.number}</dd>
          </dl>
        </div>
      )}

      {p.notes && (
        <div className="mt-6 border-t border-slate-200 pt-4 text-slate-600">
          <p className="whitespace-pre-wrap">{p.notes}</p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? 'border-t border-slate-200 pt-1 font-semibold text-slate-900' : 'text-slate-600'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function formatDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-ZA', { ...LONG_DATE, timeZone: 'UTC' });
}
