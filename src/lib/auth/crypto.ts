import 'server-only';
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

const KEY_LEN = 64;

/** Hashes a password or PIN for storage. Format: scrypt$<salt>$<hash> (base64). */
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(secret, salt, KEY_LEN);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

// Used when the account doesn't exist, so a wrong email takes as long to
// reject as a wrong password (stops attackers discovering which emails exist).
const DUMMY_HASH = `scrypt$${Buffer.alloc(16).toString('base64')}$${Buffer.alloc(KEY_LEN).toString('base64')}`;

export async function verifySecret(secret: string, stored: string | null | undefined): Promise<boolean> {
  const [algo, saltB64, hashB64] = (stored ?? DUMMY_HASH).split('$');
  if (algo !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scryptAsync(secret, Buffer.from(saltB64, 'base64'), expected.length);
  return stored != null && timingSafeEqual(actual, expected);
}

/** Random, URL-safe token for session cookies. */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
