# Plan: Quotes and Jobs (Phase 2)

Status: all steps built and tested. Written 2026-09-26.

Each step below is one sitting of work that ends with something testable in
the browser, then a commit. Build them **in order**: each depends on the one
before. Model advice per step is given in brackets.

## The flow we're building

```
Client ──► Quote (draft) ──► Sent (public link) ──► Client approves online
                                                        │
Emergency call-out ───────────────────────────────► Job ◄┘
                                                        │
                                            Visit(s) on the calendar
                                                        │
                                   Technician: en route → on site → done
                                                        │
                                          "Needs invoicing" (Phase 3)
```

A Job can start from an approved Quote **or** be created directly (most
emergency work — burst geyser, tripped DB board — is never quoted).

## Decisions already made (tell Claude if you disagree)

1. **Sending quotes: WhatsApp share link, not automated messages.** "Send"
   opens the owner's own WhatsApp with the client's number and a message
   containing the quote link (a `wa.me` link). Free, works today, no Meta
   Business account. Email and automated WhatsApp come later.
2. **Clients approve without logging in**, via a private link
   (`/q/<token>`). They type their name and tick "I accept". We record name,
   time and IP address as proof of acceptance.
3. **Deposits are recorded, not collected yet.** A quote can say "50% deposit
   required"; online card/EFT collection arrives with payments (Phase 3).
4. **Quote numbers are allocated when the quote is created** (Q-0001, Q-0002
   …). Gaps from deleted drafts are fine for quotes. Only *invoices* must be
   gap-free (SARS).
5. **Editing a sent quote** puts it back to Draft; it must be re-sent.
   **Approved quotes are locked**. To change one, duplicate it.
6. **VAT:** each line stores its own tax rate, copied from the business
   settings when the line is created: 15% if VAT-registered, 0% if not.
   Tax is calculated **per line, rounded to the cent**, then summed. One
   shared function does this for quotes, jobs and invoices.
7. **One-off visits first.** Recurring work (weekly pool service, etc.) is
   Step 7, after the one-off flow is solid.
8. **Photos and client signatures are Phase 2b.** They need file storage,
   which is a separate decision (cost and where data lives, for POPIA).

## Small database additions

Add in Step 1's migration:

| Model | Field | Why |
|---|---|---|
| Tenant | `quoteTerms String?` | Standard terms printed on every quote |
| Tenant | `defaultQuoteValidDays Int @default(30)` | Pre-fills "valid until" |
| Quote | `clientMessage String?` | What the client wrote when requesting changes |
| Quote | `approvedIp String?` | Proof of acceptance |
| Quote | `depositPercent Int?` | Show "50% deposit" instead of a fixed amount |
| LineItem | `selected Boolean @default(true)` | Client ticked/unticked an optional line |

## Steps

### Step 1 — Business settings page  [Sonnet 5]
`/settings/business`, owner/admin only. Fields: business name, trading name,
VAT registered (yes/no), VAT number (checked with `isValidSarsVatNumber`),
VAT rate (default 15%), company reg number, address, phone, email, bank
details, quote terms, default quote validity. Needed first because quotes
print these details.
**Test:** turn VAT on/off and confirm it saves; an invalid VAT number shows an
error.

