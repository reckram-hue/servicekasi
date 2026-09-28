import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { transcribeAudio, TranscriptionError } from '@/lib/ai/whisper';

/**
 * Receives a recorded voice memo, transcribes it, and returns the text —
 * nothing is saved here. The caller (VoiceMemoRecorder) shows the transcript
 * in an editable review form; only submitting that form creates a
 * ServiceRequest, and even then the audio itself was never persisted.
 */
export async function POST(request: NextRequest) {
  await requireRole();

  const form = await request.formData();
  const file = form.get('audio');
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: 'No recording received.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const transcript = await transcribeAudio(buffer, 'memo.webm', file.type || 'audio/webm');
    return NextResponse.json({ transcript });
  } catch (err) {
    const message = err instanceof TranscriptionError ? err.message : 'Something went wrong transcribing that recording.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
