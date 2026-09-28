'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { createVoiceRequestAction, type VoiceRequestFormState } from '@/lib/requests/actions';
import { TechnicianPicker } from '@/components/jobs/TechnicianPicker';

type Stage = 'idle' | 'recording' | 'transcribing' | 'review' | 'error';
type Technician = { id: string; name: string };
type Urgency = 'LOW' | 'NORMAL' | 'HIGH' | 'EMERGENCY';
type Draft = {
  clientName: string | null;
  phone: string | null;
  serviceRequired: string | null;
  urgency: Urgency;
  requestedDate: string | null;
  requestedTime: string | null;
  uncertain: string[];
};

const FIELD = 'w-full rounded-lg border bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:outline-none';
const URGENCY_LABEL: Record<Urgency, string> = { LOW: 'Low', NORMAL: 'Normal', HIGH: 'High', EMERGENCY: 'Emergency' };

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Amber border + a nudge on fields the AI had to guess at — misheard names and numbers are the likely misses. */
function Unsure({ show }: { show: boolean }) {
  return show ? <span className="mt-1 block text-xs text-amber-400">Check this — it may have been misheard</span> : null;
}

export function VoiceMemoRecorder({ technicians = [] }: { technicians?: Technician[] }) {
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [matchedClient, setMatchedClient] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [schedule, setSchedule] = useState(false);
  const [selectedTechs, setSelectedTechs] = useState<string[]>(technicians.length === 1 ? [technicians[0].id] : []);

  const unsure = (field: string) => !!draft?.uncertain.includes(field);
  const border = (field: string) => (unsure(field) ? 'border-amber-500' : 'border-slate-700');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const [state, formAction, pending] = useActionState<VoiceRequestFormState, FormData>(createVoiceRequestAction, undefined);

  function reset() {
    setStage('idle');
    setError(null);
    setTranscript('');
    setDraft(null);
    setMatchedClient(null);
    setSchedule(false);
    setSelectedTechs(technicians.length === 1 ? [technicians[0].id] : []);
  }

  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(reset, 1200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.ok]);

  async function handleStop() {
    const blob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
    const body = new FormData();
    body.append('audio', blob);

    try {
      const res = await fetch('/api/voice-requests/transcribe', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transcription failed.');
      setTranscript(data.transcript);
      setDraft(data.draft ?? null);
      setMatchedClient(data.matchedClient ?? null);
      // Both a day and a time were said — they almost certainly meant "book it". Still needs their tap to save.
      setSchedule(technicians.length > 0 && !!data.draft?.requestedDate && !!data.draft?.requestedTime);
      setStage('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed. Please try again.');
      setStage('error');
    }
  }

  async function startRecording() {
    setError(null);
    if (typeof window === 'undefined' || !navigator.mediaDevices || !window.MediaRecorder) {
      setError('Voice recording isn’t supported in this browser.');
      setStage('error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = handleStop;
      mediaRecorderRef.current = recorder;
      recorder.start();

      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      setStage('recording');
    } catch {
      setError('Could not access the microphone. Check your browser or phone settings.');
      setStage('error');
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStage('transcribing');
  }

  if (stage === 'idle') {
    return (
      <button
        type="button"
        onClick={startRecording}
        className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-medium text-slate-300 active:scale-95 hover:border-amber-400 hover:text-amber-300"
      >
        <Mic size={18} />
        Record a request
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
      {stage === 'recording' && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            Recording… {formatElapsed(seconds)}
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
          >
            <Square size={14} /> Stop
          </button>
        </div>
      )}

      {stage === 'transcribing' && <p className="text-sm text-slate-400">Listening to your note and filling in the details…</p>}

      {stage === 'error' && (
        <div>
          <p className="mb-3 text-sm text-red-400">{error}</p>
          <div className="flex gap-2">
            <button type="button" onClick={startRecording} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400">
              Try again
            </button>
            <button type="button" onClick={reset} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {stage === 'review' && (
        <form action={formAction}>
          <input type="hidden" name="transcript" value={transcript} />
          <p className="mb-3 text-xs uppercase tracking-wide text-slate-500">Check this before saving — recordings can mishear names and numbers</p>
          {state?.error && <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{state.error}</p>}
          {state?.ok && <p className="mb-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">Saved to requests.</p>}
          {(draft?.urgency === 'EMERGENCY' || draft?.urgency === 'HIGH') && (
            <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300">
              {draft.urgency === 'EMERGENCY' ? 'Sounds like an emergency' : 'Sounds urgent'}
            </p>
          )}

          <label className="mb-3 block">
            <span className="mb-1 block text-sm font-medium text-slate-300">Client name</span>
            <input name="contactName" defaultValue={draft?.clientName ?? ''} className={`${FIELD} ${border('clientName')}`} />
            <Unsure show={unsure('clientName')} />
          </label>

          <label className="mb-3 block">
            <span className="mb-1 block text-sm font-medium text-slate-300">Phone</span>
            <input
              name="contactPhone"
              type="tel"
              placeholder="082 123 4567"
              defaultValue={draft?.phone ?? ''}
              className={`${FIELD} ${border('phone')}`}
            />
            <Unsure show={unsure('phone')} />
            {matchedClient && <span className="mt-1 block text-xs text-emerald-400">Matches your existing client {matchedClient}</span>}
          </label>

          <label className="mb-3 block">
            <span className="mb-1 block text-sm font-medium text-slate-300">What&apos;s needed</span>
            <textarea name="description" defaultValue={draft?.serviceRequired ?? transcript} rows={4} className={`${FIELD} border-slate-700`} />
          </label>

          {draft && (
            <details className="mb-3 text-xs text-slate-500">
              <summary className="cursor-pointer">What you said</summary>
              <p className="mt-1 whitespace-pre-wrap italic">&ldquo;{transcript}&rdquo;</p>
            </details>
          )}

          <input type="hidden" name="technicianIdsJson" value={JSON.stringify(selectedTechs)} />

          {technicians.length > 0 && (
            <label className="mb-4 flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} className="h-4 w-4 rounded" />
              Book this straight onto the calendar
            </label>
          )}

          {schedule ? (
            <>
              <div className="mb-3 grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-300">Date</span>
                  <input name="visitDate" type="date" required defaultValue={draft?.requestedDate ?? ''} className={`${FIELD} ${border('requestedDate')}`} />
                  <Unsure show={unsure('requestedDate')} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-300">Start time</span>
                  <input name="visitStartTime" type="time" required defaultValue={draft?.requestedTime ?? ''} className={`${FIELD} ${border('requestedTime')}`} />
                  <Unsure show={unsure('requestedTime')} />
                </label>
              </div>
              <label className="mb-3 block">
                <span className="mb-1 block text-sm font-medium text-slate-300">Priority</span>
                <select name="priority" defaultValue={draft?.urgency ?? 'NORMAL'} className={`${FIELD} border-slate-700`}>
                  {(Object.keys(URGENCY_LABEL) as Urgency[]).map((u) => (
                    <option key={u} value={u}>
                      {URGENCY_LABEL[u]}
                    </option>
                  ))}
                </select>
              </label>
              {technicians.length > 1 && <TechnicianPicker technicians={technicians} selected={selectedTechs} onChange={setSelectedTechs} />}
              <p className="mb-4 text-xs text-slate-500">Creates a one-hour visit — adjust the length or details afterwards on the job.</p>
            </>
          ) : (
            <label className="mb-4 block">
              <span className="mb-1 block text-sm font-medium text-slate-300">Preferred date (optional)</span>
              <input name="preferredDate" type="date" defaultValue={draft?.requestedDate ?? ''} className={`${FIELD} ${border('requestedDate')}`} />
              <Unsure show={unsure('requestedDate')} />
            </label>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
            >
              {pending ? 'Saving…' : schedule ? 'Book appointment' : 'Save request'}
            </button>
            <button type="button" onClick={reset} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700">
              Discard
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
