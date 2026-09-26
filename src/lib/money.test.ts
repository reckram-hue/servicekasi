// Plain test script for src/lib/money.ts — no test framework needed.
// Run with: npm run test:money
import assert from 'node:assert/strict';
import { documentTotals, formatMoney, lineTotals, parseMoneyInput } from './money.ts';

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

// ───────────────────────── lineTotals ─────────────────────────

test('a simple line with 15% VAT', () => {
  const t = lineTotals({ quantity: 1, unitPriceCents: 10000, taxRateBp: 1500 });
  assert.equal(t.subtotalCents, 10000);
  assert.equal(t.taxCents, 1500);
  assert.equal(t.totalCents, 11500);
});

test('0% VAT (business not registered) charges no tax', () => {
  const t = lineTotals({ quantity: 2, unitPriceCents: 45000, taxRateBp: 0 });
  assert.equal(t.subtotalCents, 90000);
  assert.equal(t.taxCents, 0);
  assert.equal(t.totalCents, 90000);
});

test('1.5 hours of labour at R650/hr', () => {
  const t = lineTotals({ quantity: 1.5, unitPriceCents: 65000, taxRateBp: 1500 });
  assert.equal(t.subtotalCents, 97500); // R975.00
  assert.equal(t.taxCents, 14625); // 15% of 975.00 = R146.25
  assert.equal(t.totalCents, 112125);
});

test('VAT rounds to the nearest cent per line, not truncated', () => {
  // R33.33 * 15% = R4.9995 → rounds to R5.00 (500 cents), not 499.
  const t = lineTotals({ quantity: 1, unitPriceCents: 3333, taxRateBp: 1500 });
  assert.equal(t.taxCents, 500);
});

test('an odd quantity does not drift from floating-point error', () => {
  // 1.333 * 30000 = 39990.000000000004 in raw JS float math.
  const t = lineTotals({ quantity: 1.333, unitPriceCents: 30000, taxRateBp: 0 });
  assert.equal(t.subtotalCents, 39990);
});

test('cost price is tracked separately from the client price', () => {
  const t = lineTotals({ quantity: 2, unitPriceCents: 5000, unitCostCents: 3000, taxRateBp: 0 });
  assert.equal(t.subtotalCents, 10000);
  assert.equal(t.costCents, 6000);
});

test('an optional line the client has NOT ticked is flagged as excluded', () => {
  const t = lineTotals({ quantity: 1, unitPriceCents: 5000, optional: true, selected: false });
  assert.equal(t.includedInDocument, false);
});

test('an optional line defaults to ticked (included) when selected is omitted', () => {
  const t = lineTotals({ quantity: 1, unitPriceCents: 5000, optional: true });
  assert.equal(t.includedInDocument, true);
});

// ───────────────────────── documentTotals ─────────────────────────

test('totals add up across several lines with the same tax rate', () => {
  const totals = documentTotals([
    { quantity: 1, unitPriceCents: 45000, unitCostCents: 0, taxRateBp: 1500 }, // call-out
    { quantity: 2, unitPriceCents: 65000, unitCostCents: 22000, taxRateBp: 1500 }, // labour
  ]);
  assert.equal(totals.subtotalCents, 45000 + 130000);
  assert.equal(totals.taxCents, Math.round(45000 * 0.15) + Math.round(130000 * 0.15));
  assert.equal(totals.totalCents, totals.subtotalCents + totals.taxCents);
});

test('an unticked optional line is left out of the document totals entirely', () => {
  const totals = documentTotals([
    { quantity: 1, unitPriceCents: 100000, taxRateBp: 1500 },
    { quantity: 1, unitPriceCents: 50000, taxRateBp: 1500, optional: true, selected: false },
  ]);
  assert.equal(totals.subtotalCents, 100000);
});

test('a ticked optional line IS included in the document totals', () => {
  const totals = documentTotals([
    { quantity: 1, unitPriceCents: 100000, taxRateBp: 1500 },
    { quantity: 1, unitPriceCents: 50000, taxRateBp: 1500, optional: true, selected: true },
  ]);
  assert.equal(totals.subtotalCents, 150000);
});

test('profit and margin are calculated from cost vs. price (internal only)', () => {
  const totals = documentTotals([{ quantity: 1, unitPriceCents: 10000, unitCostCents: 6000, taxRateBp: 0 }]);
  assert.equal(totals.profitCents, 4000);
  assert.equal(totals.marginPercent, 40);
});

test('margin is 0%, not NaN, when the document has no lines', () => {
  const totals = documentTotals([]);
  assert.equal(totals.subtotalCents, 0);
  assert.equal(totals.marginPercent, 0);
});

test('document total equals the sum of each line\'s own rounded total (SARS rule)', () => {
  // Three lines whose individual rounding could differ from rounding the sum once.
  const lines = [
    { quantity: 1, unitPriceCents: 3333, taxRateBp: 1500 },
    { quantity: 1, unitPriceCents: 3333, taxRateBp: 1500 },
    { quantity: 1, unitPriceCents: 3333, taxRateBp: 1500 },
  ];
  const totals = documentTotals(lines);
  const expectedTax = lines.reduce((sum, l) => sum + lineTotals(l).taxCents, 0);
  assert.equal(totals.taxCents, expectedTax);
});

// ───────────────────────── formatMoney ─────────────────────────

test('formats rands the South African way: space thousands, comma decimal', () => {
  assert.equal(formatMoney(125050, 'ZAR'), 'R 1 250,50');
});

test('formats a whole-rand amount with no cents when asked', () => {
  assert.equal(formatMoney(80000, 'ZAR', false), 'R 800');
});

test('formats zero without crashing', () => {
  assert.equal(formatMoney(0, 'ZAR'), 'R 0,00');
});

// ───────────────────────── parseMoneyInput ─────────────────────────

test('parses South African style: space thousands, comma decimal', () => {
  assert.equal(parseMoneyInput('1 250,50'), 125050);
});

test('parses plain period-decimal style', () => {
  assert.equal(parseMoneyInput('1250.50'), 125050);
});

test('parses US-style comma thousands + period decimal', () => {
  assert.equal(parseMoneyInput('1,250.50'), 125050);
});

test('parses European/SA-style period thousands + comma decimal', () => {
  assert.equal(parseMoneyInput('1.250,50'), 125050);
});

test('parses a whole number with no decimal part', () => {
  assert.equal(parseMoneyInput('1250'), 125000);
});

test('a single comma with 3+ digits after it is grouping, not a decimal', () => {
  assert.equal(parseMoneyInput('1,234'), 123400); // R1 234, not R1.234
});

test('a single comma with 1-2 digits after it is a decimal point', () => {
  assert.equal(parseMoneyInput('1,5'), 150); // R1,50
});

test('strips a leading currency symbol and spaces', () => {
  assert.equal(parseMoneyInput('R 1 250,50'), 125050);
});

test('pads a single decimal digit to the full cent', () => {
  assert.equal(parseMoneyInput('10,5'), 1050);
});

test('handles a negative amount (for future credit notes)', () => {
  assert.equal(parseMoneyInput('-50'), -5000);
});

test('rejects text that is not a number', () => {
  assert.equal(parseMoneyInput('abc'), null);
});

test('rejects an empty string', () => {
  assert.equal(parseMoneyInput(''), null);
});

console.log(`✓ all ${passed} money.ts tests passed`);
