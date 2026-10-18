'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { deletePublicFile, uploadPublicFile, type UploadableType } from '@/lib/storage';
import { hasLogoSignature, logoFileError } from './logo';

export type LogoUploadResult = { ok: string; error?: never } | { error: string; ok?: never };

export async function uploadBusinessLogoAction(formData: FormData): Promise<LogoUploadResult> {
  const { tenant } = await requireRole(['OWNER', 'ADMIN']);
  const file = formData.get('logo');
  if (!(file instanceof Blob)) return { error: 'Choose a JPG or PNG image first.' };
  const error = logoFileError(file);
  if (error) return { error };

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!hasLogoSignature(buffer, file.type)) return { error: 'This file is not a valid JPG or PNG image.' };

  let logoUrl: string;
  try {
    logoUrl = await uploadPublicFile(tenant.id, buffer, file.type as UploadableType);
  } catch {
    return { error: 'Could not upload the logo. Please try again.' };
  }

  try {
    // Never accept a tenant ID or a logo URL from the form.
    await prisma.tenant.update({ where: { id: tenant.id }, data: { logoUrl } });
  } catch {
    await deletePublicFile(logoUrl);
    return { error: 'Could not save the logo. Your previous logo is unchanged. Please try again.' };
  }

  // Keep the previous file: already-open customer pages may still reference it.
  revalidatePath('/settings/business');
  revalidatePath(`/book/${tenant.slug}`);
  revalidatePath('/q/[token]', 'page');
  revalidatePath('/i/[token]', 'page');
  revalidatePath('/eta/[token]', 'page');
  revalidatePath('/invoices/[id]', 'page');
  return { ok: 'Logo saved.' };
}
