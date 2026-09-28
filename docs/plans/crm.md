# Client relationship features (CRM) — plan

Status: proposed 2026-09-28 [Opus 5.5]. Nothing built yet — decisions below need the owner's OK first.

## The goal

The owner asked for four things: a **timeline** of everything that's happened with a client, **notes and tags** on clients, a **lead/deal pipeline**, and **follow-up reminders**. Underneath all four is the same problem the voice memo feature was built for: a busy trades owner forgets things. They forget what they last did for a client, forget that a quote is sitting unanswered, forget to phone someone back. The test for every decision below is: *does this help the owner remember, without asking them to do extra admin?* Tradespeople will not maintain a CRM. Anything that needs manual upkeep will be ignored within a week.

## What exists today (checked in the code, 2026-09-28)

- **There is no client page.** `/clients` is a searchable list with edit-in-a-modal. Nowhere shows one client's quotes, jobs and invoices together. When a lead becomes a client, the app sends the owner to `/clients?q=<phone>`, a filtered list.
- **Notes** are one free-text box on `Client` (`Client.notes`), overwritten on edit. There's no history and no dates. When a request becomes a client (voice memo booking, "Add as client"), the request's description is copied into this box.
- **Tags** don't exist.
- **A pipeline already exists, informally.** It runs `ServiceRequest` (lead, NEW → CONVERTED/DISMISSED) → `Quote` (DRAFT → SENT → APPROVED / CHANGES_REQUESTED / DECLINED → CONVERTED) → `Job`. Quotes have `sentAt` and `approvedAt` dates. Nothing ever sets a quote to `EXPIRED`: a quote past its "valid until" date just stays SENT forever.
- **Reminders** don't exist. There's no way to reach the owner outside the app: no email provider yet (blocked on the brand/domain decision, see `client-messaging.md` Step 4), no push notifications, and WhatsApp-to-self would need the Business API.
- `Conversation` / `Message` models exist in the schema but nothing uses them (early scaffolding for two-way chat). `AuditLog` is written only for invoices, payments and security events. Neither is a good base for a timeline.

## Decisions (please confirm or change)

1. **A proper client page first: `/clients/[id]`.** Everything else needs a home. It shows contact details, properties, quick buttons (new quote / job / invoice, WhatsApp, call), the notes, tags, follow-ups and the timeline. The client list's names link to it, and the "Add as client" and voice-memo flows land on it instead of the filtered list.

2. **The timeline is worked out from existing records, not stored separately.** It reads the requests, quotes (created / sent / approved / declined), jobs, completed visits, invoices issued, payments received, broadcasts sent and notes that already exist, and merges them by date. There's no new "activity" table to keep in sync, so it can't drift from the truth. It also works for every client already in the system, going back to day one. One honest gap: declined quotes have no "declined at" date, so they show the quote's last-changed date. That's close enough, since declined quotes rarely get edited afterwards.

3. **Notes become a dated log, and the old box becomes "Key info".** New `ClientNote` rows (who wrote it, when, text) appear on the client page and in the timeline. The existing `Client.notes` box stays, relabelled **"Key info"** and pinned at the top. It's for things that are always true, like "Always phone the wife, not him" or "Pays late, ask for a deposit". Existing content is kept as-is. Requests turned into clients stop copying their description into Key info, because the request already shows in the timeline.

4. **Notes are office-only.** Technicians don't see client notes in v1, because notes can hold things like "difficult, insist on deposit". Gate codes and dog warnings already reach technicians through the property's access notes, which is the right place for them. The note box will show a small hint: "Don't store ID or bank numbers here" (POPIA).

5. **Tags are simple labels typed on the client, with suggestions.** Examples: "pool service", "annual contract", "complex: Sunset Villas", "VIP". They're stored on the client as a list, and typing suggests tags already used in the business, so "pool" and "Pool Service" don't split into two. No tag-management screen in v1. Renaming a tag everywhere is one small action. Tags show up in three places:
   - the client list, to filter by tag;
   - the client page;
   - **the broadcast audience builder**, for example "send to everyone tagged *annual contract*". This is the tie-in with the messaging already built, and probably the most valuable use of tags.

6. **Follow-ups are simple dated reminders, shown in the app.** Each is "follow up with Dennis on 5 Oct: chase quote Q-0012", optionally linked to a quote or job, and marked done with one tap. Quick picks are 3 days, 1 week, 2 weeks, 1 month, or a date. They appear:
   - on the **dashboard** as "Follow-ups due" (overdue plus today), the first thing the owner sees;
   - on the client page;
   - as a count on the sidebar.

   **Honest limitation:** these are in-app only, so the owner has to open the app to see them. When email sending exists (messaging Step 4), we add a morning "due today" email. That's the upgrade path, and it's not built now.

7. **Offer a follow-up at the moment it matters, never create one silently.** When a quote is sent, the confirmation offers "Remind me to follow up in 3 days" as a ticked checkbox the owner can untick. Reminders nobody asked for become noise that trains people to ignore the list.

