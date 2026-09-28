# Voice memo → draft request — plan

Status: proposed 2026-09-28 [Sonnet 5], replacing an earlier "inbound WhatsApp voice-note webhook" idea that turned out to need the WhatsApp Business API (a new registered number, Meta verification) — a much bigger and riskier change than the actual problem needed. Steps 1, 2 and 4 built 2026-09-28. Step 3 (gating, polish) not started.

## The problem

The owner is on the road, on the phone or WhatsApp with a client, and hangs up having agreed to "come look at the geyser Thursday." An hour and three more calls later, half of that is gone. Today there's no way to capture it except remembering to open the app and type it out properly — which, under load, doesn't happen.

## Why not intercept the client's WhatsApp voice notes directly

That was the original idea, and it doesn't hold up:

- Receiving inbound WhatsApp messages programmatically requires the **WhatsApp Business API** — a registered business number, Meta verification, and approved message templates. `docs/plans/client-messaging.md` already deliberately deferred this ("later, not now") because of that overhead.
- Clients currently message the owner's **own personal cellphone number**. Moving to a Business API number means clients would have to start messaging a *different* number — a real adoption problem for a relationship-based trade business, not just an engineering one.
- There's no equivalent way to intercept a phone *call's* audio at all on a normal cellphone. Since calls are at least as common a source of these requests as WhatsApp voice notes, that half of the original idea wasn't buildable regardless.

## What we're building instead

The owner captures it themselves, right after the call, inside the app they already have open:

1. A **"Record a request"** button (on `/requests` and the dashboard) — tap it, speak for a few seconds ("Dave, burst geyser, Vilakazi Street, needs someone today"), stop.
2. The audio is sent straight to the server, transcribed, and parsed into a **draft** — client name, phone if mentioned, what's needed, urgency, when — and shown to the owner as an editable form, **not saved automatically**.
3. The owner checks it, fixes anything the AI got wrong (names and phone numbers are the likely misses), and saves — creating a normal `ServiceRequest` row that shows up in the existing `/requests` inbox next to web-booking and manual leads.
4. The audio itself is **never stored** — it's piped straight into transcription and discarded. Only the transcript text is kept, attached to the request as a reference note.

This needs no new phone number, no Meta approval, and works for phone calls and voice notes equally, since the owner is the one recording either way.

## Tech

- **Speech-to-text:** OpenAI Whisper API (`audio/transcriptions`).
- **Field extraction:** GPT-4o-mini, structured JSON output, prompted for South African context (geyser, DB board, load-shedding, informal address formats).
- Both are pay-per-use with no fixed cost, matching how this app treats every other paid integration (PayFast, R2, Resend) — nothing runs unless a tenant uses it.
- This is the **first AI/LLM vendor** in the codebase (separate from PayFast/R2/Resend), so it needs its own env var (`OPENAI_API_KEY`) and its own small wrapper, kept isolated in `lib/ai/` so it's easy to swap providers later if pricing or quality make that worthwhile.

## Decisions (please confirm or change)

1. **Never auto-create a request from AI parsing.** The transcript and extracted fields always land in a review screen first. Misheard names, phone numbers, or addresses are exactly the kind of error an AI transcription/parsing chain will make, and creating bad client-facing data automatically is worse than the problem this solves.
2. **The audio file is never persisted anywhere** — not to R2, not to local storage. It's received, transcribed, and discarded in the same request. Only the resulting transcript text is saved. This satisfies POPIA's "don't retain more than necessary" cleanly, since text is far lower-risk than a voice recording, and it also means no change to `storage.ts` or its size/cost profile.
3. **Reuses `ServiceRequest`, not a new model.** A voice-captured request is a lead like any other — it belongs in the same `/requests` inbox, using the same "add as client" / dismiss flow already built. Add `RequestSource.VOICE_MEMO` and a `ServiceRequest.transcript String?` field for the original wording, nothing more.
4. **Client matching happens the same way it already does elsewhere** (phone number lookup) — if the parsed phone matches an existing client, pre-select them; otherwise it's a fresh lead, same as a web booking from a stranger.
5. **Package placement: Growth.** Unlike WhatsApp sending (free `wa.me` links), this has a real per-use cost to us. It belongs with the other "costs us money per use" features (email broadcasts, Xero sync).
6. **A short, honest note in the UI**: "Your recording is transcribed and then deleted — only the text is kept." Said once, near the record button, not buried in a privacy policy nobody reads.

