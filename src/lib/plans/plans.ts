import type { PlanTier, Tenant } from '@prisma/client';

/**
 * The single place that decides which package a feature belongs to. Move a
 * feature between packages by editing FEATURE_PLAN below — nothing else needs
 * to change. Placement is a starting point for beta and expected to move
 * once feedback comes in.
 */
export type Feature =
  | 'onlinePayments'
  | 'paymentReminders'
  | 'technicianApp'
  | 'creditors'
  | 'vatSummary'
  | 'debtorsAged'
  | 'accountantExport'
  | 'whatsappBroadcasts'
  | 'voiceMemoCapture';

/** The lowest package that includes each feature. Everything above it gets it too. */
const FEATURE_PLAN: Record<Feature, PlanTier> = {
  technicianApp: 'TEAM',
  onlinePayments: 'TEAM',
  paymentReminders: 'TEAM',
  creditors: 'TEAM',
  vatSummary: 'TEAM',
  debtorsAged: 'TEAM',
  accountantExport: 'TEAM',
  whatsappBroadcasts: 'TEAM',
  // Costs real money per use (OpenAI), same bracket as the other pay-per-use features.
  voiceMemoCapture: 'GROWTH',
};

const PLAN_RANK: Record<PlanTier, number> = { FREE_SOLO: 0, TEAM: 1, GROWTH: 2 };

export const PLAN_LABEL: Record<PlanTier, string> = { FREE_SOLO: 'Free Solo', TEAM: 'Team', GROWTH: 'Growth' };

/** How many people (owner included) can be logged into the business at once on each package. null = no limit. */
export const PERSON_LIMIT: Record<PlanTier, number | null> = { FREE_SOLO: 1, TEAM: 5, GROWTH: null };

/** How many cashbook expenses a business can add per calendar month. null = no limit (docs/plans/bookkeeping.md). */
export const EXPENSE_MONTHLY_LIMIT: Record<PlanTier, number | null> = { FREE_SOLO: 30, TEAM: null, GROWTH: null };

type TenantPlanFields = Pick<Tenant, 'plan' | 'subscriptionStatus' | 'trialEndsAt'>;

/**
 * The package a business actually has right now — not just what's stored.
 * A running trial gets everything (Growth); once it lapses, and nothing has
 * been chosen, the business quietly becomes Free Solo. Nothing is deleted;
 * only creating more of a paid feature is blocked (see requireFeature).
 */
export function currentPackage(tenant: TenantPlanFields): PlanTier {
  if (tenant.subscriptionStatus === 'ACTIVE') return tenant.plan;
  if (tenant.subscriptionStatus === 'TRIALING' && tenant.trialEndsAt && tenant.trialEndsAt.getTime() > Date.now()) {
    return 'GROWTH';
  }
  return 'FREE_SOLO';
}

/** Whole days left in the trial, or null if there's no running trial. Can be 0 on the last day. */
export function trialDaysLeft(tenant: Pick<Tenant, 'subscriptionStatus' | 'trialEndsAt'>): number | null {
  if (tenant.subscriptionStatus !== 'TRIALING' || !tenant.trialEndsAt) return null;
  const ms = tenant.trialEndsAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/** True once the trial's end date has passed but nobody has chosen a package yet (still marked TRIALING). */
export function trialHasLapsed(tenant: Pick<Tenant, 'subscriptionStatus' | 'trialEndsAt'>): boolean {
  return tenant.subscriptionStatus === 'TRIALING' && !!tenant.trialEndsAt && tenant.trialEndsAt.getTime() <= Date.now();
}

export function canUse(tenant: TenantPlanFields, feature: Feature): boolean {
  return PLAN_RANK[currentPackage(tenant)] >= PLAN_RANK[FEATURE_PLAN[feature]];
}

/** The smallest package that unlocks this feature — for "Upgrade to Team" style messages. */
export function minimumPlanFor(feature: Feature): PlanTier {
  return FEATURE_PLAN[feature];
}

/** How many people (memberships) the business's current package allows logged in at once. null = unlimited. */
export function personLimit(tenant: TenantPlanFields): number | null {
  return PERSON_LIMIT[currentPackage(tenant)];
}

/** How many cashbook expenses the business's current package allows per calendar month. null = unlimited. */
export function expenseMonthlyLimit(tenant: TenantPlanFields): number | null {
  return EXPENSE_MONTHLY_LIMIT[currentPackage(tenant)];
}
