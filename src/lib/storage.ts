import 'server-only';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * File storage for photos and signatures: Cloudflare R2 (an S3-compatible
 * bucket) when the R2_* env vars are set, otherwise the local `public/uploads`
 * folder. The local fallback exists so this feature works in development
 * before a bucket is set up — never use it in production, since files written
 * there vanish on every deploy.
 */

const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

const r2Env = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET_NAME,
  publicUrl: process.env.R2_PUBLIC_URL?.replace(/\/$/, ''),
};

const r2Configured = Object.values(r2Env).every(Boolean);

let s3: S3Client | null = null;
function r2Client(): S3Client {
  s3 ??= new S3Client({
    region: 'auto',
    endpoint: `https://${r2Env.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: r2Env.accessKeyId!, secretAccessKey: r2Env.secretAccessKey! },
  });
  return s3;
}

export type UploadableType = 'image/jpeg' | 'image/png';

/** Uploads a photo or signature for this tenant and returns its public URL. */
export async function uploadPublicFile(tenantId: string, buffer: Buffer, contentType: UploadableType): Promise<string> {
  if (buffer.byteLength === 0) throw new Error('The file is empty.');
  if (buffer.byteLength > MAX_UPLOAD_BYTES) throw new Error('That file is too large.');

  const ext = contentType === 'image/png' ? 'png' : 'jpg';
  const key = `${tenantId}/${randomUUID()}.${ext}`;

  if (r2Configured) {
    await r2Client().send(new PutObjectCommand({ Bucket: r2Env.bucket!, Key: key, Body: buffer, ContentType: contentType }));
    return `${r2Env.publicUrl}/${key}`;
  }

  const dir = path.join(process.cwd(), 'public', 'uploads', tenantId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, path.basename(key)), buffer);
  return `/uploads/${key}`;
}

/** Reads back an already-uploaded file's bytes — for bundling slip photos into the accountant export. */
export async function readPublicFile(url: string): Promise<Buffer> {
  if (url.startsWith('/uploads/')) return readFile(path.join(process.cwd(), 'public', url));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Best-effort delete; never throws (a missing file or storage hiccup shouldn't block removing the database record). */
export async function deletePublicFile(url: string): Promise<void> {
  try {
    if (r2Configured && url.startsWith(`${r2Env.publicUrl}/`)) {
      const key = url.slice(r2Env.publicUrl!.length + 1);
      await r2Client().send(new DeleteObjectCommand({ Bucket: r2Env.bucket!, Key: key }));
    } else if (url.startsWith('/uploads/')) {
      await unlink(path.join(process.cwd(), 'public', url));
    }
  } catch {
    // orphaned file — harmless, cleaned up manually if it ever matters
  }
}