## Rough cost check

Whisper is priced per minute of audio; GPT-4o-mini's structured extraction is a few hundred tokens in and out. Even a heavy user recording fifty 1–2 minute notes a month lands well under R30 in AI cost. Worth confirming with real pricing at build time rather than trusting this estimate blindly, and worth keeping an eye on actual note lengths once real usage exists — a rambling 5-minute voice note costs proportionally more.

## Steps

### Step 1 — Recording, transcription, and a plain review form  [Sonnet 5] ✅ done
Mic-record UI (`MediaRecorder`) on `/requests`, a `/api/voice-requests/transcribe` route handler that calls Whisper and returns the transcript (audio is never written anywhere — it's read into memory, sent to OpenAI, and discarded), and an editable review form (client name, phone, description pre-filled with the transcript, preferred date) that creates a `ServiceRequest` with `source: VOICE_MEMO` and the original wording kept in a new `transcript` field. There was no existing "New request" form to reuse — this is the first manually-created request path, alongside the public booking page and Google Business leads.
**Tested:** the record button, mic-permission failure, and the "transcription isn't set up yet" error (no `OPENAI_API_KEY` in dev) all render their intended messages. Created a request the same shape the review form would produce and confirmed it shows "Voice memo" as the source, the edited description, and an "Originally said: ..." line with the raw transcript underneath — then converted it to a client through the existing "Add as client" flow with no changes needed there. Real on-device recording (actual `MediaRecorder` audio + a live `OPENAI_API_KEY`) still needs testing on a real phone before this goes to beta users — the automated browser here has no microphone and no API key configured.

### Step 2 — Structured field extraction  [Opus 5.5] ✅ done
`src/lib/ai/extractRequest.ts`: after Whisper, GPT-4o-mini (temperature 0, strict JSON-schema output, then zod-validated and value-checked in code) drafts client name, phone, job, location, date, time, timing notes, contact notes and urgency. The review form is pre-filled from it; fields the model had to guess are outlined in amber with "Check this — it may have been misheard"; a phone that matches an existing client says so; urgent/emergency memos get a red banner; urgency carries through to the job's priority when booked; booking is pre-ticked only when both a day *and* a time were said. The raw transcript stays one tap away ("What you said") and is still stored as before. Extraction is best-effort — any failure falls back to Step 1's behaviour (transcript in the description), never an error.

**What testing changed** (7 SA-style sample memos run against the real model, including a partial phone number, an Afrikaans mix, a nameless "lady at Sunset Villas", an ambiguous "next Tuesday", and a note-to-self):
- **Dates are looked up, never calculated.** The first version asked the model to work out "next Tuesday" and it confidently returned a Sunday. The message now includes a labelled 3-week calendar ("Tue 2026-09-29 (tomorrow, this week)") and the model copies from it; code rejects any date outside that calendar.
- **Address, vague timing and contact details get their own schema fields** (`location`, `timingNotes`, `contactNotes`) and the description is assembled from them in code. As prose instructions they kept getting dropped ("tomorrow morning", "she's on WhatsApp", the unit number).
- **"Next <weekday>" ambiguity is flagged in code**, not left to the model: if that weekday also still comes this week, the date is marked uncertain.
- Name rules tightened: Afrikaans titles translated (Meneer → Mr), no invented name from a description, and a name mentioned in passing ("before the Naidoo job") isn't treated as the client.

Also fixed in this step: iPhone recordings are `audio/mp4` but were uploaded as `memo.webm` — Whisper detects format from the extension, so they'd likely have failed. The extension now follows the recording's real type. Whisper also now gets a short SA vocabulary hint (geyser, DB board, JoJo tank, common place names and surnames).

**Still to verify on a real phone:** actual speech → Whisper accuracy with SA accents and road noise, and an iPhone recording end to end. The UI was tested with a simulated microphone and a real extraction result; saving was deliberately not tested because local dev now writes to the live Neon database.

### Step 3 — Polish and gating  [Sonnet 5]
`RequestSource.VOICE_MEMO` badge in the requests list, the Growth-tier gate via `canUse`, the "transcribed then deleted" notice, and a friendly failure message if transcription fails (bad connection, silence, background noise) rather than a raw error.
**Test:** a Free Solo tenant sees the upgrade prompt instead of the record button; a failed transcription shows a clear retry message.

### Step 4 — Book straight onto the calendar  [Sonnet 5] ✅ done
Added after real usage exposed a gap: the owner's actual scenario is "Dennis phones asking for a quote visit Friday at 10" — recording a memo and then still having to separately open Jobs, create a job, and add a visit was one step too many. The review form (in `VoiceMemoRecorder.tsx`) now has a "Book this straight onto the calendar" checkbox. Off (default): unchanged, saves a lead exactly as Step 1 did. On: shows a date + start time and, only if there's more than one active technician, a picker to choose who it's for (with exactly one technician, it's auto-assigned with no picker shown — matches a one-person or small-crew business where asking "who?" would be a pointless extra tap). Submitting then creates a real `Client` (matched by phone if one already exists, so a repeat caller doesn't get duplicated), a `ServiceRequest` marked `CONVERTED`, a `Job`, and a one-hour `Visit` with that technician assigned — reusing the exact same `Job`/`Visit`/`VisitAssignment` models and technician-validation logic the normal "New job" → "Add visit" flow already uses, not a parallel path.

**Decisions made here** (delegated to me for now, to revisit with beta tester feedback):
- **No separate "Quotation" object.** Investigated first: `Quote` is a genuinely different model in this app (pricing/line-items/approval, no date or technician at all) that only becomes a `Job` through an explicit convert step later — a voice memo has no pricing to put in one. So "come give a quotation" and "come Friday at 10" both just become a scheduled `Job`+`Visit` (the normal way a quote *visit* gets booked in this app already); if it turns into real paid work, that's the same "convert" step as any other job.
- **One form, not two paths.** A checkbox, not separate buttons — leaving it unchecked behaves exactly as before. Chosen to keep the "on the road, one thing to tap" feel decision 1 (further up this doc) already established, rather than asking the owner to decide "quote or booking?" before they've even said what's needed.
- **Always a one-hour visit, no end-time field.** Adjustable afterwards from the job page like any other visit. A novice owner dictating a note from the road shouldn't have to estimate visit length in the moment.
- **No double-booking check.** None exists anywhere else in the app's scheduling today (confirmed by reading `jobs/actions.ts`) — this doesn't regress anything, but it also doesn't fix the pre-existing gap. Worth a separate, standalone piece of work later if it becomes a real problem, not bundled into this feature.
**Test:** verified the underlying `Client` → `ServiceRequest` → `Job` → `Visit` → `VisitAssignment` chain directly against the dev database (schema and technician-validation logic match `addVisitAction`'s exactly) — including that an existing client is correctly matched and reused by phone number rather than duplicated. UI review confirmed on desktop; still needs a real run-through on a phone once there's more than one technician in a live tenant, to check the picker's touch targets.

## Risks

- **Mobile browser mic support varies.** Must be tested on real field-worker phones (cheap Android, per the technician's-day design elsewhere in this app), not assumed from desktop testing.
- **Garbage in, garbage out.** A noisy job site or a mumbled note will produce a bad transcript. The review-before-save step (decision 1) is what protects against this reaching a client's actual job record.
- **This is the app's first external AI dependency.** New vendor, new env var, new failure mode (the API being down or rate-limited) to handle gracefully — the record button should fail loudly and clearly, never silently lose what the owner just said.

## Model guide for this plan

| Work | Model |
|---|---|
| Step 1 (recording UI, transcription plumbing) | Sonnet 5 |
| Step 2 (AI field-extraction prompt design) | Opus 5.5 |
| Step 3 (gating, polish) | Sonnet 5 |
| Step 4 (book onto the calendar) | Sonnet 5 |
| Commit and push after each step | Haiku 4.5 |
