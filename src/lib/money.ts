/**
 * Money maths shared by quotes, jobs and invoices.
 *
 * Money is always stored and calculated in whole CENTS (integers), never
 * rands-as-a-float — floats lose cents on repeated arithmetic. Only the
 * formatting functions at the bottom convert to a display string.
 *
 * SARS requires VAT to be calculated per line, rounded to the cent, then
 * summed — not summed first and rounded once. Every function here follows
 * that rule, so documentTotals() always equals the sum of each line's own
 * rounded totals.
 */

export interface MoneyLineInput {
  quantity: number;
  unitPriceCents: number;
  /** What it costs the business. Internal only — never shown to a client. */
  unitCostCents?: number;
  /** Basis points: 1500 = 15%. 0 for a business that isn't VAT-registered. */
  taxRateBp?: number;
  /** A Jobber-style add-on the client can tick/untick on a quote. */
  optional?: boolean;
  /** Only matters when optional is true. Defaults to true (shown, ticked). */
  selected?: boolean;
}

export interface LineTotals {
  subtotalCents: number; // quantity * unitPriceCents, rounded to the cent
  costCents: number; // quantity * unitCostCents, rounded to the cent (internal)
  taxCents: number;
  totalCents: number; // subtotalCents + taxCents
  /** false for an optional line the client has unticked — excluded from document totals. */
  includedInDocument: boolean;
}

export interface DocumentTotals {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  /** Internal only — never shown to a client. */
  costCents: number;
  profitCents: number;
  marginPercent: number;
}

/** Rounds to the nearest cent (standard round-half-up), the way SARS expects. */
function roundCents(value: number): number {
  return Math.round(value);
}

export function lineTotals(line: MoneyLineInput): LineTotals {
  const unitCostCents = line.unitCostCents ?? 0;
  const taxRateBp = line.taxRateBp ?? 0;
  const optional = line.optional ?? false;
  const selected = line.selected ?? true;

  const subtotalCents = roundCents(line.quantity * line.unitPriceCents);
  const costCents = roundCents(line.quantity * unitCostCents);
  const taxCents = roundCents((subtotalCents * taxRateBp) / 10000);

  return {
    subtotalCents,
    costCents,
    taxCents,
    totalCents: subtotalCents + taxCents,
    includedInDocument: !(optional && !selected),
  };
}

export function documentTotals(lines: MoneyLineInput[]): DocumentTotals {
  let subtotalCents = 0;
  let taxCents = 0;
  let costCents = 0;

  for (const line of lines) {
    const t = lineTotals(line);
    if (!t.includedInDocument) continue;
    subtotalCents += t.subtotalCents;
    taxCents += t.taxCents;
    costCents += t.costCents;
  }

  const totalCents = subtotalCents + taxCents;
  const profitCents = subtotalCents - costCents;
  const marginPercent = subtotalCents > 0 ? (profitCents / subtotalCents) * 100 : 0;

  return { subtotalCents, taxCents, totalCents, costCents, profitCents, marginPercent };
}

// ───────────────────────── formatting ─────────────────────────

// Locale drives grouping/decimal punctuation. South Africa (and most of the
// region) uses a space for thousands and a comma for decimals: "R 1 250,50".
const LOCALE_BY_CURRENCY: Record<string, string> = {
  ZAR: 'en-ZA',
  BWP: 'en-BW',
  ZMW: 'en-ZM',
  NAD: 'en-NA',
  MZN: 'pt-MZ',
  USD: 'en-US',
};

// Intl's narrowSymbol occasionally falls back to printing the currency code
// itself depending on the JS engine's ICU data. This guarantees the plain
// local symbol we actually want, the same safety net southAfrica.ts uses.
const SYMBOL_OVERRIDE: Record<string, string> = {
  ZAR: 'R',
  BWP: 'P',
  ZMW: 'K',
  NAD: '$',
  MZN: 'MT',
};

/** Formats whole cents for display, e.g. formatMoney(125050, 'ZAR') → "R 1 250,50". */
export function formatMoney(cents: number, currencyCode: string, includeCents = true): string {
  const amount = (Number.isFinite(cents) ? cents : 0) / 100;
  const locale = LOCALE_BY_CURRENCY[currencyCode] ?? 'en';

  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: includeCents ? 2 : 0,
    maximumFractionDigits: includeCents ? 2 : 0,
  }).format(amount);

  const symbol = SYMBOL_OVERRIDE[currencyCode];
  return symbol ? formatted.replace(currencyCode, symbol) : formatted;
}

/**
 * Parses money as people actually type it into a form, into whole cents.
 * Accepts both South African style ("1 250,50" or "1.250,50") and the
 * period-decimal style many people default to in software ("1250.50" or
 * "1,250.50"). Returns null (rather than throwing) for input that isn't a
 * recognisable number, so callers can show a friendly validation message.
 *
 *   parseMoneyInput("1 250,50")  → 125050
 *   parseMoneyInput("1250.50")   → 125050
 *   parseMoneyInput("R 1,250")   → 125000
 *   parseMoneyInput("abc")       → null
 */
export function parseMoneyInput(input: string): number | null {
  // Strip currency symbols/codes and every kind of whitespace (spaces are
  // always thousands grouping in every format we support — never decimal).
  let s = input
    .trim()
    .replace(/[Rr]\s*|ZAR|BWP|ZMW|NAD|MZN|USD|[$£€]/g, '')
    .replace(/[\s ]/g, '');
  if (s === '') return null;

  let negative = false;
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  }

  if (!/^[0-9.,]+$/.test(s)) return null;

  const commaCount = (s.match(/,/g) ?? []).length;
  const dotCount = (s.match(/\./g) ?? []).length;
  let integerPart: string;
  let fractionPart = '';

  if (commaCount > 0 && dotCount > 0) {
    // Both appear: whichever comes LAST is the decimal separator, the other
    // is thousands grouping ("1,250.50" US-style or "1.250,50" SA-style).
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    const decimalIndex = Math.max(lastComma, lastDot);
    integerPart = s.slice(0, decimalIndex).replace(/[.,]/g, '');
    fractionPart = s.slice(decimalIndex + 1);
  } else if (commaCount + dotCount === 1) {
    // Exactly one separator. If 3+ digits follow it, it's grouping a whole
    // number ("1.234" / "1,234" meaning one thousand two-hundred-and-34),
    // not a decimal point — a currency amount never has 3+ decimal digits.
    const sepIndex = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
    const after = s.slice(sepIndex + 1);
    if (after.length >= 3) {
      integerPart = s.replace(/[.,]/g, '');
    } else {
      integerPart = s.slice(0, sepIndex);
      fractionPart = after;
    }
  } else {
    // Zero separators, or several of the same kind ("1.234.567" /
    // "1,234,567") — all grouping, no decimal part.
    integerPart = s.replace(/[.,]/g, '');
  }

  if (integerPart === '') integerPart = '0';
  if (!/^\d+$/.test(integerPart) || !/^\d*$/.test(fractionPart)) return null;

  fractionPart = (fractionPart + '00').slice(0, 2);
  const cents = parseInt(integerPart, 10) * 100 + parseInt(fractionPart || '0', 10);
  return negative ? -cents : cents;
}