8. **The pipeline is a *view* of the real records, not a new thing to maintain.** A board with columns worked out from actual statuses:
   - **New leads**: requests not yet actioned
   - **Quoting**: draft quotes
   - **Waiting on client**: sent quotes, with days waiting shown and anything past "valid until" flagged as expired
   - **Changes requested**
   - **Won**: approved or converted to a job, in the last 30 days
   - **Lost**: declined, dismissed, or expired, in the last 30 days

   The owner never drags cards or updates stages by hand. Cards move by themselves as real work happens (sending a quote, the client approving). Each column shows its rand value, and there's a simple win rate. The alternative, a separate "Deal" object with hand-set stages, would be a second system beside Requests/Quotes/Jobs that nobody keeps up to date. **I'd reject that.**

9. **Quotes past their "valid until" date count as expired in the pipeline**, worked out on the fly. We don't add a background job to flip the status, because nothing runs on a schedule in this app today. A stored `EXPIRED` status can wait until there's a reason for one.

10. **Package placement:** the client page, timeline, notes, tags and follow-ups are on **every package, Free Solo included**. They cost us nothing to run, and a solo operator who can't see a client's history or remember to follow up won't stick with the app. The **pipeline board goes on Team and up**: it earns its keep once there's enough volume or office staff to manage. Filtering broadcasts by tag is already Team-gated through the broadcast feature itself.

## An honest view on order and on the pipeline

The pipeline is the flashiest item and the **least useful for this audience**. Plumbers and electricians don't think in "deals". What actually costs them money is a sent quote nobody chased. Follow-ups plus the "waiting on client" count cover most of that value. So the pipeline goes **last**, and it's a candidate to skip until beta users ask for it. The client page and follow-ups are where most of the value is.

## Steps

### Step 1 — Client page with timeline  [Sonnet 5]
`/clients/[id]`: contact details, properties, quick actions and the derived timeline (decision 2). Link to it from the client list (the name), from the job/quote/invoice detail pages (client name), and from the two request-to-client flows (replacing `/clients?q=…`). Editing stays in the existing modal, opened from the page.
**Test:** a client with a request → quote → job → invoice → payment shows all of it, newest first, with correct dates. A client with nothing shows a friendly empty state. Another business's client id returns not found (tenant isolation).

### Step 2 — Notes log and Key info  [Sonnet 5]
`ClientNote` model and migration, add/delete a note on the client page, notes in the timeline, "Key info" relabel and pinned box, and stop copying request descriptions into it (decision 3). Office roles only (decision 4).
**Test:** notes appear newest first with author and time. A technician login can't read or add them. Existing Key info text is unchanged after the migration.

### Step 3 — Tags  [Sonnet 5]
`Client.tags` (text list) and migration, tag input with suggestions on the client form, tag chips on the client page and list, a tag filter on the client list, a tag filter in the broadcast audience builder, and rename-everywhere.
**Test:** "Pool Service" and "pool service" end up as one tag. Filtering by tag in the list and in a broadcast preview returns the right clients. Renaming updates every client.

### Step 4 — Follow-up reminders  [Sonnet 5]
`FollowUp` model (client, optional quote/job, due date in the business's time zone, note, assigned person, done-at). Add or complete from the client page, a "Follow-ups due" card on the dashboard, a sidebar count, and the "remind me in 3 days" offer when sending a quote (decision 7).
**Test:** an overdue follow-up shows on the dashboard in red. Ticking it done removes it everywhere. Sending a quote with the box ticked creates one for 3 days later, and unticked creates nothing. Due dates don't shift at midnight UTC (the business's time zone is used).

### Step 5 — Pipeline board  [Sonnet 5] (candidate to defer)
`/pipeline`, gated to Team: columns and rand totals worked out from requests and quotes (decisions 8 and 9), days waiting, the expired flag and a 30-day win rate. Each card opens the real request or quote.
**Test:** sending, approving and declining a quote moves it between columns with no manual step. An old SENT quote past its valid-until date shows as expired. Totals match the quotes' values.

## Risks

- **Timeline performance on busy clients.** The timeline reads from about eight tables per page view. That's fine at beta scale, since one client has tens of records, not thousands. If it ever slows, cap to the last 12 months with a "show older" link.
- **Follow-ups only work if the owner opens the app.** This is decision 6's limitation. The morning email (after messaging Step 4) is the real fix, so the two plans are linked.
- **Tag sprawl.** Suggestions reduce it but won't stop it. Rename/merge covers the rest; a proper tag manager can come later if needed.
- **Scope creep.** Four features is a lot to land before beta feedback on the core app. The steps are built to ship one at a time, and each is useful on its own.

## Model guide for this plan

| Work | Model |
|---|---|
| This plan | Opus 5.5 |
| Steps 1–5 | Sonnet 5 |
| Commit and push after each step | Haiku 4.5 |
