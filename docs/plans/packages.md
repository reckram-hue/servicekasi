# Packages (Free Solo / Team / Growth) — plan

Status: approved 2026-09-27. Nothing built yet.

## Agreed with the owner

- The six decisions below are approved.
- **Online payments are paid** (Team and up).
- **Beta testers get everything** (Growth, ACTIVE, free). When the beta ends, they're told in advance and given a 30-day trial countdown before their package applies.
- **Team limit starts at 5 people** but may be too high for the target market. All limits and feature placements must be easy to change after beta feedback — one settings file, no database changes needed.

## The goal

Every business gets the **full app for 30 days**. When the trial ends they either choose a paid package or drop to Free Solo, and the features they lose are clearly shown with "Upgrade to keep this". The idea: they get used to the good stuff, then miss it.

Charging money (subscriptions) is **not** in this plan. Beta users won't pay yet. That's a later phase.

## What's already there

The database already stores, per business: `plan` (FREE_SOLO / TEAM / GROWTH), `subscriptionStatus` (TRIALING / ACTIVE / PAST_DUE / CANCELLED) and `trialEndsAt` (set to signup + 30 days). Nothing reads them yet.

## Decisions (please confirm or change)

1. **The trial is Growth.** During the 30 days a business gets everything, including team and top-tier features. (A "reverse trial" — the most effective way to make people miss features.)
2. **After the trial, nothing is ever deleted or hidden.** Old quotes, invoices, jobs, photos, reports stay viewable. What's locked is *creating more* of a paid feature.
3. **Money from clients is never blocked.** If an invoice with a "Pay now" link was sent during the trial, the client can still pay it after the trial. We only stop adding "Pay now" to new invoices.
4. **Extra team members are paused, not removed.** If a business drops to Free Solo with 3 technicians, the technicians can't log in until they upgrade. Their history and jobs stay. The owner sees exactly who is paused and why.
5. **Checks happen on the server, not just by hiding buttons.** Hiding a button is for looks; the real check sits in the code that saves data, so nobody can get around it.
6. **One file decides who gets what.** Moving a feature between Team and Growth later is a one-line change in that file.

## Which package gets what (first version)

Prices are placeholders — to decide separately.

| Feature | Free Solo | Team | Growth |
|---|---|---|---|
| Clients, quotes, jobs, schedule, invoices, credit notes | ✓ | ✓ | ✓ |
| Recurring jobs | ✓ | ✓ | ✓ |
| Job photos | ✓ (limited storage) | ✓ | ✓ |
| Price list, onboarding, authenticator | ✓ | ✓ | ✓ |
| People who can log in | Owner only | Up to 5 | Unlimited |
| Technician app (My day, "on the way" message) | — | ✓ | ✓ |
| Online payments ("Pay now" on invoices) | — | ✓ | ✓ |
| Automatic payment reminders | — | ✓ | ✓ |
| Online booking page / service requests | ✓ | ✓ | ✓ |
| Bookkeeping: expenses + slips *(planned)* | ✓ (30/month) | ✓ | ✓ |
| Bookkeeping: creditors, bank reconciliation, reports *(planned)* | — | ✓ | ✓ |
| Client messaging by area, promotions *(planned)* | — | — | ✓ |
| Xero / Sage / QuickBooks sync *(planned)* | — | — | ✓ |

Why this split: Free Solo is a genuinely useful tool for a one-person business (so they stay and recommend us), but anything that saves serious time or brings money in faster (online payments, reminders, bookkeeping) is paid. Team is priced on "I have staff". Growth is priced on "I want to grow and I have an accountant".

Online payments: **paid** (decided).

## What gets built

**1. The rulebook — `src/lib/plans/`**
- A list of features and which package each belongs to, plus limits (people, photo storage, expenses per month).
- `currentPackage(business)`: works out what the business actually has right now:
  - trial still running → Growth
  - status ACTIVE → the package they're on
  - anything else (trial over, cancelled) → Free Solo
- `canUse(business, feature)` and `requireFeature(...)` used by every server action that creates something paid.

**2. Locking the existing features**
- Adding a technician / team member → checks the people limit.
- Technician login → refused with a clear message if that person is paused.
- Saving PayFast settings and adding "Pay now" to new invoices → Team and up.
- Payment reminders → Team and up.
- Each locked button shows a small "Team" or "Growth" badge instead of disappearing, and tapping it opens the upgrade prompt.

**3. Trial countdown**
- A slim banner for owners: "12 days left of your free trial" — from day 20 onwards, amber in the last 3 days.
- On the day it ends: a one-time screen listing what they used during the trial that will now be locked (e.g. "You sent 4 invoices with Pay now and added 2 technicians"). This is the "miss it" moment.

**4. "Your package" page (Settings → Package)**
- Current package, trial days left, side-by-side comparison table, "Choose this package" buttons.
- Until billing exists, "Choose" sends you (the ServiceKasi owner) a request — e.g. an email or a WhatsApp link — and you switch them on by hand.

**5. A way for you to change a business's package**
- There's no admin screen yet. A small command-line script: `npm run set-package -- <business email> TEAM` (or GROWTH, FREE_SOLO, or `--extend-trial 30`). Enough to run the beta.
- Beta friends: set to Growth as ACTIVE, free for the beta, and marked as beta (`npm run set-package -- <email> --beta`) so they can be found again later.
- **Ending the beta:** `npm run set-package -- --end-beta 30` puts every beta business back on a 30-day trial countdown in one go, so the countdown banner and "what you'll lose" screen do the explaining. You send them a heads-up message first.

**6. Test data**
- Seed businesses get `ACTIVE` + `GROWTH` so testing isn't cut off by a trial expiring.

## Not in this plan

- Taking payment for subscriptions (PayFast recurring billing) — next phase, once prices are set.
- A proper admin dashboard for you to manage all businesses.
- Old prototype files that use different package names (`src/types/multiTenant.ts`, `SuperAdminView`, `WebhookHub`, `LeadCaptureModule`) — leave alone for now; clean up separately.

## Rough size

2–3 working sessions. Steps 1–2 first (the rules and the locks), then 3–5 (what the user sees), then 6.

## How we'll test

- A business on day 5 of the trial can do everything.
- Move its trial end date into the past: technicians are paused, "Pay now" disappears from new invoices, an already-sent Pay now link still works, old data all still visible.
- `set-package` to TEAM: everything comes back.
- Try to call a locked action directly (not via the button) and confirm it's refused.
