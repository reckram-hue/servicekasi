import 'server-only';
import { prisma } from '@/lib/prisma';

export type AdminTenantRow = {
  id: string;
  businessName: string;
  plan: string;
  subscriptionStatus: string;
  isBeta: boolean;
  trialEndsAt: Date | null;
  createdAt: Date;
  clientCount: number;
  jobCount: number;
  lastLoginAt: Date | null;
  ownerName: string | null;
  ownerEmail: string | null;
};

/** Every business on the platform, with just enough activity signal to spot who's stuck or gone quiet. */
export async function listTenantsForAdmin(): Promise<AdminTenantRow[]> {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      businessName: true,
      plan: true,
      subscriptionStatus: true,
      isBeta: true,
      trialEndsAt: true,
      createdAt: true,
      memberships: { select: { userId: true, role: true, user: { select: { name: true, email: true } }, createdAt: true } },
      _count: { select: { clients: true, jobs: true } },
    },
  });

  const allUserIds = tenants.flatMap((t) => t.memberships.map((m) => m.userId));
  const lastSessions = allUserIds.length
    ? await prisma.session.groupBy({ by: ['userId'], where: { userId: { in: allUserIds }, mfaPending: false }, _max: { createdAt: true } })
    : [];
  const lastLoginByUser = new Map(lastSessions.map((s) => [s.userId, s._max.createdAt]));

  return tenants.map((t) => {
    const logins = t.memberships.map((m) => lastLoginByUser.get(m.userId)).filter((d): d is Date => !!d);
    const owner = t.memberships.find((m) => m.role === 'OWNER') ?? [...t.memberships].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    return {
      id: t.id,
      businessName: t.businessName,
      plan: t.plan,
      subscriptionStatus: t.subscriptionStatus,
      isBeta: t.isBeta,
      trialEndsAt: t.trialEndsAt,
      createdAt: t.createdAt,
      clientCount: t._count.clients,
      jobCount: t._count.jobs,
      lastLoginAt: logins.length ? new Date(Math.max(...logins.map((d) => d.getTime()))) : null,
      ownerName: owner?.user.name ?? null,
      ownerEmail: owner?.user.email ?? null,
    };
  });
}
