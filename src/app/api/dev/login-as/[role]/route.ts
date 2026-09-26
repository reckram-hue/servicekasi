import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/auth/session';

// Local-development convenience only: instantly logs in as the seeded test
// owner or technician (see prisma/seed.ts), skipping password/PIN/authenticator
// steps, so we don't have to re-enter them every time we test in the browser.
// Refuses to run outside development, so this can never reach production.
const OWNER_EMAIL = 'owner@servicekasi.test';
const TECH_PHONE = '+27825550101';

export async function GET(_req: Request, { params }: { params: Promise<{ role: string }> }) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  const { role } = await params;
  const user =
    role === 'owner'
      ? await prisma.user.findUnique({ where: { email: OWNER_EMAIL } })
      : role === 'technician'
        ? await prisma.user.findUnique({ where: { phone: TECH_PHONE } })
        : null;

  if (!user) {
    return NextResponse.json(
      { error: `Test ${role} account not found. Run: npm run db:seed` },
      { status: 404 }
    );
  }

  const membership = await prisma.membership.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });
  await createSession({ userId: user.id, tenantId: membership?.tenantId ?? null, longLived: true });

  return NextResponse.redirect(new URL('/', _req.url));
}
