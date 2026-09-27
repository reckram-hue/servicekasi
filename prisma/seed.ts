// Creates fixed test accounts in the LOCAL development database only.
// Safe to re-run: it updates the same records instead of duplicating them.
// Run with: npm run db:seed
import { PrismaClient } from '@prisma/client';
import { hashSecret } from '../src/lib/auth/scrypt.ts';

const prisma = new PrismaClient();

const OWNER_EMAIL = 'owner@servicekasi.test';
const OWNER_PASSWORD = 'TestOwner-2026!';
const TECH_PHONE = '+27825550101';
const TECH_PIN = '4821';
// Fixed secret so the code can always be recomputed without a phone —
// see docs/dev-test-accounts.md. Never used outside local development.
const OWNER_TOTP_SECRET = 'FHZHD4MHMD73Y3KKFL6RCLU5XQESJ3RK';

// Finds the tenant this owner email already runs, rather than matching by a
// fixed slug — a real signup with this email (e.g. testing in the browser)
// picks its own random slug, and matching by slug would create a second,
// empty duplicate tenant instead of reusing it.
async function ownersTenant() {
  const existing = await prisma.user.findUnique({
    where: { email: OWNER_EMAIL },
    include: { memberships: { where: { role: 'OWNER' }, include: { tenant: true } } },
  });
  return existing?.memberships[0]?.tenant ?? null;
}

async function main() {
  const found = await ownersTenant();
  // ACTIVE + GROWTH so local testing is never cut off by a trial expiring.
  const tenant = found
    ? await prisma.tenant.update({ where: { id: found.id }, data: { plan: 'GROWTH', subscriptionStatus: 'ACTIVE' } })
    : await prisma.tenant.create({
        data: { slug: 'test-plumbing', businessName: 'Test Plumbing', countryCode: 'ZA', currencyCode: 'ZAR', plan: 'GROWTH', subscriptionStatus: 'ACTIVE' },
      });

  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    create: {
      name: 'Owner Test',
      email: OWNER_EMAIL,
      passwordHash: await hashSecret(OWNER_PASSWORD),
      totpSecret: OWNER_TOTP_SECRET,
      totpEnabled: true,
    },
    update: { totpSecret: OWNER_TOTP_SECRET, totpEnabled: true },
  });
  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: owner.id } },
    create: { tenantId: tenant.id, userId: owner.id, role: 'OWNER' },
    update: {},
  });

  const tech = await prisma.user.upsert({
    where: { phone: TECH_PHONE },
    create: { name: 'Sipho Test', phone: TECH_PHONE, preferredLanguage: 'zu', pinHash: await hashSecret(TECH_PIN) },
    update: { pinHash: await hashSecret(TECH_PIN) },
  });
  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: tech.id } },
    create: { tenantId: tenant.id, userId: tech.id, role: 'TECHNICIAN' },
    update: {},
  });

  console.log('Seeded: Test Plumbing, owner@servicekasi.test, +27825550101');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
