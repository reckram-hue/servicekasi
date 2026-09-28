import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/session';
import { tenantDb } from '@/lib/db';
import { canUse } from '@/lib/plans/plans';
import { transcribeAudio, TranscriptionError } from '@/lib/ai/whisper';
import { extractRequestDraft } from '@/lib/ai/extractRequest';

/**
 * Receives a recorded voice memo, transcribes it, and drafts the request
 * fields from it — nothing is saved here. The caller (VoiceMemoRecorder)
 * shows the draft in an editable review form; only submitting that form
 * creates anything, and the audio itself is never persisted.
 */
export async function POST(request: NextRequest) {
  const { tenant } = await requireRole();
  if (!canUse(tenant, 'voiceMemoCapture')) {
    return NextResponse.json({ error: 'Voice memo capture needs the Growth package.' }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get('audio');
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: 'No recording received.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let transcript: string;
  try {
    transcript = await transcribeAudio(buffer, file.type || 'audio/webm');
  } catch (err) {
    const message = err instanceof TranscriptionError ? err.message : 'Something went wrong transcribing that recording.';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const draft = await extractRequestDraft(transcript, tenant.timezone);

  let matchedClient: string | null = null;
  if (draft?.phone?.startsWith('+27')) {
    const client = await tenantDb(tenant.id).client.findFirst({ where: { phone: draft.phone }, select: { firstName: true, lastName: true } });
    if (client) matchedClient = [client.firstName, client.lastName].filter(Boolean).join(' ');
  }

  return NextResponse.json({ transcript, draft, matchedClient });
}
