# Plan: Invoices and Payments (Phase 3)

Status: all 8 steps built and tested. Written 2026-09-26.

Each step below is one sitting of work that ends with something testable in
the browser, then a commit. Build them **in order**: each depends on the one
before. Model advice per step is given in brackets.

## The flow we're building

```
Job (needs invoicing) ──► Invoice (draft) ──► Issued: INV-0001, locked
                                                   │
                        WhatsApp link ──► Client opens /i/<token>
                                                   │
             ┌─────────────────────────────────────┼──────────────────────────┐
     Pays by EFT (bank details)       Pays online (PayFast: card,     Pays cash / card machine
             │                         Instant EFT, Capitec Pay,              │
     Owner records payment             SnapScan) — recorded           Owner records payment
             │                         automatically                          │
             └──────────────────────► Paid ──► Job completed ◄────────────────┘

Mistake on an issued invoice? ──► Credit note (CN-0001), never an edit
```

## Decisions already made (tell Claude if you disagree)

1. **Invoice numbers are allocated when the invoice is issued, not when the
   draft is created.** Drafts have no number, so deleting a draft never leaves
   a gap. SARS expects invoice numbers to run in sequence.
2. **A business moving from another system can set its starting number and
   prefix** (e.g. continue from INV-0458), but only until its first invoice
   is issued. After that the numbering is locked.
3. **Issued invoices are locked forever.** They're never edited or deleted.
   Mistakes are corrected with a credit note. Drafts can be edited or deleted
   freely.
4. **"Tax Invoice" vs "Invoice" is decided at the moment of issue**, from the
   business's VAT registration. The business's and client's details are
   copied onto the invoice at that moment (a "snapshot"), so changing your
   address next year doesn't alter old invoices.
5. **PDFs come from the browser's "Save as PDF"** using print-friendly
   styling. It's free and needs no PDF library. Emailed PDF attachments come
   later, with email.
6. **Money goes straight into each business's own account.** ServiceKasi never
   holds client money, so there's no payment-aggregator licensing.
7. **Each business chooses its payment provider.** PayFast is built first: one
   checkout gives clients card, Instant EFT, SnapScan and **Capitec Pay**
   (switched on automatically). Ozow and Yoco can be added later, one step
   each, without changing the rest.
8. **Payment provider passwords/keys are encrypted** in the database, never
   stored as plain text.
9. **The client pays the invoice amount; the provider's fee comes off the
   business's payout** (standard PayFast behaviour). No card surcharges.
10. **A job can have several invoices** (deposit, progress payment, final).
11. **Payments are never deleted.** A wrongly recorded payment is reversed,
    so there's always a trail of what happened.
12. **Deposits get their own tax invoice**, because VAT is due when a deposit
    is received. The final invoice then deducts the deposit, VAT included, so
    VAT is never charged twice.

## Small database additions

Add in Step 1's migration:

| Model | Field | Why |
|---|---|---|
| Invoice | `number String?` (was required) | Drafts have no number yet (decision 1) |
| Invoice | `buyerSnapshot Json?` | Client name, address, VAT number frozen at issue |
| Invoice | `notes String?` | Free-text note on this invoice |
| Tenant | `invoiceTerms String?` | Standard payment terms printed on every invoice |
| Tenant | `defaultPaymentTermsDays Int @default(7)` | Pre-fills "due date" (0 = due on receipt) |

Later steps add their own small fields (payment reversal, provider settings).

## Steps

### Step 1 — Invoice settings and numbering  [Opus 5.5]
Migration above. New "Invoices" section on `/settings/business`: payment
terms (days), standard invoice terms, and numbering (prefix + next number),
where numbering is editable only until the first invoice is issued.
**Test:** set prefix "INV-" and next number 458; confirm it saves; confirm
bad values (0, letters in the number) are refused.

### Step 2 — Draft invoices from jobs  [Sonnet 5]
- "Create invoice" on a job (highlighted when the job needs invoicing):
  copies the job's lines, client and property. Also "New invoice" from a
  client, for walk-in or counter sales with no job.
- `/invoices` list with filters (Draft / Unpaid / Overdue / Paid) and
  `/invoices/<id>` draft editor, reusing the quote line editor. Totals are
  recalculated **on the server** with `money.ts`.
