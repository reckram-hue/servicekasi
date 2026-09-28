# Bookkeeping (cashbook) — plan

Status: Phase 1 (1a + 1b) built and tested 2026-09-28 — the full cashbook, creditors, automatic invoice-payment posting. Reports (P&L and VAT summary) built and tested 2026-09-28 too, ahead of the rest of Phase 2 — see "Reports" below. Bank CSV import and reconciliation are not built.

## The goal

Replace the spreadsheet and the box of paper slips. A tradesperson should be able to answer, on their phone:
- What money came in and went out this month?
- Does my bank balance in the app match my real bank statement?
- Who do I owe, and how late am I?
- What do I hand my accountant at year end?

This is **not** an accounting package. No payroll, no tax returns, no balance sheet, no depreciation. We say so clearly on screen: "a record-keeping tool — your accountant still does your tax."

## Decisions (please confirm or change)

1. **Double-entry, hidden.** Every money movement is saved as a balanced journal (debit = credit) behind the scenes. The user only ever sees "money in / money out / category". Reason: balances can't drift, and syncing to Xero/Sage/QuickBooks later becomes straightforward.
2. **Categories map to a standard chart of accounts.** We ship a short South African trade-business list (Materials, Fuel, Vehicle, Tools, Rent, Phone & data, Bank charges, Subcontractors, etc.), each with a fixed accounting code. Users can rename and add, not delete used ones. Reason: each category later maps 1-to-1 onto an account in Xero/Sage/QuickBooks.
3. **Bank statements come in by CSV upload**, not live bank feeds. Live feeds cost money and need bank contracts. We write one reader per bank: FNB, Standard Bank, ABSA, Capitec, Nedbank (plus a "map the columns yourself" fallback).
4. **VAT kept simple.** Each expense line is "includes VAT" or "no VAT". Only VAT-registered businesses see VAT at all (the tenant already knows this from invoicing).
5. **Nothing is ever deleted.** Mistakes are reversed with a correcting entry, same as payments today (decision 11 in the invoices plan).
6. **Money in from invoices is automatic.** Existing invoice payments post into the cashbook themselves; users don't enter turnover twice.

## Phase 1a — Cashbook (built)

**Money accounts** — `/bookkeeping/accounts/new`, `/bookkeeping/accounts/[id]`
- Types: Bank, Petty cash, Loan (money owed to a bank/family/vehicle finance), Credit card.
- Each has a name, opening balance and opening date. Each account page shows a running balance and its full history.

**Expenses ("money out")** — `/bookkeeping/expenses/new`
- Date, amount, supplier, category, paid from (which money account), VAT yes/no, note.
- **Slip photo** from the phone camera (reuses the existing R2 photo storage, resized client-side first). This is the "no more box of paper" feature.
- Fast entry on mobile: amount + photo + category, everything else optional. The form clears itself after each save so several can be logged in a row.
- The 30/month Free Solo cap blocks the 31st expense with an upgrade prompt; Team and Growth are unlimited.

