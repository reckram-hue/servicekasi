import 'server-only';
import { z } from 'zod';
import { normalizeSaPhone } from '@/lib/southAfrica';

/**
 * Turns a voice-memo transcript into a draft request the owner then reviews.
 * Best-effort only: any failure returns null and the review form falls back
 * to the raw transcript — extraction must never lose what the owner said.
 */

export type RequestDraft = {
  clientName: string | null;
  phone: string | null;
  serviceRequired: string | null;
  urgency: 'LOW' | 'NORMAL' | 'HIGH' | 'EMERGENCY';
  requestedDate: string | null; // YYYY-MM-DD
  requestedTime: string | null; // HH:mm
  uncertain: ('clientName' | 'phone' | 'requestedDate' | 'requestedTime')[];
};

const UNCERTAIN_FIELDS = ['clientName', 'phone', 'requestedDate', 'requestedTime'] as const;
const URGENCIES = ['LOW', 'NORMAL', 'HIGH', 'EMERGENCY'] as const;

const ModelOutput = z.object({
  clientName: z.string().nullable(),
  phone: z.string().nullable(),
  job: z.string().nullable(),
  location: z.string().nullable(),
  requestedDate: z.string().nullable(),
  requestedTime: z.string().nullable(),
  timingNotes: z.string().nullable(),
  contactNotes: z.string().nullable(),
  urgency: z.enum(URGENCIES),
  uncertain: z.array(z.enum(UNCERTAIN_FIELDS)),
});

// Small models fill dedicated fields far more reliably than they follow "and don't forget
// to mention X" prose — so address, timing and contact details each get their own slot,
// and the description is assembled from them in code.
const nullableString = (description: string) => ({ type: ['string', 'null'], description });
const JSON_SCHEMA = {
  name: 'request_draft',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['clientName', 'phone', 'job', 'location', 'requestedDate', 'requestedTime', 'timingNotes', 'contactNotes', 'urgency', 'uncertain'],
    properties: {
      clientName: nullableString('The client’s name only'),
      phone: nullableString('Digits, optional leading +'),
      job: nullableString('What is wrong or what they want done'),
      location: nullableString('Address, complex, unit, area or landmark'),
      requestedDate: nullableString('YYYY-MM-DD, copied from the calendar'),
      requestedTime: nullableString('HH:mm, 24-hour'),
      timingNotes: nullableString('Timing not captured exactly by date/time'),
      contactNotes: nullableString('How or when to reach them, or who they are if no name'),
      urgency: { type: 'string', enum: [...URGENCIES] },
      uncertain: { type: 'array', items: { type: 'string', enum: [...UNCERTAIN_FIELDS] } },
    },
  },
};

const SYSTEM_PROMPT = `You turn a voice memo into a draft job request. A South African tradesperson (plumber, electrician, handyman, pool or aircon technician, etc.) recorded the memo to themselves straight after a phone call or WhatsApp with a client, usually while driving. It is informal, may mix English with Afrikaans, isiZulu, isiXhosa, Sesotho or other South African languages, and came through speech-to-text, so names, numbers and places may be misheard. Write every field in plain English.

The owner checks your draft before anything is saved. A blank field costs them a few seconds; a confidently wrong one sends them to the wrong house or has them call the wrong person. So never invent: if something wasn't said, return null. If you had to guess, fill it in AND list the field in "uncertain".

clientName — only the person asking for the work, a few words at most: "Dennis", "Mrs Naidoo", "Thabo Mokoena". Translate Afrikaans titles: "Meneer van der Merwe" → "Mr van der Merwe", Mevrou → Mrs, Juffrou → Miss (Oom and Tannie stay). Null when:
  - no name was given, only a description ("the lady at Sunset Villas") — put that in contactNotes;
  - a name is only mentioned in passing ("before the Naidoo job") — that's not the client;
  - the memo is a note to self, not a client request.
Names that sound mangled by transcription → your best reading, marked uncertain.

phone — South African numbers are 10 digits starting with 0 (082 123 4567) or +27 and 9 digits. Convert spoken forms: "oh"/"zero" → 0, "double five" → 55, "triple two" → 222. Digits only. Incomplete number → what you heard, marked uncertain. "On WhatsApp" or "the number he phoned from" is not a number → null (put it in contactNotes).

job — what's wrong or what they want, short and specific: "Burst geyser in the roof, water coming through the ceiling." Keep trade terms as-is: geyser, DB board, pre-paid meter, earth leakage, inverter, gate motor, borehole pump, JoJo tank, burglar bars. For a note to self, the note itself.

location — any address, street number, complex, unit, suburb, township or landmark: "14 Vilakazi Street, Orlando West", "Sunset Villas, unit 12", "Tembisa".

requestedDate — NEVER calculate a date. Find it in the calendar given in the message and copy it exactly. "Today" / "tomorrow" are labelled. A plain weekday ("Friday") is the first such day after today. "Next Tuesday" is the Tuesday marked "next week" — and if a Tuesday also still comes this week, mark requestedDate uncertain. "The 3rd" is the first 3rd on or after today. South African "now-now" means soon (today); "just now" means later, not immediately. No day mentioned → null.

requestedTime — 24-hour HH:mm. For a site visit "ten" = 10:00, "two" = 14:00, "half past two" = 14:30, "quarter to nine" = 08:45. Vague times ("morning", "after lunch", "early") → null here, and go in timingNotes.

timingNotes — any timing the date and time fields don't capture exactly: "Tomorrow morning", "After lunch", "Before the kids get home", "Right now". Null if the date/time say it all.

contactNotes — who they are if there's no name ("Lady from the complex"), and how or when to reach them: "Prefers WhatsApp", "Call after 5", "Phone the wife, not him".

urgency —
  EMERGENCY: flooding, burst pipe or geyser, no water, no power (and not scheduled load-shedding), gas smell, sparking, burning smell, anything unsafe, "right now".
  HIGH: "today", "ASAP", "urgent", "as soon as you can", a gate or door that won't close or lock.
  LOW: "no rush", "whenever", "next month", or a quote with no timing pressure.
  NORMAL: everything else, including notes to self.`;

