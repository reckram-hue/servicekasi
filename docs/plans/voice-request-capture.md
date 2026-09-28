# Voice memo → draft request — plan

Status: proposed 2026-09-28 [Sonnet 5], replacing an earlier "inbound WhatsApp voice-note webhook" idea that turned out to need the WhatsApp Business API (a new registered number, Meta verification) — a much bigger and riskier change than the actual problem needed. Nothing built yet.

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

### Step 1 — Recording, transcription, and a plain review form  [Sonnet 5]
Mic-record UI (`MediaRecorder`, needs a permission prompt — test on an actual Android phone, not just desktop Chrome, since codec support varies). A route handler receives the audio, calls Whisper, and returns the transcript. No AI field-extraction yet — the transcript is just dropped into the existing "New request" form's description field for the owner to read and fill in themselves. Proves the audio pipeline end to end before adding parsing risk on top.
**Test:** record a short note on a phone, confirm the transcript appears and is reasonably accurate; confirm no audio file exists anywhere after the request completes.

### Step 2 — Structured field extraction  [Opus 5.5]
GPT-4o-mini prompt to extract `clientName`, `phone`, `serviceRequired`, `urgency`, `requestedTime` as strict typed JSON (zod-validated — never trust the model's output shape blindly), pre-filling the review form instead of just the description. Opus for this one: it's the first LLM-extraction feature in the app, prompt quality directly decides whether this is useful or annoying, and South African names/slang/addresses are exactly the kind of edge case worth getting right before shipping.
**Test:** a handful of real-sounding sample notes (a burst geyser, a vague "my geyser is making a noise," one with no name given) each produce sensible, correctly-flagged-as-uncertain fields rather than confidently wrong ones.

### Step 3 — Polish and gating  [Sonnet 5]
`RequestSource.VOICE_MEMO` badge in the requests list, the Growth-tier gate via `canUse`, the "transcribed then deleted" notice, and a friendly failure message if transcription fails (bad connection, silence, background noise) rather than a raw error.
**Test:** a Free Solo tenant sees the upgrade prompt instead of the record button; a failed transcription shows a clear retry message.

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
| Commit and push after each step | Haiku 4.5 |
