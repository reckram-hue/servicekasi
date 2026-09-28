# Client messaging (CRM broadcasts) — plan

Status: decisions confirmed 2026-09-28 [Opus 5.5]. Steps 1–3 and 5 built and tested 2026-09-28 [Sonnet 5] — WhatsApp broadcasts with POPIA opt-outs and history are live. Step 4 (email sending) not started — blocked on the product name/domain decision.

## Confirmed with the owner (2026-09-28)

- WhatsApp send lists first, email second — agreed.
- Package placement (decision 10) — agreed.
- **SMS: keep as an optional add-on later**, for the businesses (or their clients) who still want it. Owner's view: SMS is fading in SA because people are bombarded with it, so it's not a priority channel — but worth offering. Build the send pipeline so a channel can be added without reshaping `Broadcast`.
- **Sending domain and product name are not final.** The "ServiceKasi" name may change. Never hard-code the domain or brand: the sending address comes from an env var (`EMAIL_FROM_DOMAIN`), and the product name shown in emails from one config value.

## The goal

Let a trades business send one message to many of its own clients, for two very different reasons:

- **Service notices** — "Water main burst on Vilakazi Street, we're on standby", "We're closed 16 Dec – 5 Jan", "Load-shedding: geyser timers may need resetting". Useful, expected, not selling anything.
- **Marketing** — "Winter geyser check, R450 this month", "It's been a year since we serviced your pool". Selling something.

Today the app can only message one person at a time, and only by the owner tapping a WhatsApp link. There is no email or SMS sending at all (checked: no provider in the codebase).

## What the law asks (POPIA) — in plain terms

This is our reading, not legal advice. Worth one conversation with an attorney before marketing sends go live.

- **Service notices** are not direct marketing. They can go to any client whose details you hold for the work you do for them.
- **Marketing** to your **own existing clients** is allowed without a fresh opt-in *only if*: you got their details while doing work for them, you're marketing your own similar services, and **every single message gives them an easy way to say no** — and you honour it. (POPIA section 69(3).)
- Marketing to **anyone else** (a lead who never became a client, a bought list) needs **prior opt-in**. We simply won't allow that — broadcasts only go to clients.
- Every refusal must be **recorded and respected forever**, including on other channels.

## Decisions (please confirm or change)

1. **Two kinds of broadcast, handled differently.** The owner picks "Service notice" or "Promotion" when writing. Promotions always carry an opt-out and never go to anyone who has opted out. Service notices go to everyone in the chosen audience (but still skip anyone archived). We show a one-line warning if a "service notice" reads like a sale ("R", "%", "special") — a nudge, not a block.

2. **Broadcasts only ever go to existing clients.** Not to leads in Requests, not to imported lists of strangers. (A CSV-imported client counts as a client — they're the business's own customers.)

3. **WhatsApp first, done the free way.** For the first version, a WhatsApp broadcast produces a **send list**: one tap-to-send `wa.me` button per client, message prefilled, ticked off as the owner goes. No Meta approval, no per-message cost, works on day one, and matches how every other WhatsApp message in the app works. Slower for 200 clients, fine for 30 — which is the realistic size of our beta users' lists.

4. **Email second, sent by the app.** Add one transactional email provider (recommend **Resend**: free up to 3,000 emails/month, simple API; alternative Postmark). Sent from `noreply@servicekasi.co.za` with the business's name as sender name and the business's own email as reply-to. Every email carries a one-click unsubscribe link.

5. **SMS and WhatsApp Business API: later, not now.** SMS costs roughly 30–50c a message in SA and needs a paid provider; the WhatsApp Business API needs Meta business verification, pre-approved message templates, and per-conversation fees. Both wait until beta users ask for them.

6. **Opt-out is one flag per client, shared across channels.** `Client.marketingOptOutAt` — set by the email unsubscribe link, by the owner ("Client asked to stop" on the client page), or by the client replying STOP on WhatsApp (owner records it). Once set, no promotion reaches them on any channel. Service notices still do. Nothing is deleted; the date stays as the record.

7. **Audience = simple filters over data we already have.** Pick any combination:
   - Suburb / city (from their property addresses — a picker of places that actually appear in your client list, no maps or geocoding)
   - "Had work done in the last N months" / "No work in the last N months" (win-back)
   - Everyone
   The screen always shows **"This will reach 23 clients (4 skipped: opted out / no phone / no email)"** before sending.

8. **Every broadcast is kept as a record.** Who it went to, on which channel, when, and whether it was skipped and why. This is also the POPIA audit trail.

9. **A daily cap per business** (suggest 500 email recipients/day) so one mistake can't blast a whole list twice or get our sending domain blacklisted for every other business on the platform.

