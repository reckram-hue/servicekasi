# Plan: First-day setup (Phase 4)

Status: Steps 1, 2 and 4 done; Step 3 next. Written 2026-09-27.

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

### Step 3 — New quote / invoice from anywhere  [Sonnet 5]
- `/quotes/new` and `/invoices/new` without a client show a first step:
  search existing clients, or add a new one right there (name, phone or
  email, address), then go straight into the builder.
- "+ New quote" and "+ New invoice" buttons on the dashboard.

### Step 4 — Authenticator app: "Skip for now"  [Opus 5.5] ✅ done
- After signup the owner still sees the authenticator setup first, now with
  a warning and "Skip for now".
- Skipping is recorded (`User.totpSkippedAt` plus an audit log entry), as a
  record that the owner declined.
- A reminder bar shows on every page until it's switched on.
- Connecting online payments still requires it (those settings move money).

## Later
- CSV client import.
- Google Business Profile: a public "Request a quote" page per business
  (`/book/<slug>`, the slug already exists) to paste into the profile's
  booking/website link. Google shut down in-profile messaging in 2024, so a
  link is the realistic route.
- Review requests: after a job is paid, a WhatsApp message with the
  business's Google review link.