- Drafts can be deleted.
**Test:** create an invoice from Thandi's completed job, change a quantity,
check the totals with VAT on and off.

### Step 3 — Issue, send and client view  [Opus 5.5, then Opus review]
- **Issue**: allocates the number (same transaction, so no gaps), sets
  Invoice vs Tax Invoice, issue date, due date, and both snapshots, then
  locks the lines.
- Tax invoices carry what SARS requires: the words "Tax Invoice", your name,
  address and VAT number, the invoice number and date, a description, the
  amounts and the VAT. Over R5,000, the client's name, address and VAT number
  (if they have one) are also required.
- Public page `/i/<token>` (no login, like quotes): the invoice, bank details
  with "use INV-0458 as your reference", and a print/Save-as-PDF button.
  Add `/i` to `PUBLIC_PATHS`, and use the raw prisma client in one small
  function that selects only what's shown and never costs or margins.
- "Send via WhatsApp" and "Copy link", like quotes.
- Opus `/code-review` before commit: it's another public page.
**Test:** issue it and see INV-0458; open the link in a private window and
print to PDF; confirm the draft can no longer be edited.

### Step 4 — Recording payments  [Sonnet 5]
- "Record payment" on an issued invoice: amount (defaults to the balance),
  date, method (EFT / cash / card machine / other), reference.
- Partial payments. Status moves to Part-paid / Paid automatically from the
  sum of payments.
- "Reverse" a wrong payment (decision 11).
- A job becomes COMPLETED once it has been invoiced and every issued
  invoice on it is paid.
**Test:** record R500 of R1,150 (part-paid), then the rest (paid, job
completed); reverse one and watch it go back.

### Step 5 — Credit notes  [Opus 5.5]
- "Credit note" on an issued invoice: full, or chosen lines/amounts.
  Numbered CN-0001 from its own gap-free sequence, shown on the client's
  invoice page, and reduces the balance owed.
- Recording a refund when the client had already paid.
**Test:** credit one line of a paid invoice, record the refund, check the
totals and VAT on both documents.

### Step 6 — Deposits  [Opus 5.5]
- On an approved quote with a deposit, "Invoice the deposit" creates a
  deposit tax invoice.
- The job's final invoice automatically includes "Less: deposit paid
  (INV-0459)" at the same VAT rate, so VAT isn't double-counted
  (decision 12).
**Test:** 50% deposit on a R2,300 quote, pay it, finish the job, and check
the final invoice asks for exactly the other half.

### Step 7 — Online payments with PayFast  [Opus 5.5]
- `/settings/payments`: choose the provider (PayFast for now) and enter the
  business's own merchant ID, key and passphrase, encrypted (decision 8).
- "Pay now" on the client's invoice page opens PayFast's checkout (card,
  Instant EFT, Capitec Pay, SnapScan…).
- PayFast confirms payment by calling us back (an "ITN"). We check the
  signature, confirm it with PayFast's server, check the amount, and record
  it only once even if PayFast calls twice.
- Built behind a small "payment provider" interface so Ozow or Yoco can be
  added later without touching invoices.
- **Needs a public web address** for PayFast to call back. Decide hosting
  first, or use a temporary tunnel for testing. Built and tested against
  PayFast's free sandbox.
**Test:** pay an invoice in the PayFast sandbox and watch it turn Paid by
itself.

### Step 8 — Money owed and reminders  [Sonnet 5]
- Dashboard card: total outstanding, total overdue.
- Overdue list, oldest first (0–30 / 31–60 / 60+ days), with "Send reminder"
  via WhatsApp including the pay link.
**Test:** backdate an invoice's due date and see it appear as overdue.

## After Phase 3

- More providers: Ozow, Yoco (one step each; Opus, since they involve
  payment callbacks).
- Automatic invoicing for recurring contracts (monthly pool service).
- Emailing invoices with a PDF attached.
- Client statements.

## Model guide for this plan

| Work | Model |
|---|---|
| Steps 2, 4, 8 (screens, forms, lists) | Sonnet 5 |
| Steps 1, 3, 5, 6, 7 (numbering, tax, credit notes, deposits, payment callbacks) | Opus 5.5 |
| Step 3 security review | Opus 5.5 |
| Commit and push after each step | Haiku 4.5 |
