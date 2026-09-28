import 'server-only';

/**
 * The app's first external AI vendor (OpenAI), kept isolated here so it can
 * be swapped later without touching callers. Uses the raw REST API directly
 * rather than the openai SDK — this is the only call site, so a whole
 * dependency isn't worth it.
 *
 * The audio buffer is never written to disk or object storage: it exists
 * only in memory for the lifetime of this one request, then is discarded.
 * Only the resulting transcript is ever persisted (docs/plans/voice-request-capture.md).
 */

const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // Whisper's own limit is 25MB; leave some margin

export class TranscriptionError extends Error {}

// Whisper detects the audio format from the file extension, and phones differ:
// Android Chrome records webm, iPhone Safari records mp4.
function extensionFor(mimeType: string): string {
  const type = mimeType.split(';')[0].trim();
  if (type === 'audio/mp4' || type === 'video/mp4') return 'mp4';
  if (type === 'audio/ogg') return 'ogg';
  if (type === 'audio/mpeg') return 'mp3';
  if (type === 'audio/wav' || type === 'audio/x-wav') return 'wav';
  return 'webm';
}

// A spelling hint, not an instruction: nudges Whisper toward words it would otherwise mishear.
const VOCABULARY_HINT =
  'Geyser, DB board, pre-paid meter, earth leakage, load-shedding, inverter, gate motor, borehole, JoJo tank, burglar bars. ' +
  'Soweto, Vilakazi Street, Umhlanga, Khayelitsha, Tembisa, Mitchells Plain, Centurion, Sandton. ' +
  'Thabo, Sipho, Nomsa, Naidoo, Van der Merwe, Botha, Dlamini.';

export async function transcribeAudio(buffer: Buffer, mimeType: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new TranscriptionError('Voice transcription isn’t set up yet.');
  if (buffer.byteLength === 0) throw new TranscriptionError('That recording was empty.');
  if (buffer.byteLength > MAX_AUDIO_BYTES) throw new TranscriptionError('That recording is too long — keep it under a couple of minutes.');

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), `memo.${extensionFor(mimeType)}`);
  form.append('model', 'whisper-1');
  form.append('response_format', 'json');
  form.append('prompt', VOCABULARY_HINT);

  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } catch {
    throw new TranscriptionError('Could not reach the transcription service. Check your connection and try again.');
  }

  if (!res.ok) {
    throw new TranscriptionError(res.status === 429 ? 'Too many recordings right now — try again in a moment.' : 'Transcription failed. Please try again.');
  }

  const data = (await res.json()) as { text?: string };
  const transcript = data.text?.trim();
  if (!transcript) throw new TranscriptionError('Could not make out any words in that recording.');
  return transcript;
}
