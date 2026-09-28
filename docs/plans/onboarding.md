# Plan: First-day setup (Phase 4)

Status: Steps 1, 2, 3 and 4 done. All three "Later" items — CSV client import, the Google Business Profile booking page, and review requests — done 2026-09-28. Written 2026-09-27.

Goal: a new business signs up and sends its first quote or invoice in under
15 minutes, without reading a manual. Every step ends with something testable
in the browser, then a commit.

## Decisions

1. **Signup stays short.** Business name, your name, email, password, and
   "What's your trade?". Nothing else. Every extra field at signup loses
   people before they've seen the product.
2. **Business details (address, VAT, bank) are asked for when they matter**:
   through the getting-started checklist, and at the moment a quote or
   invoice is issued (issuing already refuses when required details are
   missing).
3. **Trades are picked from a short list**: Plumbing, Electrical,
   Landscaping & gardens, Pool maintenance & repairs, General maintenance,
   Other. Picking one copies a starter price list into the business's own
   price list.
4. **Starter price lists live in code, not a database table.** They're copied,
   so each business owns and edits its copy. A plumber who also spreads
   compost just adds a line, or adds another trade's starter items.
5. **Adding starter items never duplicates.** An item whose name the business
   already has (even a switched-off one) is skipped.
6. **Guidance is a checklist, not a gate.** Nothing forces a user through
   setup. The dashboard shows "Getting started" until everything's done or
   they hide it, and it's always reachable again from the sidebar.

## Steps

### Step 1 — Trade and starter price list  [Opus 5.5] ✅ done
- `Tenant.industry` (optional).
- Starter price lists for the six trades (placeholder prices, clearly
  editable).
- Signup asks "What's your trade?" and fills the price list straight away.
- Price list page: "Add starter services" panel to pick a trade and add its
  items later, for existing businesses or anyone who skipped.
**Test:** sign up as a plumber, see the price list filled; add the
landscaping starter items too and confirm nothing is doubled.

### Step 2 — Getting-started checklist  [Sonnet 5] ✅ done
- Dashboard card worked out from real data: business details, price list,
  first client, first quote sent, first invoice issued, bank details,
  online payments (optional), authenticator app.
- Each item links straight to where it's done. "Hide checklist" stores
  `Tenant.onboardingHiddenAt`.
- A "Getting started" link in the sidebar (Operations group) appears only
  while something's left to do, and opens `/getting-started`, the full
  checklist plus a way to bring it back onto the dashboard.

### Step 3 — New quote / invoice from anywhere  [Sonnet 5] ✅ done
- `/quotes/new` and `/invoices/new` without a client show a first step:
  search existing clients, or add a new one right there (name, phone or
  email, address), then go straight into the builder with them.
- "+ New quote" and "+ New invoice" buttons on the dashboard, next to
  "+ New job".

## Step 4 — Authenticator app: "Skip for now"  [Opus 5.5] ✅ done
- After signup the owner still sees the authenticator setup first, now with
  a warning and "Skip for now".
- Skipping is recorded (`User.totpSkippedAt` plus an audit log entry), as a
  record that the owner declined.
- A reminder bar shows on every page until it's switched on.
- Connecting online payments still requires it (those settings move money).

### CSV client import  [Sonnet 5] ✅ done
- `/clients/import`: download a template CSV, choose a file, see a live
  preview (valid rows ready to import, invalid ones skipped with a reason)
  before anything is sent to the server.
- Each row goes through the exact same validation and creation code as the
  single "Add client" form (`src/lib/clients/schema.ts`, `create.ts`), so an
  imported client is indistinguishable from a hand-typed one — including
  getting a Property row when a street and city are given.
- A row matching an existing client's phone or email is skipped, not
  duplicated, so re-running the same file (or an updated export) is safe.
- A 500-row cap per file; anything larger asks the user to split it.
**Tested:** a 3-row file with a bad row (no phone/email) correctly imported
2 and skipped 1; re-importing the same file skipped both as duplicates; a
file with the wrong columns was rejected before anything was sent.

### Google Business Profile booking page  [Sonnet 5] ✅ done
- `/book/<slug>`: a public, unauthenticated "Request a quote" page — name,
  phone, what's needed, an optional preferred date. No login, no client
  record needed to submit. Meant to be pasted into a Google Business
  Profile's booking/website link (Google shut down in-profile messaging in
  2024, so a link is the realistic route) — deliberately left indexable,
  unlike the app's token-gated public pages (`/q/<token>`, `/i/<token>`),
  since this one's the point of being found.
- Settings → Business shows the link with a one-tap copy button, and a
  reminder that new requests land under **Requests** in the sidebar.
- New sidebar page `/requests` (owner/office only) lists every open lead:
  who, their number, what they need, when they'd like it done, and where
  it came from (`ServiceRequest.source`). "Add as client" turns it into a
  real `Client` — reusing the exact same `createClient` the CSV import and
  the "Add client" form both use — using their given name (split on the
  first space into first/last) and phone, then jumps straight to that
  client's row so "New quote"/"New job" are one click away, no retyping.
  "Dismiss" clears a lead that's going nowhere. Either way it leaves
  `ServiceRequest`; nothing is deleted.
- Spam protection: since a booking slug is a stable, publicly-advertised
  value (unlike a quote/invoice's unguessable per-document token, the only
  "protection" anywhere else in the app), a hidden honeypot field quietly
  no-ops a bot's submission — it sees a normal success message but no
  `ServiceRequest` is created. No IP throttling or CAPTCHA yet; revisit if
  beta shows real spam volume, consistent with the rest of the app
  currently shipping with zero bot protection beyond token secrecy.
**Tested:** submitted a real request through the public page and watched
it land in `/requests`; "Add as client" created the client correctly
(phone normalized, notes carried over) and redirected straight to it;
"Dismiss" cleared a lead without creating anything; filling the honeypot
field showed the visitor a normal success message while creating no row;
an unknown slug 404s.

### Review requests  [Sonnet 5] ✅ done
- `Tenant.googleReviewUrl` (optional) — set once in Settings → Business
  under "Reviews", with a hint on where to find it in the Google Business
  Profile dashboard.
- Once set, any invoice showing status **Paid** gets an "Ask for a review"
  card with a one-tap "Send via WhatsApp" link, prefilled with a short
  thank-you message and the review link — same `wa.me` pattern already
  used to send the invoice itself, so no new sending mechanism was needed.
  Nothing is sent automatically; the owner still taps to send, same as
  every other WhatsApp message in the app.
- Shown only when the invoice is fully paid (not part-paid, not just a
  zero balance from a void or credit) and the client has a phone number.
**Tested:** set the link in settings, confirmed the card appears on a Paid
invoice with a correctly formatted WhatsApp link (client's number, review
URL included) and does not appear on an unpaid one.