### Step 2 — Money maths module + tests  [Sonnet 5]
`src/lib/money.ts`: `lineTotals(line)`, `documentTotals(lines)` (skips
optional lines that aren't selected), `formatMoney(cents, currencyCode)`,
`parseMoneyInput("1 250,50")` → 125050 (accept both `,` and `.` decimals,
spaces as thousands separators, as South Africans type both). Plain
functions, no database. Add a small test script (`node --experimental-strip-types`)
covering rounding, 0% VAT, optional lines, and quantities like 1.5 hours.
**Test:** script prints all passing.

### Step 3 — Price list  [Sonnet 5]
`/settings/price-list`: add/edit/deactivate services, materials, call-out
fees (the `CatalogItem` model). Cost price and selling price, both excl. VAT.
Kept short on purpose; it exists so Step 4 can pick lines quickly.
**Test:** add "Call-out fee R450" and "Geyser element R380 (cost R210)".

### Step 4 — Quote builder  [Sonnet 5]
- `/quotes`: list with status filter (Draft / Sent / Approved / Changes requested / Declined).
- `/quotes/new?client=<id>` and `/quotes/<id>`: pick client + property, title,
  lines (pick from price list or type freely), quantity, price, optional
  toggle, deposit, valid-until, notes. Live totals using Step 2's module.
- **Internal-only** margin display: cost vs price, gross profit, margin %
  (reuse the idea from the prototype's `JobCostingPnLReport`). Never shown to the client.
- All saves recalculate totals **on the server** (never trust browser totals).
- Number allocated with `nextDocumentNumber(tx, tenantId, 'QUOTE')` inside the
  same transaction as the create.
- "New quote" button on each client row in `/clients`.
**Test:** build a quote with an optional line; check totals with VAT on and off.

### Step 5 — Sending and client approval page  [Sonnet 5, then Opus review]
- "Send" button: marks as Sent, shows **Copy link** and **Send via WhatsApp**
  (`wa.me/<client phone>?text=...` using the client's phone). Message text
  in the client's preferred language comes in Phase 4 (translation); English
  for now.
- Public page `/q/<token>`: business logo/name, quote lines, totals, terms,
  optional lines as checkboxes, **Approve** (name + tick) / **Request changes**
  (message) / **Decline**. Mobile-first: most clients will open this on a
  phone from WhatsApp.
- `/q` must be added to `PUBLIC_PATHS` in `src/proxy.ts`.
- This page looks up the quote by token with the **raw** prisma client (there
  is no logged-in business). That's the one allowed exception to `tenantDb`,
  so keep the query in one small function, select only the fields shown,
  and never expose cost prices or margins.
- Expired quotes (past `validUntil`) show "expired, contact us" and can't be approved.
- Opus review before commit: public, unauthenticated pages are where security
  mistakes cost the most. Run `/code-review` on Opus.
**Test:** open the link in a private window, untick an optional line,
approve, and confirm the owner sees "Approved by Thandi, 14:32" with the new total.

### Step 6 — Jobs and visits  [Sonnet 5]
- "Convert to job" on approved quotes: copies selected lines, client,
  property; quote → CONVERTED. Also "New job" directly from a client
  (emergency work, no quote).
- `/jobs` list and `/jobs/<id>` detail: lines, visits, status.
- Add visit: date, start/end time, assign one or more technicians,
  instructions for the technician.
- `/schedule`: simple day and week **list** view grouped by technician, with
  a warning when a technician is double-booked. (Drag-and-drop calendar is a
  later upgrade; the prototype's `TeamCalendarView` can be reused then.)
- Job status follows its visits automatically: any visit scheduled →
  SCHEDULED; any on site → IN_PROGRESS; all complete → REQUIRES_INVOICING.
**Test:** convert Thandi's quote, schedule a visit for Sipho tomorrow 09:00–11:00.

### Step 7 — Technician's day  [Sonnet 5]
Replace the "Your jobs for today will appear here" placeholder:
- Today's visits (and tomorrow's), in time order, with address, access notes,
  client phone (tap to call), **Navigate** (Google Maps link, already in
  `southAfrica.ts`), and instructions.
- Big status buttons: **On my way** → **Arrived** → **Done** (+ notes), or
  **No access** (client not home / gate locked).
- Technicians only see visits assigned to them, and never see prices or margins.
- Built for a cheap Android phone: big tap targets, little data.
**Test:** log in as Sipho via `/api/dev/login-as/technician`, move the visit
through each status, and confirm the owner's job page updates.

### Step 8 — Recurring jobs  [Opus 5.5]
Weekly/fortnightly/monthly visits (pool, garden, aircon service). Generate
visits a few weeks ahead from `recurrenceRule`; editing "this visit" vs "all
future visits"; stopping a contract. Opus because the date logic
(time zones, month ends, public holidays) is where subtle bugs hide.

## After Phase 2

- **2b:** photos and client signature on site (needs a file storage decision).
- **Phase 3:** invoices from jobs, online payments (PayFast/Yoco/Ozow), deposits.
- **Phase 4:** multilingual team messaging and client messages in their language.

## Model guide for this plan

| Work | Model |
|---|---|
| Steps 1–4, 6, 7 (screens, forms, lists) | Sonnet 5 |
| Step 5 security review, Step 8 recurring logic | Opus 5.5 |
| Commit and push after each step | Haiku 4.5 |