const CALENDAR_DAYS = 21;

/** Lines like "Tue 2026-09-29 (tomorrow, this week)" — the model looks dates up here rather than doing arithmetic it gets wrong. */
function calendarFor(timeZone: string) {
  const lines: string[] = [];
  const stillThisWeek = new Set<string>(); // weekdays after today, before next Monday
  const now = Date.now();
  let today = '';
  let lastDay = '';
  let week = 0;
  for (let i = 0; i < CALENDAR_DAYS; i++) {
    const d = new Date(now + i * 86_400_000);
    const iso = d.toLocaleDateString('en-CA', { timeZone });
    const day = d.toLocaleDateString('en-GB', { weekday: 'short', timeZone });
    if (i > 0 && day === 'Mon') week++;
    if (i > 0 && week === 0) stillThisWeek.add(day);
    const tags = [i === 0 ? 'today' : i === 1 ? 'tomorrow' : null, ['this week', 'next week', 'the week after', 'in three weeks'][week]].filter(Boolean);
    lines.push(`${day} ${iso} (${tags.join(', ')})`);
    if (i === 0) today = iso;
    lastDay = iso;
  }
  return { today, lastDay, stillThisWeek, text: lines.join('\n') };
}

const WEEKDAY = /\bnext\s+(mon|tues|wednes|thurs|fri|satur|sun)day\b/i;
const SHORT: Record<string, string> = { mon: 'Mon', tues: 'Tue', wednes: 'Wed', thurs: 'Thu', fri: 'Fri', satur: 'Sat', sun: 'Sun' };

/** "Next Tuesday" said on a Monday could mean tomorrow or next week — people genuinely differ, so the owner should check. */
function isAmbiguousNextWeekday(transcript: string, stillThisWeek: Set<string>): boolean {
  const m = WEEKDAY.exec(transcript);
  return !!m && stillThisWeek.has(SHORT[m[1].toLowerCase()]);
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function sentence(s: string | null): string | null {
  const t = s?.trim();
  if (!t) return null;
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/** The API enforces the shape; the *values* still get checked here before reaching the owner's form. */
function sanitise(raw: z.infer<typeof ModelOutput>, today: string, lastDay: string): RequestDraft {
  const uncertain = new Set(raw.uncertain);

  let phone: string | null = null;
  if (raw.phone?.trim()) {
    const normalised = normalizeSaPhone(raw.phone);
    if (/^\+27\d{9}$/.test(normalised)) {
      phone = normalised;
    } else {
      phone = raw.phone.trim(); // keep the partial number so the owner can finish it
      uncertain.add('phone');
    }
  } else {
    uncertain.delete('phone');
  }

  // Anything outside the calendar we gave it is a made-up date, not a guess worth showing.
  const requestedDate = raw.requestedDate && DATE.test(raw.requestedDate) && raw.requestedDate >= today && raw.requestedDate <= lastDay ? raw.requestedDate : null;
  if (!requestedDate) uncertain.delete('requestedDate');

  const requestedTime = raw.requestedTime && TIME.test(raw.requestedTime) ? raw.requestedTime : null;
  if (!requestedTime) uncertain.delete('requestedTime');

  const clientName = raw.clientName?.trim().slice(0, 100) || null;
  if (!clientName) uncertain.delete('clientName');

  const description = [raw.job, raw.location, raw.timingNotes, raw.contactNotes].map(sentence).filter(Boolean).join(' ');

  return {
    clientName,
    phone,
    serviceRequired: description.slice(0, 2000) || null,
    urgency: raw.urgency,
    requestedDate,
    requestedTime,
    uncertain: [...uncertain],
  };
}

export async function extractRequestDraft(transcript: string, timeZone: string): Promise<RequestDraft | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !transcript.trim()) return null;

  const calendar = calendarFor(timeZone);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_schema', json_schema: JSON_SCHEMA },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Calendar:\n${calendar.text}\n\nVoice memo transcript:\n"""\n${transcript}\n"""` },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = ModelOutput.safeParse(JSON.parse(content));
    if (!parsed.success) return null;
    const draft = sanitise(parsed.data, calendar.today, calendar.lastDay);
    if (draft.requestedDate && isAmbiguousNextWeekday(transcript, calendar.stillThisWeek) && !draft.uncertain.includes('requestedDate')) {
      draft.uncertain.push('requestedDate');
    }
    return draft;
  } catch {
    return null;
  }
}