**Transfers** — `/bookkeeping/transfer`
- Bank → petty cash (drawing cash), bank → loan (repayment, with an optional interest split — the interest posts as its own linked entry so only the true principal reduces what's owed).

**Categories** — `/bookkeeping/categories`
- A short South African trade-business list seeded the first time a business opens the cashbook. Renaming works; nothing already used can be removed, matching decision 5.

**Dashboard card** — money out this month, on the `/bookkeeping` overview, alongside every account's balance and the recent expense list.

Engine: every screen above posts through a hidden double-entry ledger (`src/lib/bookkeeping/ledger.ts`) — one `LedgerAccount` row per money account, category, and the one "opening balance equity" system account, so a future Xero/Sage/QuickBooks export (Phase 3) has real accounting codes to map onto without reshaping any data.

## Phase 1b — Creditors and automatic invoice income (built)

**Creditors (supplier bills)** — `/bookkeeping/bills`, `/bookkeeping/bills/new`, `/bookkeeping/bills/[id]`
- Record a bill from a supplier: supplier, bill date, due date, category, amount, VAT, slip/invoice photo, note.
- Raising a bill posts a journal entry (debit the expense category, credit the shared "Accounts payable" system account); paying it (in full or in part, from any money account) posts the reverse.
- "Who I owe" — every bill not yet fully paid, oldest due date first, with an "Overdue" badge past the due date.
- Team/Growth only (Free Solo doesn't get it, matching the "trial only" row below) — gated with `canUse(tenant, 'creditors')`, checked server-side in both `addBillAction` and `payBillAction`, not just hidden in the UI.

**Decision 6 — money in from invoices, automatically**
- `Payment` gained an optional `moneyAccountId` and `journalEntryId`. Recording a manual payment (cash/EFT/card by hand) now offers "Which account did this land in? (optional)" — choosing one posts a real journal entry (debit the money account, credit a new "Sales income" system account) the same way an expense posts "money out".
- A refund posts the mirror entry; reversing a payment posts a correction (decision 5) rather than touching the original.
- The `/bookkeeping` overview now shows both "Money in this month" and "Money out this month".
- **Not done:** gateway (PayFast) payments don't post to the cashbook yet — there's no UI moment to ask which account, and picking one automatically needs a rule for when a business has more than one bank account. Still punted until real usage shows what's needed.

**Known gap:** there's no "correct a mistaken expense" action yet (`Expense.reversedAt` exists in the schema but nothing sets it) — only bill and invoice payments can be reversed so far. Add a `reverseExpenseAction` when beta feedback asks for it.

## Phase 2 — Reconciliation and reports

**Bank statement import**
- Upload a CSV, pick the bank, preview the lines, import. Duplicate lines (same date, amount, description) are skipped.

**Reconciliation — the "wow" feature**
- For each bank line, the app suggests a match:
  - a client payment on an invoice (by amount and invoice number in the reference),
  - a supplier bill payment,
  - an expense already typed in,
  - or "new expense" with a guessed category (learns from the user's past choices for the same description, e.g. "ENGEN" → Fuel).
- User taps ✓ to confirm or picks something else. A progress bar shows "32 of 40 lines matched".
- Closing: statement closing balance must equal the app's balance; if not, we show the difference.

**Reports** — `/bookkeeping/reports` (built, ahead of the rest of this phase)
- **Profit & loss** (month, with prev/next navigation, or the current SA tax year — March–February). Income is cash actually received on invoices in the period, independent of whether the cashbook has been touched at all. Expenses are accrual — everything posted to an expense category's ledger account in the period (plain expenses and bills raised), whether paid off yet or not, broken down by category. Free Solo included.
- **VAT summary** per period, same month/tax-year navigation — output VAT (the VAT share of cash actually collected, proportional per payment) minus input VAT (back-calculated from expenses/bills marked "Includes VAT" at the tenant's standard rate) — figures for the SARS VAT201. Only shown to VAT-registered tenants; Team/Growth only (`canUse(tenant, 'vatSummary')`, checked server-side).
- **Not built**: creditors aged list (current/30/60/90+ days), the existing debtors list surfaced here too, and the accountant export (CSV/Excel + zip of slip photos) — left for when Phase 2's bank reconciliation work happens, since the export format may want to match whatever bank-import shape lands then.

## Phase 3 — Accounting package sync (top tier)

- Order: **Xero** (best developer tools), then **Sage Business Cloud Accounting** (most used in SA), then **QuickBooks**.
- Each needs us to register as a developer/partner with that company (free to start for Xero; Sage and Intuit have review steps — allow a few weeks each).
- Sync direction: ServiceKasi → package (invoices, payments, expenses, bills). We do not pull their data back in the first version.
- User maps our categories to their chart of accounts once; we remember it.

## Which package gets what

Based on the existing tiers (`FREE_SOLO`, `TEAM`, `GROWTH`). Final pricing is a separate discussion.

| Feature | Free Solo | Team | Growth |
|---|---|---|---|
| Expenses with slip photos, money accounts | ✓ (limit e.g. 30 expenses/month) | ✓ | ✓ |
| Creditors / supplier bills | trial only | ✓ | ✓ |
| Bank CSV import + reconciliation | trial only | ✓ | ✓ |
| Reports + accountant export | P&L only | ✓ | ✓ |
| Xero / Sage / QuickBooks sync | — | — | ✓ |

"Trial only" = included during the 30-day free trial, then locked with an "upgrade to keep this" prompt. The user's data is never hidden or deleted, only the ability to add more.

## Rough size

- Phase 1: 3–5 working sessions.
- Phase 2: 4–6 sessions (bank readers need real sample statements from each bank — **please collect one anonymised CSV export per bank from your beta friends**).
- Phase 3: 2–3 sessions per package, plus partner approval waiting time.

## Risks

- **VAT mistakes** hurt users with SARS. Keep VAT rules minimal, show VAT clearly, and have an accountant look over the VAT report before launch.
- **Bank CSV formats change** without notice. The "map columns yourself" fallback keeps users going when a reader breaks.
- **Scope creep** into full accounting. Anything not in this plan waits until beta users ask for it.

## Related, planned later

- **Client messaging (CRM):** notify clients by suburb/street (e.g. water outage), promotions to past clients. Email first, SMS later (costs ~30–50c each), WhatsApp last. Needs POPIA opt-out on every message. Separate plan.
- **Pricing tiers:** should be settled before Phase 1 is built, since every feature needs to know its tier.