10. **Package placement** (adjustable in `plans.ts` like everything else):
    - WhatsApp send lists: **Team** and up (costs us nothing to run).
    - Email broadcasts: **Growth** (costs us per email beyond the free tier).
    - Free Solo: neither, trial only.

## Data model (for the builder)

- `Client.marketingOptOutAt DateTime?` and `Client.marketingOptOutSource String?` ("email_link" | "owner" | "whatsapp_reply").
- `Client.unsubscribeToken String @unique @default(uuid())` — for the public one-click `/u/<token>` page (no login, same pattern as `/q/<token>` and `/i/<token>`).
- `Broadcast` — tenantId, kind (SERVICE_NOTICE | PROMOTION), channel (WHATSAPP_LIST | EMAIL), subject?, body, audience (JSON of the filters used), createdByMembershipId, createdAt, sentAt?.
- `BroadcastRecipient` — broadcastId, clientId, status (PENDING | SENT | SKIPPED | FAILED), skipReason?, sentAt?, providerMessageId?. Unique on (broadcastId, clientId) so a retry can't double-send.
- Deliberately **not** reusing `Conversation`/`Message`: those are two-way threads with translation; a broadcast is one-way and many-recipient.

## Steps

### Step 1 — Opt-out plumbing and the public unsubscribe page  [Sonnet 5] ✅ done
Schema fields above, `/u/<token>` page ("You won't get promotions from Test Plumbing again" + undo within the page), "Client asked to stop promotions" toggle on the client list, opt-out shown as a badge next to the client's name.
**Tested:** opted a client out from the client list (badge + button flipped), opened `/u/<token>` logged out, undid it in-page, reloaded to confirm it persisted, then opted back out — client list stayed in sync throughout.

### Step 2 — Audience builder and preview  [Sonnet 5] ✅ done
`/messages/new`: pick kind (Service notice / Promotion), channel (WhatsApp send list now; Email shown as "coming later"), place and recent-work filters, live count with skip-reason breakdown (opted out / no contact details), message composer with `{firstName}` merge field and a sale-language nudge on service notices. Nothing sends yet.
**Tested:** live preview updated on every filter change without a page reload; filtering by "Soweto" plus opting the seed client out showed "This will reach 0 clients (1 opted out skipped)"; typing "special R450" into a service notice triggered the sale-language nudge.

### Step 3 — WhatsApp send list  [Sonnet 5] ✅ done
Saving creates the `Broadcast` + `BroadcastRecipient` rows (including SKIPPED ones with a reason); the send-list screen (`/messages/[id]`) shows one button per client, marks each SENT when tapped (and stamps the broadcast's `sentAt` once nothing is left PENDING); a `/messages` list shows past broadcasts with sent/total counts. Promotions get "Reply STOP to opt out of promotions." appended automatically. Gated behind `whatsappBroadcasts` (Team and up).
**Tested:** created a service notice, tapped "Send via WhatsApp" on the one seeded client, watched it flip to "Sent" and the broadcast to "1 sent · 0 to go · all done" without a reload; confirmed it then appears in `/messages`.

### Step 4 — Email sending  [Opus 5.5 for provider setup + deliverability, then Sonnet 5]
Resend integration, DNS records (SPF/DKIM) for the sending domain, queued sending in small batches with retries, unsubscribe link and `List-Unsubscribe` header on every promotion, bounce/complaint webhook marking addresses bad, daily cap.
**Test:** real sends to the owner's own inbox; unsubscribe link works; cap refuses the 501st.

### Step 5 — History  [Sonnet 5] ✅ done
`/messages` list of past broadcasts, each showing reach/sent/skipped counts; open one (`/messages/[id]`, already built in Step 3) to see every recipient with its outcome — sent with a timestamp, or skipped with the actual reason (opted out / no phone / no email).
**Tested:** the `/messages` list shows "Reached 1 · 1 sent"; created a promotion against a second test client while the seed client was opted out and confirmed the detail page showed "Sipho Test — Send via WhatsApp" and "Thandi Nkosi-Updated — Skipped — opted out", with "Reply STOP to opt out of promotions." appended to the body. Test data removed after.

## Rough size

Steps 1–3: 2–3 sessions (usable on their own — WhatsApp broadcasts with proper opt-outs). Step 4: 1–2 sessions plus DNS setup on your side (15 minutes in your domain registrar). Step 5: under a session.

## Risks

- **Sending domain reputation is shared** across every business on ServiceKasi. One tenant spamming could land everyone's invoices in junk. The daily cap, bounce handling, and "clients only" rule are what protect this.
- **"Service notice" can be abused as a loophole** for marketing. The keyword nudge helps; the audit trail is the real defence if a client complains.
- **Owners may import clients they never actually worked for.** The CSV import screen should carry one line: "Only import people who are your customers."

## Still open

- Final product name and sending domain (owner deciding). Not needed until Step 4.
