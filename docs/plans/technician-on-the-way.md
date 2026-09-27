# Plan: "Who's coming" WhatsApp notice (free tier)

Status: done, 2026-09-27.

## Why

Clients — especially for home visits like pool or geyser work — want to know
who's about to arrive. WhatsApp Business's free app has no automation or API:
its "/" quick replies are a personal typing shortcut, not something a server
can trigger, and there's no free way to auto-send a message the moment a
technician sets off. Automatic sending needs Meta's paid WhatsApp Business
Platform (Cloud API) — a real feature, but for a later paid tier, not now.

## What this is instead

The same one-tap `wa.me` pattern already used for quotes and invoices: a
button that opens WhatsApp with the message pre-filled, office taps send.
The "photo of who's arriving" problem — which click-to-chat can't attach —
is solved with a small public link, the same idea as `/q/<token>` and
`/i/<token>`.

## What was built

1. **Technician photo** — `User.photoUrl`, set once by the owner/admin on
   the Team page (reuses the same resize-and-upload pipeline as job photos).
   Optional; the page works without one.
2. **`Visit.publicToken`** (unique, unguessable) and a public page at
   `/eta/<token>` — no login, added to `PUBLIC_PATHS`. Shows the business
   name, the technician's first name and photo, their specialties, the
   client's suburb, and the appointment time. Nothing else — no pricing, no
   other job details.
3. **"Notify client" button** on the job page, next to each visit with a
   technician assigned (not only once they're `EN_ROUTE` — office can send
   it ahead of time too). Builds a `wa.me` link with the message text
   already filled in; wording adjusts for `EN_ROUTE` ("is on the way")
   vs. still scheduled ("is booked for").
4. Sends from the business's own WhatsApp number, not the technician's
   personal phone — consistent with how quotes and invoices are sent, and
   keeps a technician's own number out of clients' hands.

## Later (paid tier)

Automatic sending via Meta's WhatsApp Business Platform (Cloud API), firing
the moment a visit's status changes, with the photo attached directly in the
message. Needs Meta business verification, approved message templates, and
per-conversation cost.
