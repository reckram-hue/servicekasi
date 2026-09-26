import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function key(): Buffer {
  const raw = process.env.PAYMENT_SECRETS_KEY;
  const buf = raw ? Buffer.from(raw, 'base64') : Buffer.alloc(0);
  if (buf.length !== 32) throw new Error('PAYMENT_SECRETS_KEY must be 32 random bytes, base64-encoded. See .env.example.');
  return buf;
}

/** AES-256-GCM: "v1.<iv>.<tag>.<ciphertext>", all base64. Tampering makes decryption fail. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ct.toString('base64')].join('.');
}

export function decryptSecret(stored: string): string {
  const [version, iv, tag, ct] = stored.split('.');
  if (version !== 'v1' || !iv || !tag || !ct) throw new Error('Unrecognised encrypted secret.');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8');
}
