// A small tool for the ServiceKasi owner to change a business's package by
// hand, until real billing exists (docs/plans/packages.md). Safe to re-run.
// Run with: npm run set-package -- <args>
import { PrismaClient } from '@prisma/client';
import type { PlanTier } from '@prisma/client';

const prisma = new PrismaClient();

const PLANS: PlanTier[] = ['FREE_SOLO', 'TEAM', 'GROWTH'];

const USAGE = `Usage:
  npm run set-package -- <owner-email> TEAM|GROWTH|FREE_SOLO   Switch a business to a package now (active immediately).
  npm run set-package -- <owner-email> --extend-trial <days>   Give a business N more days of the full (Growth) trial.
  npm run set-package -- <owner-email> --beta                  Mark a beta tester: Growth, free, findable later.
  npm run set-package -- --end-beta <days>                     Put every beta business on an N-day trial countdown.`;

async function tenantForOwnerEmail(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No user with the email ${email}.`);
  const membership = await prisma.membership.findFirst({ where: { userId: user.id, role: 'OWNER' }, include: { tenant: true } });
  if (!membership) throw new Error(`${email} isn't the owner of any business.`);
  return membership.tenant;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(USAGE);
    return;
  }

  if (args[0] === '--end-beta') {
    const days = Number(args[1] ?? 30);
    const { count } = await prisma.tenant.updateMany({
      where: { isBeta: true },
      data: { subscriptionStatus: 'TRIALING', trialEndsAt: new Date(Date.now() + days * 86_400_000), trialEndScreenShownAt: null },
    });
    console.log(`${count} beta business${count === 1 ? '' : 'es'} now on a ${days}-day trial countdown.`);
    return;
  }

  const [email, ...rest] = args;
  const tenant = await tenantForOwnerEmail(email);

  if (rest[0] === '--extend-trial') {
    const days = Number(rest[1] ?? 30);
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { subscriptionStatus: 'TRIALING', trialEndsAt: new Date(Date.now() + days * 86_400_000), trialEndScreenShownAt: null },
    });
    console.log(`${tenant.businessName}: trial extended ${days} days.`);
    return;
  }

  if (rest[0] === '--beta') {
    await prisma.tenant.update({ where: { id: tenant.id }, data: { isBeta: true, plan: 'GROWTH', subscriptionStatus: 'ACTIVE' } });
    console.log(`${tenant.businessName}: marked as a beta tester, on Growth, free.`);
    return;
  }

  const plan = rest[0] as PlanTier;
  if (!PLANS.includes(plan)) {
    console.log(USAGE);
    return;
  }
  await prisma.tenant.update({ where: { id: tenant.id }, data: { plan, subscriptionStatus: 'ACTIVE' } });
  console.log(`${tenant.businessName}: now on ${plan}, active.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
